import "dotenv/config";
import { createHash, randomUUID } from "node:crypto";
import mysql, { type Connection, type RowDataPacket } from "mysql2/promise";
import { Prisma } from "../generated/prisma/client";

type Row = RowDataPacket & Record<string, unknown>;
type DocumentKind = "receipts" | "issues" | "transfers";
type SummaryEntry = { source: number; selected: number; loaded: number; rejected: number };
type Summary = Record<string, SummaryEntry>;
type Rejection = { sourceTable: string; sourceId: string; reasonCode: string; reason: string; raw: unknown };
type ReceiptCandidate = { lineId: string; remaining: Prisma.Decimal };

const execute = process.argv.includes("--execute");
const allRows = process.argv.includes("--all");
const migrationActorId = "00000000-0000-5000-8000-000000000099";
const sampleItemLimit = allRows ? Number.MAX_SAFE_INTEGER : numberOption("INVENTORY_SAMPLE_ITEMS", 250);
const sampleVendorLimit = allRows ? Number.MAX_SAFE_INTEGER : numberOption("INVENTORY_SAMPLE_VENDORS", 50);
const sampleDocumentLimit = allRows ? Number.MAX_SAFE_INTEGER : numberOption("INVENTORY_SAMPLE_DOCUMENTS_PER_TYPE", 25);

const rawSourceUrl = process.env.OLD_DATABASE_URL ?? process.env.SOURCE_DATABASE_URL;
const targetUrl = process.env.TARGET_DATABASE_URL ?? process.env.DEV_DATABASE_URL ?? process.env.DATABASE_URL;

function numberOption(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function databaseName(uri: string) {
  return decodeURIComponent(new URL(uri).pathname.slice(1));
}

function sourceUri(uri: string) {
  const database = process.env.OLD_DATABASE_SCHEMA;
  if (!database) return uri;
  const parsed = new URL(uri);
  parsed.pathname = `/${database}`;
  return parsed.toString();
}

function text(value: unknown, fallback = "") {
  return value === null || value === undefined ? fallback : String(value).trim();
}

function nullable(value: unknown, max = 10000) {
  const result = text(value);
  return result ? result.slice(0, max) : null;
}

function decimal(value: unknown, fallback = "0") {
  const result = text(value).replaceAll(",", "");
  if (!/^-?(?:\d+(?:\.\d+)?|\.\d+)$/.test(result)) return fallback;
  return new Prisma.Decimal(result).toFixed(6);
}

function nullableDecimal(value: unknown) {
  const result = text(value).replaceAll(",", "");
  if (!result || !/^-?(?:\d+(?:\.\d+)?|\.\d+)$/.test(result)) return null;
  return new Prisma.Decimal(result).toFixed(6);
}

function amount(quantity: string, unitCost: string) {
  return new Prisma.Decimal(quantity).times(unitCost).toFixed(6);
}

function date(value: unknown, fallback = new Date()) {
  const parsed = value instanceof Date ? value : new Date(text(value));
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function stableId(namespace: string, value: unknown) {
  const bytes = createHash("sha256").update(`OLD:${namespace}:${String(value)}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function positive(value: unknown) {
  const result = new Prisma.Decimal(decimal(value));
  return result.gt(0) ? result.toFixed(6) : null;
}

function identifier(value: string) {
  if (!/^[A-Za-z0-9_]+$/.test(value)) throw new Error(`Unsafe identifier: ${value}`);
  return `\`${value}\``;
}

async function rows(connection: Connection, sql: string, params: unknown[] = []) {
  const [result] = await connection.query<Row[]>(sql, params);
  return result;
}

async function upsert(connection: Connection, table: string, record: Record<string, unknown>) {
  const columns = Object.keys(record);
  const quoted = columns.map(identifier).join(",");
  const updates = columns.filter((column) => column !== "id").map((column) => `${identifier(column)}=VALUES(${identifier(column)})`).join(",");
  await connection.query(`INSERT INTO ${identifier(table)} (${quoted}) VALUES (${columns.map(() => "?").join(",")}) ON DUPLICATE KEY UPDATE ${updates}`, columns.map((column) => record[column] ?? null));
}

async function ensureFoundation(connection: Connection) {
  await connection.query(`CREATE TABLE IF NOT EXISTS migration_runs (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    source_system VARCHAR(80) NOT NULL,
    source_database VARCHAR(80) NOT NULL,
    scope VARCHAR(190) NOT NULL,
    status VARCHAR(40) NOT NULL,
    started_at DATETIME NOT NULL,
    finished_at DATETIME NULL,
    manifest LONGTEXT NULL,
    summary LONGTEXT NULL,
    INDEX migration_runs_source_idx (source_system, started_at)
  ) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await connection.query(`CREATE TABLE IF NOT EXISTS migration_rejections (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    migration_run_id VARCHAR(36) NOT NULL,
    source_table VARCHAR(80) NOT NULL,
    source_id VARCHAR(80) NOT NULL,
    reason_code VARCHAR(80) NOT NULL,
    reason TEXT NOT NULL,
    raw_data LONGTEXT NULL,
    created_at DATETIME NOT NULL,
    UNIQUE INDEX migration_rejections_record_uq (migration_run_id, source_table, source_id, reason_code),
    INDEX migration_rejections_reason_idx (reason_code),
    CONSTRAINT migration_rejections_run_fk FOREIGN KEY (migration_run_id) REFERENCES migration_runs (id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
}

function initSummary(): Summary {
  return {
    stockItems: { source: 0, selected: 0, loaded: 0, rejected: 0 },
    locations: { source: 0, selected: 0, loaded: 0, rejected: 0 },
    vendors: { source: 0, selected: 0, loaded: 0, rejected: 0 },
    balances: { source: 0, selected: 0, loaded: 0, rejected: 0 },
    receipts: { source: 0, selected: 0, loaded: 0, rejected: 0 },
    issues: { source: 0, selected: 0, loaded: 0, rejected: 0 },
    transfers: { source: 0, selected: 0, loaded: 0, rejected: 0 },
  };
}

function chooseCode(raw: unknown, prefix: string, sourceId: string, codes: Set<string>, existingByLegacy: Map<string, string>) {
  const existing = existingByLegacy.get(sourceId);
  if (existing) return existing;
  const candidate = nullable(raw, 80) ?? `${prefix}-${sourceId}`;
  const code = codes.has(candidate) ? `${prefix}-${sourceId}`.slice(0, 80) : candidate;
  codes.add(code);
  existingByLegacy.set(sourceId, code);
  return code;
}

async function targetCodeRegistry(connection: Connection | null, table: string) {
  if (!connection) return { codes: new Set<string>(), existingByLegacy: new Map<string, string>() };
  const result = await rows(connection, `SELECT code, legacy_source_id FROM ${identifier(table)}`);
  return {
    codes: new Set(result.map((row) => text(row.code))),
    existingByLegacy: new Map(result.filter((row) => row.legacy_source_id !== null).map((row) => [text(row.legacy_source_id), text(row.code)])),
  };
}

function selectDocuments(kind: DocumentKind, headers: Row[], details: Row[], itemIds: Set<string>, locationIds: Set<string>, limit: number, summary: Summary) {
  const parentField = kind === "receipts" ? "whitm040_id" : kind === "issues" ? "whitm030_id" : "whitm050_id";
  const groups = new Map<string, Row[]>();
  for (const detail of details) {
    const itemId = text(detail.whitm010_id);
    if (!itemIds.has(itemId) || !positive(detail.qnty)) continue;
    const parentId = text(detail[parentField]);
    const current = groups.get(parentId) ?? [];
    current.push(detail);
    groups.set(parentId, current);
  }
  const selected = headers
    .filter((header) => header.stat === "Completed" && groups.has(text(header.id)))
    .filter((header) => {
      const locationId = text(header.whitm012_id);
      const destinationId = text(header.whitm012_id2);
      return locationIds.has(locationId) && (kind !== "transfers" || !destinationId || locationIds.has(destinationId));
    })
    .sort((left, right) => date(left.acdt).getTime() - date(right.acdt).getTime())
    .slice(0, limit)
    .map((header) => ({ kind, header, details: groups.get(text(header.id)) ?? [] }));
  summary[kind].selected = selected.length;
  return selected;
}

function sourceDocumentNumber(kind: DocumentKind, header: Row) {
  const prefix = kind === "receipts" ? "REC" : kind === "issues" ? "ISS" : "TRF";
  const sourceCode = nullable(header.code, 45) ?? text(header.id);
  return `OLD-${prefix}-${sourceCode}-${text(header.id)}`.slice(0, 80);
}

function documentType(kind: DocumentKind) {
  return kind === "receipts" ? "RECEIPT" : kind === "issues" ? "ISSUE" : "TRANSFER";
}

function movementBase(input: {
  id: string;
  movementType: "ISSUE" | "RECEIPT" | "TRANSFER_OUT" | "TRANSFER_IN";
  documentId: string;
  documentNumber: string;
  lineId: string;
  itemId: string;
  locationId: string;
  sourceLocationId: string | null;
  destinationLocationId: string | null;
  quantity: string;
  unitCost: string;
  postedAt: Date;
  sourceReceiptLineId?: string | null;
}) {
  const quantity = new Prisma.Decimal(input.quantity);
  const unitCost = new Prisma.Decimal(input.unitCost);
  const value = quantity.times(unitCost).toFixed(6);
  const isIn = input.movementType === "RECEIPT" || input.movementType === "TRANSFER_IN";
  return {
    id: input.id,
    movement_type: input.movementType,
    document_id: input.documentId,
    document_number: input.documentNumber,
    line_id: input.lineId,
    stock_item_id: input.itemId,
    location_id: input.locationId,
    source_location_id: input.sourceLocationId,
    destination_location_id: input.destinationLocationId,
    quantity_in: isIn ? input.quantity : "0",
    quantity_out: isIn ? "0" : input.quantity,
    quantity_before: isIn ? "0" : input.quantity,
    quantity_after: isIn ? input.quantity : "0",
    unit_cost: input.unitCost,
    amount_in: isIn ? value : "0",
    amount_out: isIn ? "0" : value,
    value_before: isIn ? "0" : value,
    value_after: isIn ? value : "0",
    moving_average_cost_before: input.unitCost,
    moving_average_cost_after: input.unitCost,
    vendor_id: null,
    work_order_id: null,
    stock_count_id: null,
    source_receipt_line_id: input.sourceReceiptLineId ?? null,
    posted_by: migrationActorId,
    posted_at: input.postedAt,
  };
}

async function main() {
  if (process.argv.includes("--help")) {
    console.log("npm run migrate:old-inventory-sample -- [--execute|--all]");
    console.log("Defaults: 250 items, 50 vendors, and 25 completed documents per type.");
    console.log("Set OLD_DATABASE_SCHEMA=nexif when OLD_DATABASE_URL points at the legacy server without a database grant.");
    return;
  }
  if (!rawSourceUrl) throw new Error("OLD_DATABASE_URL or SOURCE_DATABASE_URL is required");
  if (!targetUrl) throw new Error("TARGET_DATABASE_URL, DEV_DATABASE_URL or DATABASE_URL is required");
  const sourceConnection = await mysql.createConnection({ uri: sourceUri(rawSourceUrl), timezone: "Z" });
  const targetConnection = execute ? await mysql.createConnection({ uri: targetUrl, timezone: "Z" }) : null;
  const sourceDatabase = databaseName(sourceUri(rawSourceUrl));
  const runId = randomUUID();
  const summary = initSummary();
  const rejections: Rejection[] = [];
  const now = new Date();
  const itemMap = new Map<string, string>();
  const itemCost = new Map<string, string>();
  const itemUnit = new Map<string, string>();
  const itemVendor = new Map<string, string>();
  const locationMap = new Map<string, string>();
  const vendorMap = new Map<string, string>();
  const receiptCandidates = new Map<string, ReceiptCandidate[]>();
  const reject = (name: string, row: Row, reasonCode: string, reason: string) => {
    summary[name].rejected += 1;
    rejections.push({ sourceTable: name, sourceId: text(row.id), reasonCode, reason, raw: row });
  };
  let inTransaction = false;

  try {
    const [categoryRows, rawItems, rawLocations, rawVendors, rawBalances, receiptHeaders, receiptDetails, issueHeaders, issueDetails, transferHeaders, transferDetails] = await Promise.all([
      rows(sourceConnection, "SELECT id, name FROM whitm011"),
      rows(sourceConnection, "SELECT * FROM whitm010 ORDER BY id"),
      rows(sourceConnection, "SELECT * FROM whitm012 ORDER BY id"),
      rows(sourceConnection, "SELECT * FROM whvnd010 ORDER BY id"),
      rows(sourceConnection, "SELECT * FROM whinv010 ORDER BY id"),
      rows(sourceConnection, "SELECT * FROM whitm040 ORDER BY acdt, id"),
      rows(sourceConnection, "SELECT * FROM whitm042 ORDER BY id"),
      rows(sourceConnection, "SELECT * FROM whitm030 ORDER BY acdt, id"),
      rows(sourceConnection, "SELECT * FROM whitm032 ORDER BY id"),
      rows(sourceConnection, "SELECT * FROM whitm050 ORDER BY acdt, id"),
      rows(sourceConnection, "SELECT * FROM whitm052 ORDER BY id"),
    ]);
    const categories = new Map(categoryRows.map((row) => [text(row.id), nullable(row.name, 120)]));
    const validItems = rawItems.filter((row) => text(row.name));
    const validItemIds = new Set(validItems.map((row) => text(row.id)));
    const transactionDetailGroups = [receiptDetails, issueDetails, transferDetails, rawBalances];
    const selectedItemIds = new Set<string>();
    const groupQuota = allRows ? Number.MAX_SAFE_INTEGER : Math.max(1, Math.floor(sampleItemLimit / transactionDetailGroups.length));
    for (const group of transactionDetailGroups) {
      let groupSelected = 0;
      for (const row of group) {
        if (selectedItemIds.size >= sampleItemLimit || groupSelected >= groupQuota) break;
        const id = text(row.whitm010_id);
        if (validItemIds.has(id) && !selectedItemIds.has(id)) {
          selectedItemIds.add(id);
          groupSelected += 1;
        }
      }
    }
    for (const row of validItems) {
      if (selectedItemIds.size >= sampleItemLimit) break;
      selectedItemIds.add(text(row.id));
    }
    const selectedItems = validItems.filter((row) => selectedItemIds.has(text(row.id)));
    const selectedLocations = rawLocations.slice(0, allRows ? rawLocations.length : 20);
    const referencedVendorIds = new Set(selectedItems.map((row) => text(row.whvnd010_id)).filter(Boolean));
    const selectedVendors = rawVendors.filter((row) => text(row.name)).filter((row, index) => index < sampleVendorLimit || referencedVendorIds.has(text(row.id)));
    const selectedLocationIds = new Set(selectedLocations.map((row) => text(row.id)));
    const selectedBalances = rawBalances.filter((row) => selectedItemIds.has(text(row.whitm010_id)) && selectedLocationIds.has(text(row.whitm012_id)));
    const documents = [
      ...selectDocuments("receipts", receiptHeaders, receiptDetails, selectedItemIds, selectedLocationIds, sampleDocumentLimit, summary),
      ...selectDocuments("issues", issueHeaders, issueDetails, selectedItemIds, selectedLocationIds, sampleDocumentLimit, summary),
      ...selectDocuments("transfers", transferHeaders, transferDetails, selectedItemIds, selectedLocationIds, sampleDocumentLimit, summary),
    ];
    summary.stockItems = { source: rawItems.length, selected: selectedItems.length, loaded: 0, rejected: 0 };
    summary.locations = { source: rawLocations.length, selected: selectedLocations.length, loaded: 0, rejected: 0 };
    summary.vendors = { source: rawVendors.length, selected: selectedVendors.length, loaded: 0, rejected: 0 };
    summary.balances = { source: rawBalances.length, selected: selectedBalances.length, loaded: 0, rejected: 0 };
    summary.receipts.source = receiptHeaders.length;
    summary.issues.source = issueHeaders.length;
    summary.transfers.source = transferHeaders.length;
    const targetRegistries = {
      stockItems: await targetCodeRegistry(targetConnection, "stock_items"),
      locations: await targetCodeRegistry(targetConnection, "inventory_locations"),
      vendors: await targetCodeRegistry(targetConnection, "vendors"),
    };
    if (targetConnection) {
      await ensureFoundation(targetConnection);
      await targetConnection.query("INSERT INTO migration_runs (id, source_system, source_database, scope, status, started_at, manifest) VALUES (?, 'OLD', ?, 'inventory-sample', 'RUNNING', NOW(), ?)", [runId, sourceDatabase, JSON.stringify({ sampleItemLimit, sampleVendorLimit, sampleDocumentLimit })]);
      await targetConnection.beginTransaction();
      inTransaction = true;
    }

    for (const row of selectedItems) {
      const sourceId = text(row.id);
      if (!sourceId || !text(row.name)) {
        reject("stockItems", row, "REQUIRED_FIELD", "Stock item id and name are required");
        continue;
      }
      const id = stableId("stock-item", sourceId);
      const cost = decimal(row.cost);
      itemMap.set(sourceId, id);
      itemCost.set(sourceId, cost);
      itemUnit.set(sourceId, nullable(row.unit, 45) ?? "EA");
      if (text(row.whvnd010_id)) itemVendor.set(sourceId, text(row.whvnd010_id));
      if (targetConnection) await upsert(targetConnection, "stock_items", {
        id,
        code: chooseCode(row.code, "OLD-STK", sourceId, targetRegistries.stockItems.codes, targetRegistries.stockItems.existingByLegacy),
        name: text(row.name).slice(0, 190),
        description: nullable(row.dsca),
        category: categories.get(text(row.whitm011_id)) ?? null,
        unit: itemUnit.get(sourceId),
        manufacturer: null,
        part_number: nullable(row.purcode, 120),
        barcode: nullable(row.vnmc, 160),
        minimum_stock: decimal(row.rlvl),
        maximum_stock: nullableDecimal(row.mxvl),
        reorder_point: nullableDecimal(row.dreo),
        default_unit_cost: cost,
        moving_average_cost: cost,
        main_location_id: null,
        critical_spare_part: false,
        active: text(row.stat) !== "In-Active",
        remark: "Imported sample from OLD_DATABASE_URL",
        legacy_source_id: Number(sourceId) || null,
        created_at: date(row.crdt, now),
        updated_at: now,
        created_by: migrationActorId,
        updated_by: migrationActorId,
      });
      summary.stockItems.loaded += 1;
    }

    for (const row of selectedLocations) {
      const sourceId = text(row.id);
      if (!sourceId || !text(row.name)) {
        reject("locations", row, "REQUIRED_FIELD", "Location id and name are required");
        continue;
      }
      const id = stableId("location", sourceId);
      locationMap.set(sourceId, id);
      if (targetConnection) await upsert(targetConnection, "inventory_locations", {
        id,
        code: chooseCode(undefined, "OLD-LOC", sourceId, targetRegistries.locations.codes, targetRegistries.locations.existingByLegacy),
        name: text(row.name).slice(0, 190),
        plant: null,
        warehouse: text(row.name).slice(0, 120),
        zone: null,
        rack: null,
        shelf: null,
        bin: null,
        responsible_person_id: null,
        description: nullable(row.dsca) ?? nullable(row.addr),
        active: true,
        legacy_source_id: Number(sourceId) || null,
        created_at: now,
        updated_at: now,
        created_by: migrationActorId,
        updated_by: migrationActorId,
      });
      summary.locations.loaded += 1;
    }

    for (const row of selectedVendors) {
      const sourceId = text(row.id);
      if (!sourceId || !text(row.name)) {
        reject("vendors", row, "REQUIRED_FIELD", "Vendor id and name are required");
        continue;
      }
      const id = stableId("vendor", sourceId);
      vendorMap.set(sourceId, id);
      if (targetConnection) await upsert(targetConnection, "vendors", {
        id,
        code: chooseCode(row.code, "OLD-VND", sourceId, targetRegistries.vendors.codes, targetRegistries.vendors.existingByLegacy),
        name: text(row.name).slice(0, 190),
        tax_id: nullable(row.tax, 80),
        address: nullable(row.addr),
        country: null,
        province: null,
        phone: nullable(row.teln, 80),
        email: nullable(row.emal, 190),
        website: null,
        payment_terms: null,
        delivery_terms: null,
        lead_time: null,
        preferred_vendor: false,
        active: true,
        remark: "Imported sample from OLD_DATABASE_URL",
        legacy_source_id: Number(sourceId) || null,
        created_at: now,
        updated_at: now,
        created_by: migrationActorId,
        updated_by: migrationActorId,
      });
      summary.vendors.loaded += 1;
    }

    for (const row of selectedBalances) {
      const sourceId = text(row.id);
      const itemId = itemMap.get(text(row.whitm010_id));
      const locationId = locationMap.get(text(row.whitm012_id));
      if (!sourceId || !itemId || !locationId) {
        reject("balances", row, "MISSING_REFERENCE", "Balance requires a mapped item and location");
        continue;
      }
      const quantity = positive(row.uins) ?? "0";
      const cost = itemCost.get(text(row.whitm010_id)) ?? "0";
      const movementId = stableId("opening-movement", sourceId);
      if (targetConnection) {
        await upsert(targetConnection, "stock_item_locations", { id: stableId("item-location", `${itemId}:${locationId}`), stock_item_id: itemId, location_id: locationId, created_at: now });
        await upsert(targetConnection, "inventory_balances", { id: stableId("balance", sourceId), stock_item_id: itemId, location_id: locationId, quantity_on_hand: quantity, reserved_quantity: "0", moving_average_cost: cost, last_movement_date: date(row.lsdt, now), created_at: now, updated_at: now });
        await upsert(targetConnection, "inventory_movements", { id: movementId, movement_type: "RECEIPT", document_id: null, document_number: `OLD-OPENING-${sourceId}`.slice(0, 80), line_id: null, stock_item_id: itemId, location_id: locationId, source_location_id: null, destination_location_id: locationId, quantity_in: quantity, quantity_out: "0", quantity_before: "0", quantity_after: quantity, unit_cost: cost, amount_in: amount(quantity, cost), amount_out: "0", value_before: "0", value_after: amount(quantity, cost), moving_average_cost_before: cost, moving_average_cost_after: cost, vendor_id: null, work_order_id: null, stock_count_id: null, source_receipt_line_id: null, posted_by: migrationActorId, posted_at: date(row.lsdt, now) });
      }
      summary.balances.loaded += 1;
    }

    for (const document of documents) {
      const { kind, header } = document;
      const documentId = stableId(`document-${kind}`, header.id);
      const documentNumber = sourceDocumentNumber(kind, header);
      const documentDate = date(header.acdt, now);
      if (targetConnection) await upsert(targetConnection, "inventory_documents", {
        id: documentId,
        document_type: documentType(kind),
        document_number: documentNumber,
        document_date: documentDate,
        site_id: null,
        requester_id: migrationActorId,
        department_id: null,
        purpose: nullable(header.name) ?? `Imported ${kind} sample`,
        reference_work_order_id: null,
        reference_notification_id: null,
        status: "POSTED",
        current_approval_step: null,
        remark: `Imported sample from OLD_DATABASE_URL (${sourceDatabase})`,
        submitted_at: documentDate,
        posted_at: documentDate,
        posted_by: migrationActorId,
        posting_transaction_id: stableId("posting", `${kind}:${header.id}`),
        created_at: documentDate,
        updated_at: now,
        created_by: migrationActorId,
        updated_by: migrationActorId,
      });
      let lineNumber = 0;
      let loadedLines = 0;
      for (const detail of document.details) {
        const sourceItemId = text(detail.whitm010_id);
        const itemId = itemMap.get(sourceItemId);
        const quantity = positive(detail.qnty);
        const itemLocationId = locationMap.get(text(header.whitm012_id));
        const transferDestinationId = kind === "transfers" ? locationMap.get(text(header.whitm012_id2)) ?? [...locationMap.entries()].find(([id]) => id !== text(header.whitm012_id))?.[1] ?? null : null;
        if (!itemId || !quantity || !itemLocationId || (kind === "transfers" && !transferDestinationId)) {
          reject(kind, detail, "INVALID_LINE", "Inventory detail is missing a mapped item, location or positive quantity");
          continue;
        }
        const lineId = stableId(`line-${kind}`, detail.id);
        const unitCost = kind === "receipts" ? decimal(detail.pric, itemCost.get(sourceItemId) ?? "0") : itemCost.get(sourceItemId) ?? "0";
        const vendorId = kind === "receipts" ? vendorMap.get(itemVendor.get(sourceItemId) ?? "") ?? null : null;
        const sourceReceipt = kind === "issues" ? receiptCandidates.get(`${itemId}:${itemLocationId}`)?.find((candidate) => candidate.remaining.gt(0)) : undefined;
        if (sourceReceipt) {
          sourceReceipt.remaining = sourceReceipt.remaining.minus(quantity);
          if (sourceReceipt.remaining.lt(0)) sourceReceipt.remaining = new Prisma.Decimal(0);
        }
        lineNumber += 1;
        if (targetConnection) await upsert(targetConnection, "inventory_document_lines", {
          id: lineId,
          document_id: documentId,
          line_number: lineNumber,
          stock_item_id: itemId,
          source_location_id: kind === "receipts" ? null : itemLocationId,
          destination_location_id: kind === "issues" ? null : kind === "transfers" ? transferDestinationId : itemLocationId,
          requested_quantity: quantity,
          approved_quantity: quantity,
          rejected_quantity: "0",
          unit: itemUnit.get(sourceItemId) ?? "EA",
          unit_cost: unitCost,
          total_amount: amount(quantity, unitCost),
          vendor_id: vendorId,
          purchase_order_reference: null,
          expected_delivery_date: null,
          actual_delivery_date: kind === "receipts" ? documentDate : null,
          work_order_id: null,
          job_step_id: null,
          source_receipt_line_id: sourceReceipt?.lineId ?? null,
          remark: "Imported sample line",
        });
        if (kind === "receipts") {
          const key = `${itemId}:${itemLocationId}`;
          const candidates = receiptCandidates.get(key) ?? [];
          candidates.push({ lineId, remaining: new Prisma.Decimal(quantity) });
          receiptCandidates.set(key, candidates);
          if (targetConnection) await upsert(targetConnection, "inventory_movements", movementBase({ id: stableId("movement-receipt", detail.id), movementType: "RECEIPT", documentId, documentNumber, lineId, itemId, locationId: itemLocationId, sourceLocationId: null, destinationLocationId: itemLocationId, quantity, unitCost, postedAt: documentDate }));
        } else if (kind === "issues") {
          if (targetConnection) await upsert(targetConnection, "inventory_movements", movementBase({ id: stableId("movement-issue", detail.id), movementType: "ISSUE", documentId, documentNumber, lineId, itemId, locationId: itemLocationId, sourceLocationId: itemLocationId, destinationLocationId: null, quantity, unitCost, postedAt: documentDate, sourceReceiptLineId: sourceReceipt?.lineId ?? null }));
        } else if (targetConnection) {
          await upsert(targetConnection, "inventory_movements", movementBase({ id: stableId("movement-transfer-out", `${detail.id}:out`), movementType: "TRANSFER_OUT", documentId, documentNumber, lineId, itemId, locationId: itemLocationId, sourceLocationId: itemLocationId, destinationLocationId: transferDestinationId!, quantity, unitCost, postedAt: documentDate }));
          await upsert(targetConnection, "inventory_movements", movementBase({ id: stableId("movement-transfer-in", `${detail.id}:in`), movementType: "TRANSFER_IN", documentId, documentNumber, lineId, itemId, locationId: transferDestinationId!, sourceLocationId: itemLocationId, destinationLocationId: transferDestinationId!, quantity, unitCost, postedAt: documentDate }));
        }
        loadedLines += 1;
      }
      if (loadedLines) summary[kind].loaded += 1;
    }

    if (targetConnection) {
      for (const rejection of rejections) await upsert(targetConnection, "migration_rejections", { id: stableId("rejection", `${runId}:${rejection.sourceTable}:${rejection.sourceId}:${rejection.reasonCode}`), migration_run_id: runId, source_table: rejection.sourceTable, source_id: rejection.sourceId, reason_code: rejection.reasonCode, reason: rejection.reason, raw_data: JSON.stringify(rejection.raw), created_at: now });
      await targetConnection.commit();
      inTransaction = false;
      await targetConnection.query("UPDATE migration_runs SET status=?, finished_at=NOW(), summary=? WHERE id=?", [rejections.length ? "COMPLETED_WITH_REJECTIONS" : "COMPLETED", JSON.stringify(summary), runId]);
    }
    console.log(JSON.stringify({ mode: execute ? "execute" : "dry-run", sourceDatabase, targetDatabase: targetUrl ? databaseName(targetUrl) : null, limits: { sampleItemLimit, sampleVendorLimit, sampleDocumentLimit }, summary, rejected: rejections.length }, null, 2));
  } catch (error) {
    if (targetConnection && inTransaction) await targetConnection.rollback().catch(() => undefined);
    if (targetConnection) await targetConnection.query("UPDATE migration_runs SET status=?, finished_at=NOW(), summary=? WHERE id=?", ["FAILED", JSON.stringify({ error: error instanceof Error ? error.message : String(error), summary }), runId]).catch(() => undefined);
    throw error;
  } finally {
    await sourceConnection.end();
    await targetConnection?.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Old Inventory sample migration failed");
  process.exit(1);
});
