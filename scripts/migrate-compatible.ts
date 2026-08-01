import { createHash, randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import mysql from "mysql2/promise";

function compatibleSql(sql: string, version: string) {
  if (!/^5\.5\./.test(version)) return sql;
  return sql
    .replaceAll(/DATETIME\(3\) NOT NULL DEFAULT CURRENT_TIMESTAMP\(3\)/gi, "TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP")
    .replaceAll(/DATETIME\(3\)/gi, "DATETIME")
    .replaceAll(/CURRENT_TIMESTAMP\(3\)/gi, "CURRENT_TIMESTAMP")
    .replaceAll(/CREATE TABLE\s+`[^`]+`\s*\([\s\S]*?\);/gi, (statement) => statement.includes("DEFAULT CHARACTER SET") ? statement : statement.replace(/\);\s*$/, ") ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"));
}

const resumableCodes = new Set(["ER_TABLE_EXISTS_ERROR", "ER_DUP_FIELDNAME", "ER_DUP_KEYNAME", "ER_FK_DUP_NAME"]);

async function main() {
  const uri = process.env.DATABASE_URL;
  if (!uri) throw new Error("DATABASE_URL is required");
  const connection = await mysql.createConnection({ uri, multipleStatements: true, timezone: "Z" });
  try {
    const [[server]] = await connection.query<mysql.RowDataPacket[]>("SELECT VERSION() version");
    const version = String(server.version);
    const [[lock]] = await connection.query<mysql.RowDataPacket[]>("SELECT GET_LOCK('ma_next_schema_migration', 30) acquired");
    if (Number(lock.acquired) !== 1) throw new Error("Could not acquire the migration lock");
    await connection.query(`CREATE TABLE IF NOT EXISTS _prisma_migrations (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      checksum VARCHAR(64) NOT NULL,
      finished_at DATETIME NULL,
      migration_name VARCHAR(255) NOT NULL,
      logs TEXT NULL,
      rolled_back_at DATETIME NULL,
      started_at DATETIME NOT NULL,
      applied_steps_count INTEGER UNSIGNED NOT NULL DEFAULT 0
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    const [rows] = await connection.query<mysql.RowDataPacket[]>("SELECT migration_name, checksum, finished_at FROM _prisma_migrations WHERE rolled_back_at IS NULL");
    const applied = new Map(rows.map((row) => [String(row.migration_name), row]));
    if (/^5\.5\./.test(version) && !applied.has("0002_asset_management_slice")) {
      const [contractTables] = await connection.query<mysql.RowDataPacket[]>("SELECT table_collation FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='contracts'");
      if (contractTables.length && String(contractTables[0].table_collation) !== "utf8mb4_unicode_ci") await connection.query("ALTER TABLE contracts CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    }
    const root = resolve("prisma/migrations");
    const migrations = (await readdir(root, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
    for (const migrationName of migrations) {
      const sql = await readFile(resolve(root, migrationName, "migration.sql"), "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      const previous = applied.get(migrationName);
      if (previous) {
        if (String(previous.checksum) !== checksum) throw new Error(`Checksum mismatch for applied migration ${migrationName}`);
        if (!previous.finished_at) throw new Error(`Migration ${migrationName} is recorded as unfinished`);
        console.log(`Already applied ${migrationName}`);
        continue;
      }
      console.log(`Applying ${migrationName} on MariaDB ${version}`);
      const statements = compatibleSql(sql, version).split(";").map((statement) => statement.replace(/^\s*--[^\n]*\n/gm, "").trim()).filter(Boolean);
      for (const statement of statements) {
        try { await connection.query(statement); }
        catch (error) {
          const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
          if (!resumableCodes.has(code)) throw error;
          console.log(`Skipped already-applied statement (${code})`);
        }
      }
      await connection.execute("INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, started_at, applied_steps_count) VALUES (?, ?, NOW(), ?, NOW(), 1)", [randomUUID(), checksum, migrationName]);
    }
    console.log(`Database migrations are current (${migrations.length} total).`);
  } finally {
    await connection.query("SELECT RELEASE_LOCK('ma_next_schema_migration')").catch(() => undefined);
    await connection.end();
  }
}

main().catch((error) => { console.error(error instanceof Error ? error.message : "Migration failed"); process.exit(1); });
