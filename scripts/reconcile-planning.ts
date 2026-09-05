/** Read-only integrity report. Never repairs or rewrites production data. */
import { pool } from "../lib/db";
import type { RowDataPacket } from "mysql2";

async function main() {
  const checks = {
    missingShutdownBacklink: "SELECT w.id FROM work_orders w LEFT JOIN maintenance_project_tasks t ON t.id=w.source_record_id AND t.work_order_id=w.id WHERE w.source_type='SHUTDOWN_TASK' AND t.id IS NULL LIMIT 501",
    missingPmBacklink: "SELECT w.id FROM work_orders w LEFT JOIN pm_occurrences o ON o.id=w.source_record_id AND o.work_order_id=w.id WHERE w.source_type='PREVENTIVE_EVENT' AND o.id IS NULL LIMIT 501",
    taskClosureMismatch: "SELECT t.id FROM maintenance_project_tasks t JOIN work_orders w ON w.id=t.work_order_id WHERE (w.status='CLOSED' AND t.status<>'COMPLETED') OR (w.status<>'CLOSED' AND t.status='COMPLETED') LIMIT 501",
    pmClosureMismatch: "SELECT o.id FROM pm_occurrences o JOIN work_orders w ON w.id=o.work_order_id WHERE (w.status='CLOSED' AND o.status<>'COMPLETED') OR (w.status<>'CLOSED' AND o.status='COMPLETED') LIMIT 501",
    terminalProjectOpenWork: "SELECT DISTINCT p.id FROM maintenance_projects p JOIN maintenance_project_tasks t ON t.project_id=p.id JOIN work_orders w ON w.id=t.work_order_id WHERE p.status IN ('CLOSED','CANCELLED') AND w.status NOT IN ('CLOSED','CANCELLED') LIMIT 501",
    scopeMismatch: "SELECT t.id FROM maintenance_project_tasks t JOIN maintenance_projects p ON p.id=t.project_id JOIN work_orders w ON w.id=t.work_order_id WHERE NOT (t.organization_id <=> p.organization_id) OR NOT (t.site_id <=> p.site_id) OR NOT (w.organization_id <=> p.organization_id) OR NOT (w.site_id <=> p.site_id) LIMIT 501",
    overdueOutbox: "SELECT id FROM planning_outbox WHERE delivered_at IS NULL AND created_at < DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 HOUR) LIMIT 501",
    staleRuns: "SELECT id FROM planning_job_runs WHERE status='RUNNING' AND started_at < DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 HOUR) LIMIT 501",
  };
  const report: Record<string, { ids: string[]; truncated: boolean }> = {};
  for (const [name, query] of Object.entries(checks)) {
    const [rows] = await pool.query<RowDataPacket[]>(query);
    report[name] = { ids: rows.slice(0, 500).map(r => String(r.id)), truncated: rows.length > 500 };
  }
  console.log(JSON.stringify({ mode: "READ_ONLY", report }, null, 2));
  if (Object.values(report).some(r => r.ids.length)) process.exitCode = 2;
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Reconciliation failed"); process.exitCode = 1; }).finally(() => pool.end());
