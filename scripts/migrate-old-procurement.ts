import "dotenv/config";
import { createHash, randomUUID } from "node:crypto";
import mysql, { type Connection, type RowDataPacket } from "mysql2/promise";

type Row = RowDataPacket & Record<string, unknown>;
type Rejection = { sourceTable: string; sourceId: string; reasonCode: string; reason: string };

const execute = process.argv.includes("--execute");
const sourceUrl = process.env.OLD_DATABASE_URL;
const targetUrl = process.env.DEV_DATABASE_URL ?? process.env.DATABASE_URL;
const migrationActorId = "00000000-0000-5000-8000-000000000099";

function serverUrl(url: string) { const parsed = new URL(url); parsed.pathname = "/"; return parsed.toString(); }
function databaseName(url: string) { return decodeURIComponent(new URL(url).pathname.slice(1)); }
function identifier(value: string) { if (!/^[A-Za-z0-9_]+$/.test(value)) throw new Error(`Unsafe identifier: ${value}`); return `\`${value}\``; }
function text(value: unknown) { return value === null || value === undefined ? "" : String(value).trim(); }
function nullable(value: unknown, max = 10_000) { const result = text(value); return result ? result.slice(0, max) : null; }
function decimal(value: unknown) { const result = text(value).replaceAll(",", ""); return /^-?(?:\d+(?:\.\d+)?|\.\d+)$/.test(result) ? result : "0"; }
function date(value: unknown, fallback = new Date()) { const result = value instanceof Date ? value : new Date(text(value)); return Number.isNaN(result.getTime()) ? fallback : result; }
function stableId(namespace: string, value: unknown) { const bytes = createHash("sha256").update(`OLD:${namespace}:${String(value)}`).digest().subarray(0, 16); bytes[6] = (bytes[6] & 0x0f) | 0x50; bytes[8] = (bytes[8] & 0x3f) | 0x80; const hex = bytes.toString("hex"); return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`; }

async function rows(connection: Connection, sql: string, params: unknown[] = []) { const [result] = await connection.query<Row[]>(sql, params); return result; }
async function upsert(connection: Connection, table: string, record: Record<string, unknown>) { const columns = Object.keys(record); const updates = columns.filter((column) => column !== "id").map((column) => `${identifier(column)}=VALUES(${identifier(column)})`).join(","); await connection.query(`INSERT INTO ${identifier(table)} (${columns.map(identifier).join(",")}) VALUES (${columns.map(() => "?").join(",")}) ON DUPLICATE KEY UPDATE ${updates}`, columns.map((column) => record[column] ?? null)); }

function status(value: unknown) {
  const map: Record<string, string> = { New: "DRAFT", Released: "PENDING_APPROVAL", Returned: "RETURNED_FOR_REVISION", Approved: "ISSUED", Rejected: "REJECTED", Canceled: "CANCELLED", Completed: "RECEIVED", Received: "RECEIVED" };
  return map[text(value)] ?? "DRAFT";
}

async function main() {
  if (!sourceUrl || !targetUrl) throw new Error("OLD_DATABASE_URL and DEV_DATABASE_URL are required");
  if (sourceUrl === targetUrl) throw new Error("Source and target database URLs must be different");
  const source = await mysql.createConnection(serverUrl(sourceUrl));
  const target = await mysql.createConnection(targetUrl);
  const runId = randomUUID(); const rejections: Rejection[] = [];
  try {
    const sourceSchemaRows = await rows(source, "SELECT DISTINCT TABLE_SCHEMA AS name FROM information_schema.TABLES WHERE TABLE_NAME IN ('pupod010','pupod020') ORDER BY TABLE_SCHEMA");
    const configured = process.env.OLD_DATABASE_SCHEMA ?? databaseName(sourceUrl);
    const sourceSchema = sourceSchemaRows.some((row) => text(row.name) === configured) ? configured : text(sourceSchemaRows[0]?.name);
    if (!sourceSchema) throw new Error("No accessible legacy procurement schema was found");
    const [headers, lines, vendorRows, itemRows, actorRows, departmentRows] = await Promise.all([
      rows(source, `SELECT * FROM ${identifier(sourceSchema)}.pupod010 ORDER BY id`),
      rows(source, `SELECT * FROM ${identifier(sourceSchema)}.pupod020 ORDER BY pupod010_id, seqn, id`),
      rows(target, "SELECT id, name, legacy_source_id FROM vendors WHERE legacy_source_id IS NOT NULL"),
      rows(target, "SELECT id, code, name, legacy_source_id FROM stock_items WHERE legacy_source_id IS NOT NULL"),
      rows(target, "SELECT id FROM users WHERE id = ? UNION ALL SELECT id FROM users WHERE status = 'ACTIVE' AND id <> ? ORDER BY id LIMIT 1", [migrationActorId, migrationActorId]),
      rows(target, "SELECT id FROM departments WHERE active = true ORDER BY code LIMIT 1"),
    ]);
    const actorId = text(actorRows[0]?.id);
    const departmentId = text(departmentRows[0]?.id);
    if (!actorId || !departmentId) throw new Error("Target requires at least one active user and department before procurement migration");
    const vendorMap = new Map(vendorRows.map((row) => [text(row.legacy_source_id), { id: text(row.id), name: text(row.name) }]));
    const itemMap = new Map(itemRows.map((row) => [text(row.legacy_source_id), { id: text(row.id), code: text(row.code), name: text(row.name) }]));
    const validHeaders = new Map<string, Row>();
    let loadedHeaders = 0; let loadedLines = 0;

    if (execute) {
      await target.beginTransaction();
      await target.query("INSERT INTO migration_runs (id, source_system, source_database, scope, status, started_at, manifest) VALUES (?, 'OLD', ?, 'procurement-po', 'RUNNING', NOW(), ?)", [runId, sourceSchema, JSON.stringify({ headers: headers.length, lines: lines.length })]);
    }
    for (const header of headers) {
      const sourceId = text(header.id); const vendor = vendorMap.get(text(header.whvnd010_id));
      if (!sourceId || !vendor) { rejections.push({ sourceTable: "pupod010", sourceId, reasonCode: "MISSING_VENDOR", reason: "PO requires a vendor already mapped by legacy_source_id" }); continue; }
      validHeaders.set(sourceId, header);
      const amount = decimal(header.amnt); const mappedStatus = status(header.stat); const approvedOrLater = ["ISSUED", "PARTIAL_RECEIVED", "RECEIVED", "CLOSED"].includes(mappedStatus);
      if (execute) await upsert(target, "purchase_orders", {
        id: stableId("purchase-order", sourceId), order_number: nullable(header.code, 80) ?? `OLD-PO-${sourceId}`, purchase_request_id: null,
        vendor_id: vendor.id, vendor_name_snapshot: vendor.name, creator_id: actorId, department_id: departmentId, site_id: null,
        status: mappedStatus, purchase_method: "LEGACY", currency_code: "THB", exchange_rate_to_thb: "1",
        subtotal_amount: amount, item_discount_amount: "0", header_discount_amount: "0", vat_amount: "0", grand_total_amount: amount, grand_total_amount_thb: amount,
        submitted_at: mappedStatus === "DRAFT" ? null : date(header.crdt), approved_at: approvedOrLater ? date(header.lmdt) : null,
        issued_at: approvedOrLater ? date(header.lmdt) : null, issued_by: approvedOrLater ? actorId : null,
        expected_delivery_date: header.endt ? date(header.endt) : null, work_order_id: null, asset_id: null, cycle_number: 0, revision_number: 0,
        remark: nullable([nullable(header.note), nullable(header.remark), nullable(header.dsca)].filter(Boolean).join("\n")), internal_remark: "Imported from OLD procurement",
        created_at: date(header.crdt), updated_at: date(header.lmdt), created_by: actorId, updated_by: actorId,
      });
      loadedHeaders += 1;
    }
    for (const line of lines) {
      const sourceId = text(line.id); const headerId = text(line.pupod010_id); const header = validHeaders.get(headerId); const item = itemMap.get(text(line.whitm010_id));
      if (!sourceId || !header || !item) { rejections.push({ sourceTable: "pupod020", sourceId, reasonCode: "MISSING_REFERENCE", reason: "PO line requires a loaded header and stock item mapped by legacy_source_id" }); continue; }
      const ordered = decimal(line.qnty); const received = decimal(line.qtyr); const headerStatus = status(header.stat);
      if (execute) await upsert(target, "purchase_order_lines", {
        id: stableId("purchase-order-line", sourceId), purchase_order_id: stableId("purchase-order", headerId), line_number: Number(line.seqn) || 1,
        stock_item_id: item.id, stock_code_snapshot: item.code, description: nullable(line.dsca, 255) ?? item.name,
        quantity: ordered, unit_price: decimal(line.pric), item_discount_amount: "0", line_subtotal: decimal(line.amnt), line_total: decimal(line.amnt),
        received_quantity: received, rejected_quantity: "0", returned_quantity: "0", expected_delivery_date: header.endt ? date(header.endt) : null,
        work_order_id: null, asset_id: null, remark: nullable(line.note),
      });
      loadedLines += 1;
      if (execute && headerStatus === "ISSUED" && Number(received) > 0 && Number(received) < Number(ordered)) await target.query("UPDATE purchase_orders SET status='PARTIAL_RECEIVED' WHERE id=?", [stableId("purchase-order", headerId)]);
    }
    if (execute) {
      for (const rejection of rejections) await target.query("INSERT INTO migration_rejections (id, migration_run_id, source_table, source_id, reason_code, reason, raw_data, created_at) VALUES (?, ?, ?, ?, ?, ?, NULL, NOW())", [randomUUID(), runId, rejection.sourceTable, rejection.sourceId || "UNKNOWN", rejection.reasonCode, rejection.reason]);
      const summary = { purchaseOrders: { source: headers.length, loaded: loadedHeaders }, purchaseOrderLines: { source: lines.length, loaded: loadedLines }, rejected: rejections.length };
      await target.query("UPDATE migration_runs SET status='COMPLETED', finished_at=NOW(), summary=? WHERE id=?", [JSON.stringify(summary), runId]);
      await target.commit();
    }
    console.log(JSON.stringify({ mode: execute ? "execute" : "dry-run", sourceSchema, targetSchema: databaseName(targetUrl), purchaseOrders: { source: headers.length, loadable: loadedHeaders }, purchaseOrderLines: { source: lines.length, loadable: loadedLines }, rejected: rejections.length, rejectionSummary: Object.fromEntries([...new Set(rejections.map((item) => item.reasonCode))].map((code) => [code, rejections.filter((item) => item.reasonCode === code).length])) }, null, 2));
  } catch (error) {
    if (execute) await target.rollback().catch(() => undefined);
    throw error;
  } finally { await source.end(); await target.end(); }
}

main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
