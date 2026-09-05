import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Role } from "../lib/db/schema";
import { spawn } from "node:child_process";

function runWorker(userId: string, programId: string, execute = false) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", "tsx", "scripts/run-planning.ts", `--program=${programId}`, "--skip-notifications", ...(execute ? ["--execute"] : [])], { env: { ...process.env, PLANNING_SERVICE_USER_ID: userId }, timeout: 60000 });
    let output = ""; let error = "";
    child.stdout.on("data", chunk => { output += chunk; }); child.stderr.on("data", chunk => { error += chunk; });
    child.on("error", reject); child.on("close", code => code === 0 ? resolve(output) : reject(new Error(`Worker failed: ${error}`)));
  });
}

async function main() {
  if (!process.env.DEV_DATABASE_URL || process.env.NODE_ENV === "production") throw new Error("Explicit DEV_DATABASE_URL required; production forbidden");
  process.env.DATABASE_URL = process.env.DEV_DATABASE_URL;
  const { prisma } = await import("../lib/prisma");
  const { pool, db } = await import("../lib/db");
  const service = await import("../lib/planning/service");
  const workflow = await import("../lib/maintenance/governed-service");
  const { updateWorkOrderTask } = await import("../lib/maintenance/service");
  const { rolePermissions } = await import("../lib/auth/permissions");
  const { eq } = await import("drizzle-orm");
  const { workOrders } = await import("../lib/db/schema");
  const { pmOccurrences } = await import("../lib/db/planning-schema");
  const suffix = randomUUID().slice(0, 8);
  const sessionIds: string[] = [];
  try {
    const org = await prisma.organization.create({ data: { code: `PLAN-TEST-${suffix}`, name: "Planning integration fixtures" } });
    const site = await prisma.site.create({ data: { organizationId: org.id, code: "TEST", name: "Planning test site" } });
    const actorFor = async (name: "manager" | "technician" | "operator") => {
      const actorRole = name === "manager" ? "MAINTENANCE_MANAGER" : name === "technician" ? "TECHNICIAN" : "OPERATOR";
      const permissions = [...rolePermissions[actorRole]];
      const grants = await prisma.permission.findMany({ where: { code: { in: permissions } }, select: { id: true } });
      assert.equal(grants.length, permissions.length, "DEV permission catalog must be seeded before integration tests");
      const role = await prisma.role.create({ data: { code: `PT-${name}-${suffix}`, name: "Isolated planning role fixture", permissions: { create: grants.map(p => ({ permissionId: p.id })) } } });
      const user = await prisma.user.create({ data: { fullName: `${name} ${suffix}`, username: `plan-${name}-${suffix}`, email: `plan-${name}-${suffix}@example.invalid`, passwordHash: randomUUID(), legacyRole: actorRole, roles: { create: { roleId: role.id, scopeType: "SITE", organizationId: org.id, siteId: site.id } } } });
      return { id: user.id, fullName: user.fullName, username: user.username, email: user.email, role: actorRole as Role, permissions, scopes: [{ roleCode: role.code, scopeType: "SITE" as const, organizationId: org.id, siteId: site.id, departmentId: null, permissions }], mustChangePassword: false };
    };
    const manager = await actorFor("manager"); const tech = await actorFor("technician"); const operator = await actorFor("operator");
    const type = await prisma.assetType.create({ data: { code: `PT-${suffix}`, name: "Planning test asset type", createdBy: manager.id, updatedBy: manager.id } });
    const asset = await prisma.asset.create({ data: { code: `PT-${suffix}`, name: "Planning test asset", organizationId: org.id, siteId: site.id, assetTypeId: type.id, location: "Test site", createdBy: manager.id, updatedBy: manager.id } });
    const meta = { requestId: randomUUID(), ipAddress: "127.0.0.1", userAgent: "Planning DEV integration", browser: "test", operatingSystem: "test", deviceType: "test" };
    const scope = { organizationId: org.id, siteId: site.id };
    const dates = { plannedStartAt: new Date().toISOString(), plannedFinishAt: new Date(Date.now() + 86400000).toISOString() };
    const p = await service.createProject({ ...scope, ...dates, code: `SD-${suffix}`, name: "Shutdown integration", description: "Atomic conversion and completion", ownerId: manager.id, operatorId: operator.id }, manager);
    if (process.argv.includes("--http")) {
      const { createSession, getSessionByToken } = await import("../lib/auth/session");
      const origin = "http://127.0.0.1:3000";
      assert.equal((await fetch(`${origin}/api/planning/projects`)).status, 401);
      for (const actor of [manager, tech, operator]) {
        const session = await createSession(actor.id, meta);
        const resolved = await getSessionByToken(session.token); assert.ok(resolved);
        sessionIds.push(resolved.sessionId); assert.equal(resolved.user.role, actor.role);
        const headers = { Cookie: `atlas_session=${session.token}`, Origin: origin, "Content-Type": "application/json" };
        const read = await fetch(`${origin}/api/planning/projects/${p.id}`, { headers });
        assert.equal(read.status, 200, "Local HTTP server must use this DEV database");
        assert.equal((await read.json()).project.code, p.code);
        if (actor.id !== manager.id) {
          const denied = await fetch(`${origin}/api/planning/projects/${p.id}/cancel`, { method: "POST", headers, body: JSON.stringify({ version: 1, note: "Must reject unauthorized cancellation" }) });
          assert.equal(denied.status, 403);
        }
        const csrf = await fetch(`${origin}/api/planning/projects/${p.id}/cancel`, { method: "POST", headers: { ...headers, Origin: "https://untrusted.example.invalid" }, body: JSON.stringify({ version: 1, note: "Must reject cross-origin cancellation" }) });
        assert.equal(csrf.status, 403);
      }
    }
    await assert.rejects(() => service.addProjectTask(p.id, { ...dates, name: "Wrong role", description: "Operator must not be a technician", assetId: asset.id, assignedTo: operator.id, estimatedMinutes: 30 }, manager));
    await assert.rejects(() => service.addProjectTask(p.id, { ...dates, name: "Forbidden planner", description: "Technician cannot plan", estimatedMinutes: 30 }, tech));
    const ids: string[] = [];
    for (const name of ["Inspect pump one", "Inspect pump two"]) {
      const t = await service.addProjectTask(p.id, { ...dates, name, description: name, assetId: asset.id, assignedTo: tech.id, estimatedMinutes: 30, steps: [{ title: "Inspect and confirm condition" }] }, manager);
      await service.commandTask(t.id, "ready", { version: 1, note: "Ready for work" }, manager); ids.push(t.id);
    }
    let detail = await service.projectDetail(p.id, manager);
    await service.commandProject(p.id, "plan", { version: detail.project.version, note: "Approved test plan" }, manager);
    const converted = await Promise.all([service.convertTask(ids[0], { version: 2, note: "Convert task" }, manager), service.convertTask(ids[0], { version: 2, note: "Convert task retry" }, manager)]);
    assert.equal(converted[0].id, converted[1].id);
    const second = await service.convertTask(ids[1], { version: 2, note: "Convert second task" }, manager);
    assert.ok(converted[0].id); assert.ok(second.id);
    await assert.rejects(() => workflow.assignGovernedWorkOrder(second.id!, { technicianId: operator.id, instructions: "Invalid role assignment", teamName: "", reason: "" }, manager, meta));
    for (const wo of [converted[0], second]) {
      assert.ok(wo.id);
      await workflow.technicianTransition(wo.id, "ACCEPT_ASSIGNMENT", { note: "Accepted assignment" }, tech, meta);
      await workflow.technicianTransition(wo.id, "START", { note: "Started inspection" }, tech, meta);
      const steps = await prisma.workOrderTask.findMany({ where: { workOrderId: wo.id } });
      for (const step of steps) await updateWorkOrderTask(wo.id, step.id, { status: "COMPLETED", result: "Passed", responseValue: "", remarks: "" }, tech, meta);
      await workflow.submitCompletionRevision(wo.id, { diagnosis: "Normal condition", rootCause: "Scheduled inspection", rootCauseUnknownReason: "", remainingIssue: "", recommendation: "", correctiveAction: "Inspected pump", workSummary: "Inspection completed", laborMinutes: 30, partsFinalized: true, noPartsUsed: true, testProcedure: "Functional test", testResult: "Passed", beforePhotoAttachmentIds: [], afterPhotoAttachmentIds: [] }, tech, meta);
      await workflow.decideCompletion(wo.id, { decision: "APPROVE", comment: "Results verified" }, manager, meta);
      if (wo.id === converted[0].id) {
        await workflow.recordOperatorDecision(wo.id, { decision: "REJECT", reason: "Vibration remains", remainingProblem: "Retest required", attachmentIds: [] }, operator, meta);
        await assert.rejects(() => workflow.closeGovernedWorkOrder(wo.id!, "Must not close rejected work", manager, meta));
        await workflow.returnOperatorRejection(wo.id, { decision: "RETURN", comment: "Retest and resolve vibration", requiredActions: ["Retest"] }, manager, meta);
        await workflow.technicianTransition(wo.id, "START", { note: "Started corrective recheck" }, tech, meta);
        const { completionRevisionSchema } = await import("../lib/maintenance/validation");
        await workflow.submitCompletionRevision(wo.id, completionRevisionSchema.parse({ diagnosis: "Vibration retest", rootCause: "Adjustment required", correctiveAction: "Adjusted and tested", workSummary: "Recheck complete", laborMinutes: 10, partsFinalized: true, noPartsUsed: true, testProcedure: "Functional retest", testResult: "Passed" }), tech, meta);
        await workflow.decideCompletion(wo.id, { decision: "APPROVE", comment: "Recheck verified" }, manager, meta);
      }
      await workflow.recordOperatorDecision(wo.id, { decision: "ACCEPT", comment: "Operation accepted" }, operator, meta);
    }
    await Promise.all([workflow.closeGovernedWorkOrder(converted[0].id, "Close first task", manager, meta), workflow.closeGovernedWorkOrder(second.id, "Close second task", manager, meta)]);
    detail = await service.projectDetail(p.id, manager); assert.equal(detail.project.status, "COMPLETED"); assert.equal(Number(detail.project.progress), 100);
    await workflow.closeGovernedWorkOrder(second.id, "Retry close second task", manager, meta);
    const outsider = { ...manager, scopes: [{ ...manager.scopes[0], organizationId: randomUUID(), siteId: randomUUID() }] };
    await assert.rejects(() => service.projectDetail(p.id, outsider));
    const template = await service.createTemplate({ ...scope, name: "PM test template", steps: [{ title: "Inspect motor" }] }, manager);
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
    const program = await service.createProgram({ ...scope, name: "Daily PM integration", priority: "HIGH", estimatedMinutes: 45, assetId: asset.id, templateId: template.id, assignedTo: tech.id, operatorId: operator.id, startDate: today, expiryDate: today, frequency: "DAY", interval: 1, timezone: "Asia/Bangkok", localTime: "08:00", leadTimeDays: 1 }, manager);
    await service.commandProgram(program.id, "activate", { version: 1, note: "Activate PM" }, manager);
    const dryRun = JSON.parse(await runWorker(manager.id, program.id));
    assert.equal(dryRun.mode, "DRY_RUN");
    assert.equal(await prisma.pmOccurrences.count({ where: { programId: program.id } }), 0);
    const lease = await pool.getConnection();
    try {
      await lease.query("SELECT GET_LOCK('ma_next_planning_worker',0)");
      assert.match(await runWorker(manager.id, program.id), /Another worker owns the lease/);
    } finally { await lease.query("SELECT RELEASE_LOCK('ma_next_planning_worker')"); lease.release(); }
    await runWorker(manager.id, program.id, true);
    await runWorker(manager.id, program.id, true);
    assert.equal(await prisma.pmOccurrences.count({ where: { programId: program.id } }), 1);
    await assert.rejects(() => runWorker(tech.id, program.id, true));
    const generated = await Promise.all([service.generateProgram(program.id, { version: 2, dates: [today], note: "Generate due PM" }, manager), service.generateProgram(program.id, { version: 2, dates: [today], note: "Retry due PM" }, manager)]);
    assert.ok(generated[0].results[0].id); assert.equal(generated[0].results[0].id, generated[1].results[0].id);
    const pmId = generated[0].results[0].id!;
    const { lockPlanningSource, syncPlanningSource } = await import("../lib/planning/work-order-link");
    await assert.rejects(() => db.transaction(async tx => { await lockPlanningSource(tx, pmId); await tx.update(workOrders).set({ status: "CLOSED", closedAt: new Date() }).where(eq(workOrders.id, pmId)); await syncPlanningSource(tx, pmId, manager); throw new Error("Injected rollback"); }));
    const [occ] = await db.select().from(pmOccurrences).where(eq(pmOccurrences.workOrderId, pmId)); assert.equal(occ.status, "GENERATED");
    const [pm] = await db.select().from(workOrders).where(eq(workOrders.id, pmId)); assert.equal(pm.status, "ASSIGNED");
    assert.equal(pm.priority, "HIGH"); assert.equal(pm.estimatedMinutes, 45);
    assert.equal(+pm.plannedFinishAt! - +pm.plannedStartAt!, 45 * 60000);
    const preview = await service.programDetail(program.id, manager, { from: today, to: today }); assert.equal(preview.occurrences.length, 1);
    const { drainPlanningOutbox } = await import("../lib/planning/outbox");
    assert.equal((await drainPlanningOutbox(100, tech.id)).delivered, 3);
    assert.equal((await drainPlanningOutbox(100, tech.id)).delivered, 0);
    assert.equal(await prisma.notificationRecipient.count({ where: { userId: tech.id } }), 3);
    console.log(JSON.stringify({ result: "PASS", fixtureOrganization: org.code, projectId: p.id, programId: program.id, assertions: ["concurrent conversion", "technician-reviewer-operator closure", "concurrent project roll-up", "repeat close", "cross-site rejection", "PM duplicate generation", "transaction rollback", "separate real role permissions", "wrong-role rejection", "worker dry-run", "worker lease exclusion", "worker repeated execution", "PM priority/duration snapshot", ...(process.argv.includes("--http") ? ["HTTP authentication and CSRF", "HTTP role denial"] : [])] }, null, 2));
  } finally {
    if (sessionIds.length) await prisma.session.updateMany({ where: { id: { in: sessionIds } }, data: { revokedAt: new Date() } });
    await prisma.$disconnect(); await pool.end();
  }
}
main().catch(e => { console.error(e instanceof Error ? e.message : "Integration failed"); process.exitCode = 1; });
