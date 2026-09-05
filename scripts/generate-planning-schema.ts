// Mechanical schema generator for the additive planning migration and Prisma parity.
import { writeFile, mkdir, readFile } from "node:fs/promises";
import { getTableConfig } from "drizzle-orm/mysql-core";
import * as tables from "../lib/db/planning-schema";

async function main() {
  const sql: string[] = ["ALTER TABLE assets ADD COLUMN organization_id VARCHAR(36) NULL, ADD COLUMN site_id VARCHAR(36) NULL;"];
  const prisma: string[] = [];
  for (const [name, table] of Object.entries(tables)) {
    const config = getTableConfig(table);
    const fields: string[] = []; const columns: string[] = []; const enums: string[] = [];
    const keys = Object.entries(table).filter(([, v]) => config.columns.includes(v as typeof config.columns[number]));
    for (const [key, column] of keys as [string, typeof config.columns[number]][]) {
      const type = column.getSQLType();
      const def = column.default === undefined ? "" : ` DEFAULT '${String(column.default)}'`;
      columns.push(`  \`${column.name}\` ${type} ${column.notNull ? "NOT NULL" : "NULL"}${column.primary ? " PRIMARY KEY" : ""}${def}`);
      let ptype = "String"; let native = "";
      if (type.startsWith("enum(")) {
        ptype = `${name[0].toUpperCase()}${name.slice(1)}${key[0].toUpperCase()}${key.slice(1)}`;
        enums.push(`enum ${ptype} {\n${type.slice(5, -1).split(",").map(v => `  ${v.replaceAll("'", "").trim()}`).join("\n")}\n}`);
      } else if (type.startsWith("varchar")) native = ` @db.VarChar(${type.match(/\d+/)![0]})`;
      else if (type.startsWith("datetime")) { ptype = "DateTime"; native = " @db.DateTime(3)"; }
      else if (type.startsWith("decimal")) { ptype = "Decimal"; native = ` @db.Decimal(${type.slice(8, -1)})`; }
      else if (type.startsWith("int")) ptype = "Int";
      else native = type === "longtext" ? " @db.LongText" : " @db.Text";
      const pdef = column.default === undefined ? "" : ` @default(${ptype === "Int" ? column.default : type.startsWith("enum") ? column.default : JSON.stringify(String(column.default))})`;
      fields.push(`  ${key} ${ptype}${column.notNull ? "" : "?"}${column.primary ? " @id" : ""}${pdef} @map("${column.name}")${native}`);
    }
    for (const idx of config.indexes) {
      const c = idx.config;
      const idxCols = c.columns.map(col => (col as { name: string }).name);
      columns.push(`  ${c.unique ? "UNIQUE " : ""}KEY \`${c.name}\` (${idxCols.map(n => `\`${n}\``).join(", ")})`);
      fields.push(`  @@${c.unique ? "unique" : "index"}([${idxCols.map(n => keys.find(([, v]) => (v as { name: string }).name === n)![0]).join(", ")}], map: "${c.name}")`);
    }
    sql.push(`CREATE TABLE \`${config.name}\` (\n${columns.join(",\n")}\n) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    prisma.push(...enums, `model ${name[0].toUpperCase()}${name.slice(1)} {\n${fields.join("\n")}\n  @@map("${config.name}")\n}`);
  }
  // Explicit links protect deletion and orphan sources; service enforces same scope.
  const links = [
    ["maintenance_project_tasks", "project_id", "maintenance_projects"], ["maintenance_project_tasks", "parent_id", "maintenance_project_tasks"], ["maintenance_project_tasks", "asset_id", "assets"], ["maintenance_project_tasks", "work_order_id", "work_orders"],
    ["project_task_dependencies", "project_id", "maintenance_projects"], ["project_task_dependencies", "predecessor_id", "maintenance_project_tasks"], ["project_task_dependencies", "successor_id", "maintenance_project_tasks"],
    ["preventive_programs", "asset_id", "assets"], ["preventive_programs", "template_id", "maintenance_templates"], ["pm_occurrences", "program_id", "preventive_programs"], ["pm_occurrences", "work_order_id", "work_orders"],
  ];
  // Prisma models use scalar links consistently with existing legacy models.
  for (const [table, field, target] of links) sql.push(`ALTER TABLE \`${table}\` ADD CONSTRAINT \`planning_${table}_${field}_fk\` FOREIGN KEY (\`${field}\`) REFERENCES \`${target}\`(id) ON DELETE RESTRICT;`);
  const directory = "prisma/migrations/0012_pm_shutdown_planning";
  await mkdir(directory, { recursive: true });
  await writeFile(`${directory}/migration.sql`, sql.join("\n\n") + "\n");
  const schema = await readFile("prisma/schema.prisma", "utf8");
  if (schema.includes("// Planning schema")) throw new Error("Planning schema already generated; review manually");
  await writeFile("prisma/schema.prisma", schema.replace("model Asset {", 'model Asset {\n  organizationId String? @map("organization_id") @db.VarChar(36)\n  siteId String? @map("site_id") @db.VarChar(36)') + "\n// Planning schema\n" + prisma.join("\n\n") + "\n");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
