import "dotenv/config";
import { createHash, randomUUID } from "node:crypto";
import mysql, { type Pool, type PoolConnection, type RowDataPacket } from "mysql2/promise";

type Row = RowDataPacket & Record<string, unknown>;
type Summary = Record<string, { source: number; loaded: number; rejected: number }>;

const SOURCE_SYSTEM = "NEXIF";
const SCOPE = "asset-notification-work-order";
const apply = process.argv.includes("--apply");
const sourceUrl = process.env.SOURCE_DATABASE_URL;
const targetUrl = process.env.TARGET_DATABASE_URL ?? process.env.DEV_DATABASE_URL;

if (!sourceUrl) throw new Error("SOURCE_DATABASE_URL is required");
if (!targetUrl) throw new Error("TARGET_DATABASE_URL or DEV_DATABASE_URL is required");

function databaseName(uri: string) {
  return decodeURIComponent(new URL(uri).pathname.slice(1));
}

if (databaseName(sourceUrl) !== "nexif") throw new Error("SOURCE_DATABASE_URL must name the allow-listed nexif database");
if (databaseName(targetUrl) !== "ma_next") throw new Error("Target URL must name the allow-listed ma_next database");
if (sourceUrl === targetUrl) throw new Error("Source and target databases must be different");

function stableId(namespace: string, value: unknown) {
  const bytes = createHash("sha256").update(`${SOURCE_SYSTEM}:${namespace}:${String(value)}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function text(value: unknown, fallback = "") {
  return value === null || value === undefined ? fallback : String(value).trim();
}

function limited(value: unknown, max: number, fallback = "") {
  return text(value, fallback).slice(0, max);
}

function nullable(value: unknown, max?: number) {
  const result = text(value);
  if (!result) return null;
  return max ? result.slice(0, max) : result;
}

function date(value: unknown, fallback?: Date) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "number" && value > 0) return new Date(value * 1000);
  if (typeof value === "string" && value && !value.startsWith("0000-00-00")) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return fallback ?? null;
}

function minutes(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? Math.round(numeric * 60) : null;
}

function json(value: unknown) {
  return JSON.stringify(value, (_key, item) => item instanceof Date ? item.toISOString() : typeof item === "bigint" ? Number(item) : item);
}

function checksum(value: unknown) {
  return createHash("sha256").update(json(value)).digest("hex");
}

async function rows(connection: Pool | PoolConnection, sql: string, params: unknown[] = []) {
  const [result] = await connection.query<Row[]>(sql, params);
  return result;
}

async function one(connection: Pool | PoolConnection, sql: string, params: unknown[] = []) {
  return (await rows(connection, sql, params))[0];
}

async function upsert(connection: PoolConnection, table: string, record: Record<string, unknown>, updateColumns?: string[]) {
  const columns = Object.keys(record);
  const updates = (updateColumns ?? columns.filter((column) => column !== "id"))
    .map((column) => `\`${column}\`=VALUES(\`${column}\`)`).join(",");
  await connection.query(
    `INSERT INTO \`${table}\` (${columns.map((column) => `\`${column}\``).join(",")}) VALUES (${columns.map(() => "?").join(",")}) ON DUPLICATE KEY UPDATE ${updates}`,
    columns.map((column) => record[column] ?? null),
  );
}

async function ensureMigrationFoundation(connection: PoolConnection) {
  await connection.query(`CREATE TABLE IF NOT EXISTS migration_runs (
    id VARCHAR(36) NOT NULL PRIMARY KEY, source_system VARCHAR(80) NOT NULL, source_database VARCHAR(80) NOT NULL,
    scope VARCHAR(190) NOT NULL, status VARCHAR(40) NOT NULL, started_at DATETIME NOT NULL, finished_at DATETIME NULL,
    manifest LONGTEXT NULL, summary LONGTEXT NULL, INDEX migration_runs_source_idx (source_system, started_at)
  ) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await connection.query(`CREATE TABLE IF NOT EXISTS legacy_source_records (
    id VARCHAR(36) NOT NULL PRIMARY KEY, source_system VARCHAR(80) NOT NULL, source_table VARCHAR(80) NOT NULL,
    source_id VARCHAR(80) NOT NULL, target_type VARCHAR(80) NOT NULL, target_id VARCHAR(80) NOT NULL,
    raw_data LONGTEXT NOT NULL, checksum VARCHAR(64) NOT NULL, migration_run_id VARCHAR(36) NOT NULL, migrated_at DATETIME NOT NULL,
    UNIQUE INDEX legacy_source_records_source_uq (source_system, source_table, source_id),
    INDEX legacy_source_records_target_idx (target_type, target_id), INDEX legacy_source_records_run_idx (migration_run_id),
    CONSTRAINT legacy_source_records_run_fk FOREIGN KEY (migration_run_id) REFERENCES migration_runs (id)
  ) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await connection.query(`CREATE TABLE IF NOT EXISTS migration_rejections (
    id VARCHAR(36) NOT NULL PRIMARY KEY, migration_run_id VARCHAR(36) NOT NULL, source_table VARCHAR(80) NOT NULL,
    source_id VARCHAR(80) NOT NULL, reason_code VARCHAR(80) NOT NULL, reason TEXT NOT NULL, raw_data LONGTEXT NULL,
    created_at DATETIME NOT NULL, UNIQUE INDEX migration_rejections_record_uq (migration_run_id, source_table, source_id, reason_code),
    INDEX migration_rejections_reason_idx (reason_code),
    CONSTRAINT migration_rejections_run_fk FOREIGN KEY (migration_run_id) REFERENCES migration_runs (id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
}

async function saveRaw(connection: PoolConnection, runId: string, sourceTable: string, sourceId: unknown, targetType: string, targetId: string, raw: Row) {
  await upsert(connection, "legacy_source_records", {
    id: stableId("raw", `${sourceTable}:${sourceId}`), source_system: SOURCE_SYSTEM, source_table: sourceTable,
    source_id: String(sourceId), target_type: targetType, target_id: targetId, raw_data: json(raw),
    checksum: checksum(raw), migration_run_id: runId, migrated_at: new Date(),
  });
}

async function reject(connection: PoolConnection | null, runId: string, table: string, row: Row, code: string, reason: string) {
  if (!connection) return;
  await upsert(connection, "migration_rejections", {
    id: stableId("rejection", `${runId}:${table}:${row.id}:${code}`), migration_run_id: runId,
    source_table: table, source_id: String(row.id), reason_code: code, reason,
    raw_data: json(row), created_at: new Date(),
  });
}

function priority(value: unknown) {
  const id = Number(value);
  if (id === 1 || id === 7 || id === 8) return "CRITICAL";
  if (id === 2 || id === 10) return "HIGH";
  if (id === 3 || id === 9) return "MEDIUM";
  return "LOW";
}

function notificationStatus(value: unknown) {
  return ({ New: "SUBMITTED", Approved: "IN_MAINTENANCE", Reject: "REJECTED", Completed: "READY_TO_CLOSE" } as Record<string, string>)[text(value)] ?? "SUBMITTED";
}

function workOrderStatus(value: unknown, assignedTo?: unknown) {
  if (text(value) === "Open") return assignedTo === null || assignedTo === undefined || text(assignedTo) === "" ? "CREATED" : "ASSIGNED";
  return ({ Backlog: "WAITING_FOR_PARTS", Execute: "IN_PROGRESS", Recheck: "TECHNICIAN_COMPLETED", Completed: "TECHNICIAN_COMPLETED", Closed: "CLOSED" } as Record<string, string>)[text(value)] ?? "CREATED";
}

function taskStatus(value: unknown) {
  return text(value) === "Completed" ? "COMPLETED" : text(value) === "Backlog" ? "BACKLOG" : "OPEN";
}

function workType(value: unknown) {
  return ({ Preventive: "PREVENTIVE", Corrective: "CORRECTIVE", "SD Work": "SHUTDOWN" } as Record<string, string>)[text(value)] ?? "OTHER_ASSIGNMENT";
}

function uniqueCode(raw: unknown, id: unknown, duplicateCodes: Set<string>, reservedCodes: Set<string>, max: number) {
  const original = text(raw, `LEGACY-${id}`);
  let candidate = original.slice(0, max);
  if (duplicateCodes.has(original) || reservedCodes.has(candidate)) {
    const suffix = `~${id}`;
    candidate = `${original.slice(0, max - suffix.length)}${suffix}`;
  }
  reservedCodes.add(candidate);
  return candidate;
}

async function main() {
  const source = mysql.createPool({ uri: sourceUrl, connectionLimit: 4, timezone: "+07:00" });
  const target = mysql.createPool({ uri: targetUrl, connectionLimit: 4, timezone: "+07:00" });
  const targetConnection = apply ? await target.getConnection() : null;
  const runId = randomUUID();
  const summary: Summary = {};
  const warnings: string[] = [];
  const count = (name: string, sourceCount: number) => summary[name] = { source: sourceCount, loaded: 0, rejected: 0 };

  try {
    const sourceVersion = await one(source, "SELECT DATABASE() database_name, VERSION() version");
    const targetVersion = await one(target, "SELECT DATABASE() database_name, VERSION() version");
    if (targetConnection) await ensureMigrationFoundation(targetConnection);
    const sourceTables = Number((await one(source, "SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema=DATABASE()"))?.n ?? 0);
    if (sourceTables < 20) throw new Error(`Source schema is unexpectedly small (${sourceTables} tables)`);
    const requiredTargetTables = ["users", "organizations", "sites", "departments", "asset_types", "asset_categories", "assets", "maintenance_notifications", "notification_reviews", "work_orders", "work_order_tasks", "work_order_completions", "work_order_events", "work_execution_entries", "spare_parts", "work_order_spare_parts"];
    const existingTargetTables = new Set((await rows(target, "SELECT table_name FROM information_schema.tables WHERE table_schema=DATABASE()")) .map((row) => String(row.table_name)));
    const missing = requiredTargetTables.filter((table) => !existingTargetTables.has(table));
    if (missing.length) throw new Error(`Target migrations are missing: ${missing.join(", ")}`);
    if (apply && !existingTargetTables.has("migration_runs")) throw new Error("Apply prisma migration 0005_legacy_migration_foundation before running --apply");

    const assets = await rows(source, "SELECT * FROM asast010 ORDER BY id");
    const assetTypes = await rows(source, "SELECT * FROM asast011 ORDER BY id");
    const assetCategories = await rows(source, "SELECT * FROM asast012 ORDER BY id");
    const hierarchy = await rows(source, "SELECT * FROM asbom010 ORDER BY id");
    const notifications = await rows(source, "SELECT * FROM wonof010 ORDER BY id");
    const reviews = await rows(source, "SELECT * FROM wonof020 ORDER BY wonof010_id, lmdt, id");
    const workOrders = await rows(source, "SELECT * FROM woord010 ORDER BY id");
    const tasks = await rows(source, "SELECT * FROM woord020 ORDER BY woord010_id, id");
    const completions = await rows(source, `SELECT x.*, p.name problem_name, c.name cause_name, s.name solution_name, e.name escalation_name
      FROM woord030 x LEFT JOIN woprm010 p ON p.id=x.woprm010_id LEFT JOIN wocau010 c ON c.id=x.wocau010_id
      LEFT JOIN wosol010 s ON s.id=x.wosol010_id LEFT JOIN woesc010 e ON e.id=x.woesc010_id ORDER BY x.id`);
    const events = await rows(source, "SELECT * FROM woord050 ORDER BY woord010_id, cldt, id");
    const labor = await rows(source, "SELECT * FROM woman010 WHERE woord010_id IS NOT NULL ORDER BY id");
    const materials = await rows(source, `SELECT x.*, i.code item_code, i.name item_name, i.dsca item_description, i.unit item_unit
      FROM woord060 x LEFT JOIN whitm010 i ON i.id=x.whitm010_id ORDER BY x.id`);
    const users = await rows(source, `SELECT u.*, p.name profile_name, p.contact, p.hrdpt010_id, p.enbl profile_enabled
      FROM user u LEFT JOIN user_profiles p ON p.user_id=u.id ORDER BY u.id`);
    const departments = await rows(source, "SELECT * FROM hrdpt010 ORDER BY id");
    const targetUsers = await rows(target, "SELECT id, username, email FROM users");
    const organizations = await rows(target, "SELECT id FROM organizations ORDER BY created_at LIMIT 1");
    const sites = await rows(target, "SELECT id FROM sites ORDER BY created_at LIMIT 1");
    if (!organizations.length || !sites.length || !targetUsers.length) throw new Error("Target requires at least one organization, site, and migration actor user");

    const organizationId = String(organizations[0].id);
    const siteId = String(sites[0].id);
    const migrationActorId = String(targetUsers[0].id);
    const userMap = new Map<number, string>();
    const departmentMap = new Map<number, string>();
    const assetMap = new Map<number, string>();
    const notificationMap = new Map<number, string>();
    const workOrderMap = new Map<number, string>();
    const existingUserByUsername = new Map(targetUsers.map((row) => [text(row.username).toLowerCase(), String(row.id)]));
    const existingUserByEmail = new Map(targetUsers.map((row) => [text(row.email).toLowerCase(), String(row.id)]));
    const existingAssetRows = await rows(target, "SELECT id, code, legacy_source_id FROM assets");
    const existingWorkOrderRows = await rows(target, "SELECT id, code, legacy_id FROM work_orders");
    const reservedAssetCodes = new Set(existingAssetRows.filter((row) => row.legacy_source_id === null).map((row) => text(row.code)));
    const sourceNotificationTargetIds = new Set(notifications.map((row) => stableId("maintenance-notification", row.id)));
    const reservedNotificationCodes = new Set((await rows(target, "SELECT id, code FROM maintenance_notifications"))
      .filter((row) => !sourceNotificationTargetIds.has(String(row.id))).map((row) => text(row.code)));
    const reservedWorkOrderCodes = new Set(existingWorkOrderRows.filter((row) => row.legacy_id === null).map((row) => text(row.code)));
    const duplicateAssetCodes = new Set((await rows(source, "SELECT code FROM asast010 GROUP BY code HAVING COUNT(*) > 1")).map((row) => text(row.code)));
    const duplicateWorkOrderCodes = new Set((await rows(source, "SELECT code FROM woord010 GROUP BY code HAVING COUNT(*) > 1")).map((row) => text(row.code)));
    const reviewByNotification = new Map<number, Row>();
    for (const review of reviews) reviewByNotification.set(Number(review.wonof010_id), review);
    const taskSequence = new Map<number, number>();
    const completionSequence = new Map<number, number>();

    count("users", users.length); count("departments", departments.length); count("asset_types", assetTypes.length);
    count("asset_categories", assetCategories.length); count("assets", assets.length); count("asset_hierarchy", hierarchy.length);
    count("maintenance_notifications", notifications.length); count("notification_reviews", reviewByNotification.size);
    count("work_orders", workOrders.length); count("work_order_tasks", tasks.length); count("work_order_completions", completions.length);
    count("work_order_events", events.length); count("work_execution_entries", labor.length); count("work_order_spare_parts", materials.length);

    if (targetConnection) {
      await targetConnection.beginTransaction();
      await upsert(targetConnection, "migration_runs", {
        id: runId, source_system: SOURCE_SYSTEM, source_database: "nexif", scope: SCOPE, status: "RUNNING",
        started_at: new Date(), finished_at: null, manifest: json({ sourceVersion, targetVersion, sourceTables }), summary: null,
      });
    }

    for (const user of users) {
      const username = limited(user.username, 80, `legacy-${user.id}`);
      const email = limited(user.email, 190, `legacy-${user.id}@migration.invalid`);
      const matched = existingUserByUsername.get(username.toLowerCase()) ?? existingUserByEmail.get(email.toLowerCase());
      const id = matched ?? stableId("user", user.id);
      userMap.set(Number(user.id), id);
      if (targetConnection && !matched) {
        await upsert(targetConnection, "users", {
          id, full_name: limited(user.profile_name, 160, username), username, email,
          password_hash: "!LEGACY_ACCOUNT_REQUIRES_PASSWORD_RESET!", role: "VIEWER",
          status: Number(user.status) === 10 && text(user.profile_enabled) !== "No" ? "ACTIVE" : "INACTIVE",
          admin_notes: `Migrated from NEXIF user ${user.id}; legacy password hash was not migrated.`,
          failed_login_attempts: 0, must_change_password: 1,
          created_at: date(user.created_at, new Date()), updated_at: date(user.updated_at, new Date()),
          created_by: migrationActorId, updated_by: migrationActorId,
        });
        await saveRaw(targetConnection, runId, "user", user.id, "User", id, user);
      }
      summary.users.loaded++;
    }

    for (const department of departments) {
      const id = stableId("department", department.id);
      departmentMap.set(Number(department.id), id);
      if (targetConnection) {
        await upsert(targetConnection, "departments", {
          id, organization_id: organizationId, site_id: siteId, parent_id: null,
          code: `NEXIF-DPT-${department.id}`, name: limited(department.name, 160, `Legacy department ${department.id}`),
          active: text(department.enbl) !== "No", created_at: new Date(), updated_at: new Date(),
        });
        await saveRaw(targetConnection, runId, "hrdpt010", department.id, "Department", id, department);
      }
      summary.departments.loaded++;
    }
    if (targetConnection) {
      for (const department of departments) {
        const parentId = department.parent_id === null ? null : departmentMap.get(Number(department.parent_id)) ?? null;
        const departmentId = departmentMap.get(Number(department.id));
        if (parentId && departmentId) await targetConnection.execute("UPDATE departments SET parent_id=? WHERE id=?", [parentId, departmentId]);
      }
    }

    const fallbackTypeId = stableId("asset-type", 0);
    for (const type of assetTypes) {
      const id = stableId("asset-type", type.id);
      if (targetConnection) await upsert(targetConnection, "asset_types", {
        id, code: `NEXIF-TYPE-${type.id}`, name: limited(type.name, 120, `Legacy type ${type.id}`), description: null,
        active: 1, created_at: new Date(), updated_at: new Date(), created_by: migrationActorId, updated_by: migrationActorId,
      });
      summary.asset_types.loaded++;
    }
    for (const category of assetCategories) {
      const id = stableId("asset-category", category.id);
      if (targetConnection) await upsert(targetConnection, "asset_categories", {
        id, code: `NEXIF-CAT-${category.id}`, name: limited(category.name, 120, `Legacy category ${category.id}`), description: nullable(category.code),
        active: 1, created_at: new Date(), updated_at: new Date(), created_by: migrationActorId, updated_by: migrationActorId,
      });
      summary.asset_categories.loaded++;
    }

    for (const asset of assets) {
      const id = stableId("asset", asset.id);
      assetMap.set(Number(asset.id), id);
      const code = uniqueCode(asset.code, asset.id, duplicateAssetCodes, reservedAssetCodes, 60);
      const name = limited(asset.name, 160, `[Unnamed legacy asset ${asset.id}]`);
      if (!text(asset.name)) warnings.push(`asast010:${asset.id} has no name`);
      if (asset.asast011_id === null) warnings.push(`asast010:${asset.id} uses fallback asset type`);
      if (!text(asset.idbj)) warnings.push(`asast010:${asset.id} uses explicit legacy location placeholder`);
      if (targetConnection) {
        await upsert(targetConnection, "assets", {
          id, code, name, description: nullable(asset.dsca), asset_type_id: asset.asast011_id === null ? fallbackTypeId : stableId("asset-type", asset.asast011_id),
          asset_category_id: asset.asast012_id === null ? null : stableId("asset-category", asset.asast012_id), parent_asset_id: null,
          structure_level: asset.asast010_id === null ? "SYSTEM" : "EQUIPMENT", location: limited(asset.idbj, 190, "LEGACY/UNSPECIFIED"),
          criticality: "MEDIUM", status: text(asset.stat) === "Active" ? "ACTIVE" : "INACTIVE",
          owner_user_id: asset.asto === null ? null : userMap.get(Number(asset.asto)) ?? null, contract_id: null,
          primary_image_path: nullable(asset.pimg, 500), unit: nullable(asset.unit, 45), serial_number: nullable(asset.sn, 45),
          maintenance_interval: asset.invl === null ? null : Number(asset.invl), running_hour_code: nullable(asset.trhc, 45),
          budget_id: asset.fnact040_id === null ? null : String(asset.fnact040_id), gps_coordinates: nullable(asset.gpsc, 90),
          cost_center_legacy_id: asset.fnact010_id === null ? null : Number(asset.fnact010_id),
          budget_reference_legacy_id: asset.fnact040_id === null ? null : Number(asset.fnact040_id),
          inventory_location_legacy_id: asset.whitm012_id === null ? null : Number(asset.whitm012_id), inventory_location_name: null,
          legacy_source_id: Number(asset.id), created_at: date(asset.crdt, new Date()), updated_at: date(asset.lmdt, new Date()),
          created_by: userMap.get(Number(asset.crby)) ?? migrationActorId, updated_by: userMap.get(Number(asset.lmby)) ?? migrationActorId,
        });
        await saveRaw(targetConnection, runId, "asast010", asset.id, "Asset", id, asset);
      }
      summary.assets.loaded++;
    }
    if (targetConnection) {
      for (const asset of assets) {
        const parentId = asset.asast010_id === null ? null : assetMap.get(Number(asset.asast010_id)) ?? null;
        const assetId = assetMap.get(Number(asset.id));
        if (parentId && assetId) await targetConnection.execute("UPDATE assets SET parent_asset_id=? WHERE id=?", [parentId, assetId]);
      }
    }
    for (const link of hierarchy) {
      const assetId = assetMap.get(Number(link.asast010_id));
      if (!assetId) { summary.asset_hierarchy.rejected++; await reject(targetConnection, runId, "asbom010", link, "MISSING_ASSET", "Hierarchy asset was not found"); continue; }
      const id = stableId("asset-hierarchy", link.id);
      if (targetConnection) {
        await upsert(targetConnection, "asset_hierarchy_links", {
          id, sequence: Number(link.seqn) || 10, asset_id: assetId,
          parent_asset_id: link.parent_id === null ? null : assetMap.get(Number(link.parent_id)) ?? null,
          root_asset_id: link.root_id === null ? null : assetMap.get(Number(link.root_id)) ?? null,
          enabled: text(link.enbl) !== "No", quantity: Number(link.qnty) || 1, note: nullable(link.note), legacy_source_id: Number(link.id),
        });
        await saveRaw(targetConnection, runId, "asbom010", link.id, "AssetHierarchyLink", id, link);
      }
      summary.asset_hierarchy.loaded++;
    }

    for (const notification of notifications) {
      const assetId = notification.asast010_id === null ? null : assetMap.get(Number(notification.asast010_id));
      if (!assetId) { summary.maintenance_notifications.rejected++; await reject(targetConnection, runId, "wonof010", notification, "MISSING_ASSET", "Notification has no resolvable asset"); continue; }
      const id = stableId("maintenance-notification", notification.id);
      notificationMap.set(Number(notification.id), id);
      const typeId = Number(notification.wonof011_id);
      const breakdown = text(notification.bkdn) === "Yes";
      const code = uniqueCode(notification.code, notification.id, new Set(), reservedNotificationCodes, 60);
      if (targetConnection) {
        await upsert(targetConnection, "maintenance_notifications", {
          id, code, organization_id: organizationId, site_id: siteId, asset_id: assetId, title: limited(notification.name, 190, code), description: text(notification.dsca),
          type: breakdown ? "BREAKDOWN" : "CORRECTIVE", priority: priority(notification.woord012_id),
          severity: typeId === 2 ? "CRITICAL" : typeId === 1 ? "MAJOR" : "MODERATE",
          equipment_operating_status: typeId === 2 ? "STOPPED" : typeId === 1 ? "DEGRADED" : "UNKNOWN",
          status: notificationStatus(notification.stat), breakdown,
          requested_by: userMap.get(Number(notification.crby)) ?? migrationActorId,
          department_id: null, assigned_person_id: notification.asto === null ? null : userMap.get(Number(notification.asto)) ?? null,
          supervisor_id: null, photo_attachment_ids: null,
          due_at: date(notification.dudt), submitted_at: date(notification.crdt, new Date()), reviewed_at: date(reviewByNotification.get(Number(notification.id))?.lmdt),
          completed_at: text(notification.stat) === "Completed" ? date(notification.lmdt) : null,
          created_at: date(notification.crdt, new Date()), updated_at: date(notification.lmdt, new Date()),
          created_by: userMap.get(Number(notification.crby)) ?? migrationActorId, updated_by: userMap.get(Number(notification.lmby)) ?? migrationActorId,
        });
        await saveRaw(targetConnection, runId, "wonof010", notification.id, "MaintenanceNotification", id, notification);
      }
      summary.maintenance_notifications.loaded++;
      const review = reviewByNotification.get(Number(notification.id));
      if (review) {
        const reviewId = stableId("notification-review", review.id);
        if (targetConnection) {
          await upsert(targetConnection, "notification_reviews", {
            id: reviewId, notification_id: id, decision: text(review.stat) === "Reject" ? "REJECTED" : "APPROVED",
            note: text(review.note) || text(review.dsca) || `[Legacy review ${review.id}]`,
            reviewed_by: userMap.get(Number(review.lmby ?? review.crby)) ?? migrationActorId,
            reviewed_at: date(review.lmdt, date(review.crdt, new Date()) as Date),
          });
          await saveRaw(targetConnection, runId, "wonof020", review.id, "NotificationReview", reviewId, review);
        }
        summary.notification_reviews.loaded++;
      }
    }
    for (const review of reviewByNotification.values()) {
      if (notificationMap.has(Number(review.wonof010_id))) continue;
      summary.notification_reviews.rejected++;
      await reject(targetConnection, runId, "wonof020", review, "MISSING_NOTIFICATION", "Review parent notification was rejected");
    }

    for (const workOrder of workOrders) {
      const assetId = workOrder.asast010_id === null ? null : assetMap.get(Number(workOrder.asast010_id));
      if (!assetId) { summary.work_orders.rejected++; await reject(targetConnection, runId, "woord010", workOrder, "MISSING_ASSET", "Work order has no resolvable asset"); continue; }
      const id = stableId("work-order", workOrder.id);
      workOrderMap.set(Number(workOrder.id), id);
      const candidateNotificationId = workOrder.wonof010_id === null ? null : notificationMap.get(Number(workOrder.wonof010_id)) ?? null;
      const notificationId = candidateNotificationId;
      const code = uniqueCode(workOrder.code, workOrder.id, duplicateWorkOrderCodes, reservedWorkOrderCodes, 60);
      if (targetConnection) {
        await upsert(targetConnection, "work_orders", {
          id, code, organization_id: organizationId, site_id: siteId, notification_id: notificationId, source_type: notificationId ? "NOTIFICATION" : "IMPORT",
          source_record_id: `woord010:${workOrder.id}`, work_type: workType(workOrder.type), asset_id: assetId,
          title: limited(workOrder.dsca, 190, code), description: text(workOrder.dsca), priority: priority(workOrder.woord012_id),
          severity: "MODERATE", equipment_operating_status: "UNKNOWN", status: workOrderStatus(workOrder.stat, workOrder.asto),
          department_id: workOrder.hrdpt010_id === null ? null : departmentMap.get(Number(workOrder.hrdpt010_id)) ?? null,
          crew_name: null, lead_user_id: workOrder.leadby === null ? null : userMap.get(Number(workOrder.leadby)) ?? null,
          vendor_name: workOrder.whvnd010_id === null ? null : `Legacy vendor #${workOrder.whvnd010_id}`,
          customer_name: workOrder.slcus010_id === null ? null : `Legacy customer #${workOrder.slcus010_id}`,
          reporter_name: nullable(workOrder.nfnm, 160), reporter_phone: nullable(workOrder.teln, 60), reported_at: date(workOrder.nfdt),
          planned_start_at: date(workOrder.stdt), planned_finish_at: date(workOrder.endt) ?? date(workOrder.dudt),
          estimated_minutes: minutes(workOrder.estm), actual_finish_at: date(workOrder.cldt), checklist_template_id: null,
          maintenance_template_id: null, notes: nullable(workOrder.note), legacy_id: Number(workOrder.id),
          legacy_type: nullable(workOrder.type, 80), legacy_status: nullable(workOrder.stat, 80),
          backlog_reason: workOrder.woord011_id === null ? null : `Legacy backlog reason #${workOrder.woord011_id}`,
          assigned_to: workOrder.asto === null ? null : userMap.get(Number(workOrder.asto)) ?? null, supervisor_id: null,
          due_at: date(workOrder.dudt), started_at: date(workOrder.stdt), verified_at: null,
          assigned_at: workOrder.asto === null ? null : date(workOrder.crdt, new Date()), assigned_by: workOrder.asto === null ? null : migrationActorId,
          technician_completed_at: ["Recheck", "Completed"].includes(text(workOrder.stat)) ? date(workOrder.cldt) ?? date(workOrder.lmdt) : null,
          closed_at: text(workOrder.stat) === "Closed" ? date(workOrder.cldt) ?? date(workOrder.lmdt) : null,
          created_at: date(workOrder.crdt, new Date()), updated_at: date(workOrder.lmdt, new Date()),
          created_by: userMap.get(Number(workOrder.crby)) ?? migrationActorId, updated_by: userMap.get(Number(workOrder.lmby)) ?? migrationActorId,
        });
        const assignedUserId = workOrder.asto === null ? null : userMap.get(Number(workOrder.asto)) ?? null;
        if (assignedUserId) await upsert(targetConnection, "work_order_assignments", { id: stableId("work-order-assignment", workOrder.id), work_order_id: id, department_id: workOrder.hrdpt010_id === null ? null : departmentMap.get(Number(workOrder.hrdpt010_id)) ?? null, user_id: assignedUserId, team_name: null, position_name: null, assignment_type: "TECHNICIAN", assigned_at: date(workOrder.crdt, new Date()), ended_at: null, assigned_by: migrationActorId, note: "Baseline assignment migrated from NEXIF" });
        await saveRaw(targetConnection, runId, "woord010", workOrder.id, "WorkOrder", id, workOrder);
      }
      summary.work_orders.loaded++;
    }

    for (const task of tasks) {
      const workOrderId = workOrderMap.get(Number(task.woord010_id));
      if (!workOrderId) { summary.work_order_tasks.rejected++; await reject(targetConnection, runId, "woord020", task, "MISSING_WORK_ORDER", "Task parent work order was rejected"); continue; }
      const sequence = (taskSequence.get(Number(task.woord010_id)) ?? 0) + 10;
      taskSequence.set(Number(task.woord010_id), sequence);
      const id = stableId("work-order-task", task.id);
      if (targetConnection) {
        await upsert(targetConnection, "work_order_tasks", {
          id, work_order_id: workOrderId, sequence, title: limited(task.name, 190, text(task.code, `Task ${task.id}`)),
          description: nullable(task.note) ?? nullable(task.name), required: 1, kind: "JOB_STEP", status: taskStatus(task.stat),
          assigned_to: task.asto === null ? null : userMap.get(Number(task.asto)) ?? null,
          asset_id: task.asast010_id === null ? null : assetMap.get(Number(task.asast010_id)) ?? null,
          due_at: date(task.dudt), estimated_minutes: minutes(task.estm), actual_minutes: minutes(task.sptm),
          result: nullable(task.resl), notes: nullable(task.note), response_type: nullable(task.type, 40), response_value: null,
          remarks: null, evidence_attachment_id: null, legacy_id: Number(task.id), completed_by: null,
          completed_at: text(task.stat) === "Completed" ? date(task.dudt) : null, created_at: new Date(), updated_at: new Date(),
        });
        await saveRaw(targetConnection, runId, "woord020", task.id, "WorkOrderTask", id, task);
      }
      summary.work_order_tasks.loaded++;
    }

    for (const completion of completions) {
      const workOrderId = workOrderMap.get(Number(completion.woord010_id));
      if (!workOrderId) { summary.work_order_completions.rejected++; await reject(targetConnection, runId, "woord030", completion, "MISSING_WORK_ORDER", "Completion parent work order was rejected"); continue; }
      const id = stableId("work-order-completion", completion.id);
      const revisionNumber = (completionSequence.get(Number(completion.woord010_id)) ?? 0) + 1;
      completionSequence.set(Number(completion.woord010_id), revisionNumber);
      if (targetConnection) {
        await upsert(targetConnection, "work_order_completions", {
          id, work_order_id: workOrderId, revision_number: revisionNumber, result: limited(completion.name, 190, `Legacy completion ${completion.id}`),
          problem: nullable(completion.problem_name), cause: nullable(completion.cause_name),
          solution: text(completion.solution_name) || text(completion.note) || `[Not specified in legacy completion ${completion.id}]`,
          escalation: nullable(completion.escalation_name), notes: nullable(completion.note), duration_minutes: minutes(completion.sptm) ?? 0,
          before_photo_attachment_ids: null, after_photo_attachment_ids: null,
          completed_by: userMap.get(Number(completion.clby)) ?? migrationActorId,
          completed_at: date(completion.cldt, new Date()), created_at: date(completion.cldt, new Date()),
        });
        await saveRaw(targetConnection, runId, "woord030", completion.id, "WorkOrderCompletion", id, completion);
      }
      summary.work_order_completions.loaded++;
    }

    for (const event of events) {
      const workOrderId = workOrderMap.get(Number(event.woord010_id));
      if (!workOrderId) { summary.work_order_events.rejected++; await reject(targetConnection, runId, "woord050", event, "MISSING_WORK_ORDER", "Event parent work order was rejected"); continue; }
      const id = stableId("work-order-event", event.id);
      if (targetConnection) {
        await upsert(targetConnection, "work_order_events", {
          id, work_order_id: workOrderId, event_type: limited(event.stat, 60, "LEGACY_EVENT"), from_status: null,
          to_status: workOrderStatus(event.stat), note: nullable(event.note) ?? nullable(event.name),
          actor_user_id: userMap.get(Number(event.clby)) ?? migrationActorId, created_at: date(event.cldt, new Date()),
        });
        await saveRaw(targetConnection, runId, "woord050", event.id, "WorkOrderEvent", id, event);
      }
      summary.work_order_events.loaded++;
    }

    for (const entry of labor) {
      const workOrderId = workOrderMap.get(Number(entry.woord010_id));
      if (!workOrderId) { summary.work_execution_entries.rejected++; await reject(targetConnection, runId, "woman010", entry, "MISSING_WORK_ORDER", "Labor parent work order was rejected"); continue; }
      const id = stableId("work-execution-entry", entry.id);
      if (targetConnection) {
        await upsert(targetConnection, "work_execution_entries", {
          id, work_order_id: workOrderId, description: text(entry.dsca) || text(entry.note) || `Legacy labor entry ${entry.id}`,
          department_id: departmentMap.get(Number(entry.hrdpt010_id)) ?? null,
          employee_id: entry.asto === null ? null : userMap.get(Number(entry.asto)) ?? null,
          position_name: entry.hrpos010_id === null ? null : `Legacy position #${entry.hrpos010_id}`,
          work_type: nullable(entry.type, 80), minutes_spent: minutes(entry.amount) ?? 0,
          overtime_minutes: text(entry.othr) === "Yes" ? minutes(entry.amount) ?? 0 : 0,
          overtime_multiplier: text(entry.othr) === "Yes" ? 1.5 : 1,
          action_at: date(entry.acdt, new Date()), actor_user_id: userMap.get(Number(entry.crby)) ?? migrationActorId,
          created_at: date(entry.crdt, new Date()),
        });
        await saveRaw(targetConnection, runId, "woman010", entry.id, "WorkExecutionEntry", id, entry);
      }
      summary.work_execution_entries.loaded++;
    }

    for (const material of materials) {
      const workOrderId = workOrderMap.get(Number(material.woord010_id));
      if (!workOrderId || !material.item_code) { summary.work_order_spare_parts.rejected++; await reject(targetConnection, runId, "woord060", material, !workOrderId ? "MISSING_WORK_ORDER" : "MISSING_SPARE_PART", "Material relation could not be resolved"); continue; }
      const sparePartId = stableId("spare-part", material.whitm010_id);
      if (targetConnection) {
        await upsert(targetConnection, "spare_parts", {
          id: sparePartId, code: limited(material.item_code, 80, `LEGACY-PART-${material.whitm010_id}`),
          name: limited(material.item_name, 190, `Legacy part ${material.whitm010_id}`), description: nullable(material.item_description),
          unit: nullable(material.item_unit, 45), available_quantity: null, legacy_source_id: Number(material.whitm010_id),
        });
        const id = stableId("work-order-spare-part", material.id);
        await upsert(targetConnection, "work_order_spare_parts", {
          id, work_order_id: workOrderId, spare_part_id: sparePartId, quantity: Number(material.qnty) || 0,
          transaction_type: text(material.enbl) === "Yes" ? "CONSUMED" : "PLANNED", warehouse: null,
          storage_location: null, unit_snapshot: nullable(material.item_unit, 40), reference_document: null,
          note: nullable(material.note), used_by: migrationActorId, used_at: new Date(),
        });
        await saveRaw(targetConnection, runId, "woord060", material.id, "WorkOrderSparePart", id, material);
      }
      summary.work_order_spare_parts.loaded++;
    }

    const manifest = { source: sourceVersion, target: targetVersion, scope: SCOPE, statusMappings: {
      notification: { New: "NEW", Approved: "APPROVED", Reject: "REJECTED", Completed: "COMPLETED" },
      workOrder: { Open: "OPEN", Backlog: "BACKLOG", Execute: "IN_PROGRESS", Recheck: "COMPLETION_PENDING", Completed: "CLOSED", Closed: "CLOSED" },
    }, explicitPlaceholders: { assetLocation: "LEGACY/UNSPECIFIED", missingAssetType: "NEXIF-TYPE-0" } };
    if (targetConnection) {
      await targetConnection.execute("UPDATE migration_runs SET status='COMPLETED', finished_at=?, manifest=?, summary=? WHERE id=?", [new Date(), json(manifest), json({ summary, warnings: warnings.length }), runId]);
      await targetConnection.commit();
    }
    console.log(json({ mode: apply ? "APPLY" : "DRY_RUN", runId: apply ? runId : null, manifest, summary, warningCount: warnings.length, warningSamples: warnings.slice(0, 20) }));
  } catch (error) {
    if (targetConnection) await targetConnection.rollback();
    throw error;
  } finally {
    targetConnection?.release();
    await source.end();
    await target.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : "Migration failed");
  process.exit(1);
});
