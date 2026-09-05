/** One-shot worker. Dry-run by default; never performs automatic catch-up. */
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { RowDataPacket } from "mysql2";
import { db, pool } from "../lib/db";
import { prisma } from "../lib/prisma";
import { preventivePrograms } from "../lib/db/planning-schema";
import { allPermissions, type Permission } from "../lib/auth/permissions";
import type { AuthenticatedUser } from "../lib/auth/session";
import { planningGrant } from "../lib/planning/authorization";
import { generateProgram } from "../lib/planning/service";
import { occurrenceDates, localDateAt } from "../lib/planning/domain";
import { drainPlanningOutbox } from "../lib/planning/outbox";

async function main() {
  const execute = process.argv.includes("--execute");
  const programArgument = process.argv.find(a => a.startsWith("--program="))?.slice("--program=".length);
  const programId = programArgument ? z.string().uuid().parse(programArgument) : undefined;
  const userId = process.env.PLANNING_SERVICE_USER_ID;
  if (!userId) throw new Error("Set PLANNING_SERVICE_USER_ID to an existing scoped service user");
  const user = await prisma.user.findFirst({ where: { id: userId, status: "ACTIVE" }, include: { roles: { where: { role: { active: true } }, include: { role: { include: { permissions: { include: { permission: true } } } } } } } });
  if (!user) throw new Error("Active service user required");
  // No legacy-role fallback, administrator elevation, or synthetic permissions.
  const scopes = user.roles.map(r => ({ roleCode: r.role.code, scopeType: r.scopeType, organizationId: r.organizationId, siteId: r.siteId, departmentId: r.departmentId, permissions: r.role.permissions.map(p => p.permission.code).filter((p): p is Permission => allPermissions.includes(p as Permission)) }));
  const actor: AuthenticatedUser = { id: user.id, fullName: user.fullName, username: user.username, email: user.email, role: "VIEWER", roleCodes: [], mustChangePassword: false, scopes, permissions: [...new Set(scopes.flatMap(s => s.permissions))] };
  if (!actor.permissions.includes("PM_GENERATE")) throw new Error("Service user must explicitly have PM_GENERATE");
  const canGenerate = (p: typeof preventivePrograms.$inferSelect) => actor.scopes?.some(s => planningGrant(s, p, "PM_GENERATE"));
  const lease = await pool.getConnection();
  const runId = randomUUID();
  let recorded = false;
  const results: unknown[] = [];
  try {
    const [[lock]] = await lease.query<RowDataPacket[]>("SELECT GET_LOCK('ma_next_planning_worker',0) acquired");
    if (Number(lock.acquired) !== 1) { console.log("Another worker owns the lease; skipped"); return; }
    if (execute) { await lease.execute("INSERT INTO planning_job_runs (id,actor_id,mode,started_at,status) VALUES (?,?,'EXECUTE',NOW(),'RUNNING')", [runId, actor.id]); recorded = true; }
    const programs = await db.select().from(preventivePrograms).where(and(eq(preventivePrograms.status, "ACTIVE"), programId ? eq(preventivePrograms.id, programId) : undefined)).limit(501);
    if (programId && (!programs.length || !canGenerate(programs[0]))) throw new Error("Requested active program is unavailable in the service user's scope");
    if (programs.length > 500) throw new Error("Worker batch exceeds 500 programs; configure partitioning before enabling");
    let failed = false;
    for (const p of programs.filter(canGenerate)) {
      const from = localDateAt(new Date(), p.timezone);
      const to = localDateAt(new Date(Date.now() + p.leadTimeDays * 86400000), p.timezone);
      const dates = occurrenceDates(p.startDate, p.expiryDate, p.frequency, p.interval, from, to);
      if (!execute) { results.push({ programId: p.id, dates }); continue; }
      for (let i = 0; i < dates.length; i += 31) {
        const result = await generateProgram(p.id, { version: p.version, note: `Scheduler run ${runId}`, dates: dates.slice(i, i + 31), catchUp: false, action: "GENERATE" }, actor);
        failed ||= result.results.some(r => r.error);
        results.push({ programId: p.id, ...result });
      }
    }
    if (execute) {
      // Generation can be tested independently of delivery without touching
      // notifications belonging to other DEV fixtures.
      if (!process.argv.includes("--skip-notifications")) results.push(await drainPlanningOutbox());
      await lease.execute("UPDATE planning_job_runs SET finished_at=NOW(),status=?,result=? WHERE id=?", [failed ? "PARTIAL_FAILURE" : "SUCCEEDED", JSON.stringify(results), runId]);
    }
    console.log(JSON.stringify({ runId, mode: execute ? "EXECUTE" : "DRY_RUN", results }, null, 2));
    if (failed) process.exitCode = 1;
  } catch (error) {
    if (recorded) await lease.execute("UPDATE planning_job_runs SET finished_at=NOW(),status='FAILED',result=? WHERE id=?", [JSON.stringify({ error: error instanceof Error ? error.message : "Worker failed", results }), runId]);
    throw error;
  } finally { await lease.query("SELECT RELEASE_LOCK('ma_next_planning_worker')"); lease.release(); }
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Worker failed"); process.exitCode = 1; }).finally(async () => { await pool.end(); await prisma.$disconnect(); });
