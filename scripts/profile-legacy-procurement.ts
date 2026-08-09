import "dotenv/config";
import mysql, { type Connection, type RowDataPacket } from "mysql2/promise";

type Row = RowDataPacket & Record<string, unknown>;

const sourceUrl = process.env.OLD_DATABASE_URL;
const targetUrl = process.env.DEV_DATABASE_URL;
const sourceTables = [
  "puprd010",
  "puprd011",
  "puprd020",
  "puprd030",
  "puprd040",
  "pupod010",
  "pupod011",
  "pupod012",
  "pupod020",
  "pupod030",
  "whitm040",
  "whitm041",
  "whitm042",
  "sys_approves",
  "sys_approve_details",
  "sys_approve_history",
] as const;

function databaseName(url: string) {
  return decodeURIComponent(new URL(url).pathname.slice(1));
}

function serverUrl(url: string) {
  const parsed = new URL(url);
  parsed.pathname = "/";
  return parsed.toString();
}

async function query(connection: Connection, sql: string, params: unknown[] = []) {
  const [rows] = await connection.query<Row[]>(sql, params);
  return rows;
}

function identifier(value: string) {
  if (!/^[A-Za-z0-9_]+$/.test(value)) throw new Error(`Unsafe identifier: ${value}`);
  return `\`${value}\``;
}

async function profileTable(connection: Connection, schema: string, table: string) {
  const [countRows, exactCountRows, columns] = await Promise.all([
    query(
      connection,
      "SELECT TABLE_ROWS AS estimatedRows FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?",
      [schema, table],
    ),
    query(connection, `SELECT COUNT(*) AS exactRows FROM ${identifier(schema)}.${identifier(table)}`),
    query(
      connection,
      "SELECT COLUMN_NAME AS name, COLUMN_TYPE AS type, IS_NULLABLE AS nullable, COLUMN_KEY AS columnKey FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION",
      [schema, table],
    ),
  ]);
  return {
    table,
    exists: columns.length > 0,
    estimatedRows: Number(countRows[0]?.estimatedRows ?? 0),
    exactRows: Number(exactCountRows[0]?.exactRows ?? 0),
    columns,
  };
}

async function main() {
  if (!sourceUrl || !targetUrl) throw new Error("OLD_DATABASE_URL and DEV_DATABASE_URL are required");
  if (sourceUrl === targetUrl) throw new Error("Source and target database URLs must be different");

  const targetSchema = databaseName(targetUrl);
  const source = await mysql.createConnection(serverUrl(sourceUrl));
  const target = await mysql.createConnection(targetUrl);

  try {
    await source.beginTransaction();
    await target.beginTransaction();

    const configuredSourceSchema = process.env.OLD_DATABASE_SCHEMA ?? databaseName(sourceUrl);
    const matchingSchemas = await query(
      source,
      "SELECT DISTINCT TABLE_SCHEMA AS name FROM information_schema.TABLES WHERE TABLE_NAME IN ('puprd010', 'pupod010', 'whitm040') ORDER BY TABLE_SCHEMA",
    );
    const accessibleSchemas = new Set(matchingSchemas.map((row) => String(row.name)));
    const sourceSchema = accessibleSchemas.has(configuredSourceSchema)
      ? configuredSourceSchema
      : String(matchingSchemas[0]?.name ?? configuredSourceSchema);

    const sourceProfile = [];
    for (const table of sourceTables) sourceProfile.push(await profileTable(source, sourceSchema, table));

    const targetTables = await query(
      target,
      "SELECT TABLE_NAME AS name, TABLE_ROWS AS estimatedRows FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND (TABLE_NAME LIKE 'purchase_%' OR TABLE_NAME LIKE 'inventory_%' OR TABLE_NAME LIKE 'approval_%') ORDER BY TABLE_NAME",
      [targetSchema],
    );

    console.log(JSON.stringify({
      source: { schema: sourceSchema, tables: sourceProfile },
      target: { schema: targetSchema, relevantTables: targetTables },
    }, null, 2));

    await source.rollback();
    await target.rollback();
  } finally {
    await source.end();
    await target.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
