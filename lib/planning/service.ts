import { randomUUID } from "node:crypto";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { assets, workOrders, workOrderEvents, workOrderTasks, auditLogs } from "@/lib/db/schema";
import { maintenanceProjects as projects, maintenanceProjectTasks as tasks, projectTaskDependencies as dependencies, maintenanceTemplates as templates, preventivePrograms as programs, pmOccurrences as occurrences, planningEvents as events } from "@/lib/db/planning-schema";
import type { AuthenticatedUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/http";
import { isAdminActor, requireActorPermission } from "@/lib/maintenance/authorization";
import type { Permission } from "../auth/permissions";
import { planningGrant, requirePlanningScope } from "./authorization";
import { occurrenceDates, scheduledInstant, localDateAt, rollupProject, taskStatusFromWorkOrder } from "./domain";
import { commandSchema, generateSchema, previewSchema, programSchema, projectSchema, stepSchema, taskSchema, templateSchema } from "./validation";
import { enqueuePlanningNotification } from "./outbox";
import { requireResponsibleCapability } from "./responsible-user";

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Actor = AuthenticatedUser;
type Scope = { organizationId: string; siteId: string; departmentId?: string | null };
const fail = (message: string, code = "PLANNING_CONFLICT") => { throw new HttpError(409, message, code); };
const requireManager = (actor: Actor, permission: Permission = "PROJECT_MANAGE") => requireActorPermission(actor, permission);
const dates = (v: { plannedStartAt: string; plannedFinishAt: string }) => ({ plannedStartAt: new Date(v.plannedStartAt), plannedFinishAt: new Date(v.plannedFinishAt) });
const stamp = (actor: Actor) => ({ id: randomUUID(), createdBy: actor.id, createdAt: new Date(), updatedAt: new Date(), version: 1 });

async function event(tx: Tx, scope: Scope, entityType: string, entityId: string, eventType: string, note: string, actor: Actor) {
  await tx.insert(events).values({ id: randomUUID(), organizationId: scope.organizationId, entityType, entityId, eventType, note, actorId: actor.id, createdAt: new Date() });
  await tx.insert(auditLogs).values({ id: randomUUID(), requestId: randomUUID(), organizationId: scope.organizationId, actorUserId: actor.id, actorName: actor.fullName, action: eventType, category: "PLANNING", targetType: entityType, targetId: entityId, result: "SUCCESS", description: note, createdAt: new Date() });
}
async function checkScope(scope: Scope, actor: Actor, permission: Permission = "PROJECT_MANAGE") {
  requirePlanningScope(actor, scope, permission);
  const site = await prisma.site.findFirst({ where: { id: scope.siteId, organizationId: scope.organizationId, active: true } });
  if (!site) fail("Select an active site in the organization", "INVALID_SITE");
  if (scope.departmentId && !await prisma.department.findFirst({ where: { id: scope.departmentId, organizationId: scope.organizationId, siteId: scope.siteId, active: true } })) fail("Department does not belong to the site", "INVALID_DEPARTMENT");
}
async function checkAsset(tx: Tx, id: string, scope: Scope) {
  const [asset] = await tx.select().from(assets).where(eq(assets.id, id)).limit(1);
  if (!asset || asset.status !== "ACTIVE" || asset.organizationId !== scope.organizationId || asset.siteId !== scope.siteId) fail("Assign this active asset to the project's organization/site before planning work", "ASSET_SCOPE_REQUIRED");
}
async function project(tx: Tx, id: string, actor: Actor) {
  const [row] = await tx.select().from(projects).where(eq(projects.id, id)).for("update");
  if (!row) throw new HttpError(404, "Project not found"); requirePlanningScope(actor, row, "PROJECT_MANAGE"); return row;
}
function expected(actual: number, requested: number) { if (actual !== requested) fail("This record changed. Reload and preview again", "STALE_VERSION"); }

export async function planningReferences(actor: Actor, area: "projects" | "programs" = "projects") {
  requireActorPermission(actor, area === "projects" ? "PROJECT_VIEW" : "PM_VIEW");
  const [siteRows, departmentRows, userRows] = await Promise.all([
    prisma.site.findMany({ where: { active: true }, select: { id: true, name: true, organizationId: true } }),
    prisma.department.findMany({ where: { active: true }, select: { id: true, name: true, organizationId: true, siteId: true } }),
    prisma.user.findMany({ where: { status: "ACTIVE" }, select: { id: true, fullName: true, roles: { where: { role: { active: true } }, select: { scopeType: true, organizationId: true, siteId: true, departmentId: true } } } }),
  ]);
  const canView = (r: { organizationId?: string | null; siteId?: string | null; departmentId?: string | null }) => isAdminActor(actor) || actor.scopes?.some(s => planningGrant(s, r, area === "projects" ? "PROJECT_VIEW" : "PM_VIEW"));
  return { sites: siteRows.filter(s => canView({ ...s, siteId: s.id }) || actor.scopes?.some(g => g.siteId === s.id && planningGrant(g, g, area === "projects" ? "PROJECT_VIEW" : "PM_VIEW"))), departments: departmentRows.filter(canView), users: userRows.filter(u => isAdminActor(actor) || u.roles.some(s => s.scopeType === "GLOBAL" || canView(s))).map(u => ({ id: u.id, fullName: u.fullName })), canManage: isAdminActor(actor) || actor.permissions.includes(area === "projects" ? "PROJECT_MANAGE" : "PM_MANAGE"), canGenerate: isAdminActor(actor) || actor.permissions.includes("PM_GENERATE"), isAdmin: isAdminActor(actor) };
}

export async function bindAssetScope(assetId: string, scope: Scope, actor: Actor) {
  if (!isAdminActor(actor)) throw new HttpError(403, "Asset scope assignment requires an administrator");
  await checkScope(scope, actor);
  await db.transaction(async tx => {
    const [asset] = await tx.select().from(assets).where(eq(assets.id, assetId)).for("update");
    if (!asset) throw new HttpError(404, "Asset not found");
    if (asset.organizationId && (asset.organizationId !== scope.organizationId || asset.siteId !== scope.siteId)) fail("Existing scope cannot be reassigned by this command");
    await tx.update(assets).set({ organizationId: scope.organizationId, siteId: scope.siteId, updatedAt: new Date(), updatedBy: actor.id }).where(eq(assets.id, assetId));
    await event(tx, scope, "ASSET", assetId, "ASSET_SCOPE_ASSIGNED", "Explicit asset scope assignment", actor);
  });
}

export async function listProjects(actor: Actor, page = 1) {
  requireActorPermission(actor, "PROJECT_VIEW");
  const scopes = planningScopeSql(actor);
  if (!isAdminActor(actor) && !actor.scopes?.length) return [];
  return db.select().from(projects).where(scopes).orderBy(desc(projects.createdAt)).limit(50).offset((page - 1) * 50);
}
function planningScopeSql(actor: Actor, permission: Permission = "PROJECT_VIEW") {
  if (isAdminActor(actor)) return sql`1=1`;
  const conditions = (actor.scopes ?? []).filter(s => planningGrant(s, { organizationId: s.organizationId, siteId: s.siteId, departmentId: s.departmentId }, permission)).map(s => {
    if (s.scopeType === "GLOBAL") return sql`1=1`;
    if (!s.organizationId) return sql`1=0`;
    if (s.scopeType === "ORGANIZATION") return sql`organization_id=${s.organizationId}`;
    if (!s.siteId) return sql`1=0`;
    if (s.scopeType === "SITE") return sql`organization_id=${s.organizationId} AND site_id=${s.siteId}`;
    return s.departmentId ? sql`organization_id=${s.organizationId} AND site_id=${s.siteId} AND department_id=${s.departmentId}` : sql`1=0`;
  });
  return conditions.length ? sql`(${sql.join(conditions, sql` OR `)})` : sql`1=0`;
}
export async function createProject(input: unknown, actor: Actor) {
  requireManager(actor); const v = projectSchema.parse(input); await checkScope(v, actor); await requireResponsibleCapability(v.ownerId, v, "PROJECT_MANAGE"); await requireResponsibleCapability(v.operatorId, v, "NOTIFICATION_ACCEPT_WORK");
  const row = { ...v, ...dates(v), ...stamp(actor) };
  await db.transaction(async tx => { await tx.insert(projects).values(row); await event(tx, v, "PROJECT", row.id, "PROJECT_CREATED", v.name, actor); }); return row;
}
export async function projectDetail(id: string, actor: Actor) {
  requireActorPermission(actor, "PROJECT_VIEW");
  const [row] = await db.select().from(projects).where(eq(projects.id, id)); if (!row) throw new HttpError(404, "Project not found"); requirePlanningScope(actor, row, "PROJECT_VIEW");
  const taskRows = await db.select({ task: tasks, woStatus: workOrders.status, woCode: workOrders.code }).from(tasks).leftJoin(workOrders, eq(tasks.workOrderId, workOrders.id)).where(eq(tasks.projectId, id)).limit(501);
  if (taskRows.length > 500) fail("Project task limit exceeded");
  return { project: row, tasks: taskRows.map(({ task, woStatus, woCode }) => ({ ...task, status: woStatus ? taskStatusFromWorkOrder[woStatus] : task.status, woCode, woStatus })), dependencies: await db.select().from(dependencies).where(eq(dependencies.projectId, id)), events: await db.select().from(events).where(eq(events.entityId, id)).orderBy(desc(events.createdAt)).limit(100) };
}
export async function addProjectTask(projectId: string, input: unknown, actor: Actor) {
  requireManager(actor); const v = taskSchema.parse(input);
  return db.transaction(async tx => {
    const p = await project(tx, projectId, actor); if (!["DRAFT", "PLANNED"].includes(p.status)) fail("Replan project before changing its scope");
    const existing = await tx.select().from(tasks).where(eq(tasks.projectId, projectId)); if (existing.length >= 500) fail("Maximum 500 tasks per project");
    if (v.parentId && !existing.some(t => t.id === v.parentId && t.kind === "SUMMARY" && t.status !== "CANCELLED")) fail("Parent must be an active summary task in this project");
    if (new Set(v.predecessorIds).size !== v.predecessorIds.length || v.predecessorIds.some(id => !existing.some(t => t.id === id && t.kind !== "SUMMARY" && t.status !== "CANCELLED"))) fail("Invalid predecessors");
    const scope = { organizationId: p.organizationId, siteId: p.siteId, departmentId: p.departmentId };
    if (v.assetId) await checkAsset(tx, v.assetId, scope); if (v.assignedTo) await requireResponsibleCapability(v.assignedTo, scope, "WORK_ORDER_START");
    if (v.phase === "SHUTDOWN" && (Math.floor(+new Date(v.plannedStartAt) / 1000) < Math.floor(+p.plannedStartAt / 1000) || Math.floor(+new Date(v.plannedFinishAt) / 1000) > Math.floor(+p.plannedFinishAt / 1000))) fail("Shutdown phase task must fit the shutdown window");
    const { predecessorIds, ...data } = v;
    const row = { ...data, ...scope, ...dates(v), ...stamp(actor), projectId, steps: JSON.stringify(v.steps) };
    await tx.insert(tasks).values(row);
    if (predecessorIds.length) await tx.insert(dependencies).values(predecessorIds.map(id => ({ id: randomUUID(), projectId, predecessorId: id, successorId: row.id })));
    await tx.update(projects).set({ version: p.version + 1, updatedAt: new Date() }).where(eq(projects.id, p.id));
    await event(tx, p, "PROJECT", p.id, "TASK_CREATED", v.name, actor); return row;
  });
}
export async function commandProject(id: string, command: string, input: unknown, actor: Actor) {
  requireManager(actor); const v = commandSchema.parse(input);
  return db.transaction(async tx => {
    const p = await project(tx, id, actor); expected(p.version, v.version);
    const items = await tx.select().from(tasks).where(eq(tasks.projectId, id));
    let status = p.status;
    if (command === "plan" && p.status === "DRAFT" && items.length) status = "PLANNED";
    else if (command === "start" && p.status === "PLANNED") status = "IN_PROGRESS";
    else if (command === "hold" && ["PLANNED", "IN_PROGRESS"].includes(p.status)) status = "ON_HOLD";
    else if (command === "resume" && p.status === "ON_HOLD") status = rollupProject("IN_PROGRESS", items).status;
    else if (command === "close" && p.status === "COMPLETED" && (p.ownerId === actor.id || isAdminActor(actor))) status = "CLOSED";
    else if (command === "replan" && ["PLANNED", "COMPLETED"].includes(p.status)) status = "PLANNED";
    else if (command === "cancel" && !items.some(t => t.workOrderId || t.status === "COMPLETED") && !["CLOSED", "CANCELLED"].includes(p.status)) status = "CANCELLED";
    else fail("Command is not allowed in this project state");
    await tx.update(projects).set({ status, version: p.version + 1, updatedAt: new Date(), closureNote: command === "close" ? v.note : p.closureNote, baseline: command === "plan" ? JSON.stringify(items) : p.baseline }).where(eq(projects.id, id));
    await event(tx, p, "PROJECT", id, `PROJECT_${command.toUpperCase()}`, v.note, actor); return { id, status };
  });
}

async function taskForCommand(tx: Tx, id: string, actor: Actor) {
  const [ref] = await tx.select({ projectId: tasks.projectId }).from(tasks).where(eq(tasks.id, id)); if (!ref) throw new HttpError(404, "Task not found");
  const p = await project(tx, ref.projectId, actor); const [t] = await tx.select().from(tasks).where(eq(tasks.id, id)).for("update"); return { p, t };
}
export async function commandTask(id: string, command: string, input: unknown, actor: Actor) {
  requireManager(actor); const v = commandSchema.parse(input);
  return db.transaction(async tx => {
    const { p, t } = await taskForCommand(tx, id, actor); expected(t.version, v.version);
    if (!["DRAFT", "PLANNED", "IN_PROGRESS"].includes(p.status)) fail("Project does not allow task changes");
    if (t.workOrderId) fail("Use linked Work Order commands");
    const status = command === "ready" && t.status === "DRAFT" ? "READY" : command === "complete-milestone" && t.kind === "MILESTONE" && t.status === "READY" ? "COMPLETED" : command === "cancel" && ["DRAFT", "READY"].includes(t.status) ? "CANCELLED" : null;
    if (!status) fail("Invalid task command");
    if (status === "COMPLETED") {
      const predecessors = await tx.select({ status: tasks.status }).from(dependencies).innerJoin(tasks, eq(dependencies.predecessorId, tasks.id)).where(eq(dependencies.successorId, id));
      if (predecessors.some(t => t.status !== "COMPLETED")) fail("Complete predecessors before confirming this milestone", "DEPENDENCY_BLOCKED");
    }
    await tx.update(tasks).set({ status: status!, reason: v.note, actualFinishAt: status === "COMPLETED" ? new Date() : null, version: t.version + 1, updatedAt: new Date() }).where(eq(tasks.id, id));
    await recomputeProject(tx, p.id); await event(tx, p, "PROJECT", p.id, `TASK_${command.toUpperCase()}`, `${t.name}: ${v.note}`, actor); return { id, status };
  });
}

async function createSourceOrder(tx: Tx, data: Scope & { id: string; sourceType: "SHUTDOWN_TASK" | "PREVENTIVE_EVENT"; sourceId: string; assetId: string; name: string; description: string; assignedTo: string; steps: string; plannedStartAt: Date; plannedFinishAt: Date; estimatedMinutes: number; priority?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" }, actor: Actor) {
  await checkAsset(tx, data.assetId, data); await requireResponsibleCapability(data.assignedTo, data, "WORK_ORDER_START");
  const now = new Date(); const code = `WO-${randomUUID().slice(0, 8).toUpperCase()}`;
  await tx.insert(workOrders).values({ id: data.id, code, organizationId: data.organizationId, siteId: data.siteId, departmentId: data.departmentId, sourceType: data.sourceType, sourceRecordId: data.sourceId, workType: data.sourceType === "SHUTDOWN_TASK" ? "SHUTDOWN" : "PREVENTIVE", assetId: data.assetId, title: data.name, description: data.description, assignedTo: data.assignedTo, status: "ASSIGNED", priority: data.priority ?? "MEDIUM", severity: "MODERATE", equipmentOperatingStatus: "UNKNOWN", plannedStartAt: data.plannedStartAt, plannedFinishAt: data.plannedFinishAt, dueAt: data.plannedFinishAt, estimatedMinutes: data.estimatedMinutes, createdAt: now, updatedAt: now, createdBy: actor.id, updatedBy: actor.id });
  const steps = z.array(stepSchema).parse(JSON.parse(data.steps));
  if (steps.length) await tx.insert(workOrderTasks).values(steps.map((s, i) => ({ id: randomUUID(), workOrderId: data.id, sequence: i + 1, title: s.title, description: s.description, kind: s.kind, required: s.required, status: "OPEN" as const, createdAt: now, updatedAt: now })));
  await tx.insert(workOrderEvents).values({ id: randomUUID(), workOrderId: data.id, eventType: "SOURCE_CONVERTED", toStatus: "ASSIGNED", actorUserId: actor.id, note: data.name, createdAt: now });
  await enqueuePlanningNotification(tx, `SOURCE_WO:${data.id}`, data.assignedTo, actor.id, `${code} assigned`, data.name, `/work-orders/${data.id}`);
  return { id: data.id, code };
}
export async function convertTask(id: string, input: unknown, actor: Actor, preview = false) {
  requireManager(actor); const v = commandSchema.parse(input);
  return db.transaction(async tx => {
    const { p, t } = await taskForCommand(tx, id, actor);
    if (t.workOrderId) return { id: t.workOrderId, existing: true };
    expected(t.version, v.version);
    const errors = [!["PLANNED", "IN_PROGRESS"].includes(p.status) && "Project must be planned or in progress", t.kind !== "EXECUTION" && "Only execution tasks can convert", t.status !== "READY" && "Task must be ready", !t.assetId && "Asset is required", !t.assignedTo && "Assigned technician is required"].filter(Boolean);
    if (preview) return { errors, task: t, project: p.name };
    if (errors.length) fail(errors.join("; "));
    const wo = await createSourceOrder(tx, { ...t, id: randomUUID(), sourceType: "SHUTDOWN_TASK", sourceId: t.id, priority: p.priority, assetId: t.assetId!, assignedTo: t.assignedTo! }, actor);
    await tx.update(tasks).set({ status: "WO_CREATED", workOrderId: wo.id, version: t.version + 1, updatedAt: new Date() }).where(eq(tasks.id, id));
    await event(tx, p, "PROJECT", p.id, "TASK_CONVERTED", `${t.name} → ${wo.code}`, actor); return wo;
  });
}

export async function recomputeProject(tx: Tx, id: string) {
  const [p] = await tx.select().from(projects).where(eq(projects.id, id)).for("update");
  const rows = await tx.select().from(tasks).where(eq(tasks.projectId, id)).for("update");
  const result = rollupProject(p.status, rows);
  for (const summary of rows.filter(t => t.kind === "SUMMARY")) {
    const descendants = new Set([summary.id]); let changed = true;
    while (changed) { changed = false; for (const t of rows) if (t.parentId && descendants.has(t.parentId) && !descendants.has(t.id)) { descendants.add(t.id); changed = true; } }
    const rollup = rollupProject("PLANNED", rows.filter(t => descendants.has(t.id)));
    await tx.update(tasks).set({ status: rollup.status === "COMPLETED" ? "COMPLETED" : rollup.status === "IN_PROGRESS" ? "IN_PROGRESS" : "READY", updatedAt: new Date() }).where(eq(tasks.id, summary.id));
  }
  const finishDates = rows.filter(t => t.kind !== "SUMMARY" && t.status === "COMPLETED" && t.actualFinishAt).map(t => +t.actualFinishAt!);
  await tx.update(projects).set({ status: result.status, progress: String(result.progress), actualFinishAt: result.completed === result.total && result.total > 0 && finishDates.length ? new Date(Math.max(...finishDates)) : null, version: p.version + 1, updatedAt: new Date() }).where(eq(projects.id, id));
}

export async function createTemplate(input: unknown, actor: Actor) {
  requireManager(actor, "PM_MANAGE"); const v = templateSchema.parse(input); await checkScope(v, actor, "PM_MANAGE"); const row = { ...v, ...stamp(actor), steps: JSON.stringify(v.steps) };
  await db.transaction(async tx => { await tx.insert(templates).values(row); await event(tx, v, "TEMPLATE", row.id, "TEMPLATE_CREATED", v.name, actor); }); return row;
}
export async function listPrograms(actor: Actor) {
  requireActorPermission(actor, "PM_VIEW");
  const items = await db.select().from(programs).where(planningScopeSql(actor, "PM_VIEW")).orderBy(desc(programs.createdAt)).limit(500);
  const templateRows = await db.select().from(templates).where(planningScopeSql(actor, "PM_VIEW")).orderBy(desc(templates.createdAt)).limit(500);
  return { items, templates: templateRows };
}
export async function createProgram(input: unknown, actor: Actor) {
  requireManager(actor, "PM_MANAGE"); const v = programSchema.parse(input); await checkScope(v, actor, "PM_MANAGE"); await requireResponsibleCapability(v.assignedTo, v, "WORK_ORDER_START"); await requireResponsibleCapability(v.operatorId, v, "NOTIFICATION_ACCEPT_WORK");
  return db.transaction(async tx => {
    await checkAsset(tx, v.assetId, v); const [template] = await tx.select().from(templates).where(eq(templates.id, v.templateId));
    if (!template || template.organizationId !== v.organizationId || template.siteId !== v.siteId) fail("Template must belong to this site");
    requirePlanningScope(actor, template, "PM_VIEW");
    if (template.departmentId && template.departmentId !== v.departmentId) fail("Template must belong to the selected department");
    const row = { ...v, ...stamp(actor), steps: template.steps, templateVersion: template.version };
    await tx.insert(programs).values(row); await event(tx, v, "PROGRAM", row.id, "PROGRAM_CREATED", v.name, actor); return row;
  });
}
export async function programDetail(id: string, actor: Actor, window?: unknown) {
  requireActorPermission(actor, "PM_VIEW"); const [p] = await db.select().from(programs).where(eq(programs.id, id)); if (!p) throw new HttpError(404, "Program not found"); requirePlanningScope(actor, p, "PM_VIEW");
  const range = window ? previewSchema.parse(window) : { from: localDateAt(new Date(), p.timezone), to: localDateAt(new Date(Date.now() + 90 * 86400000), p.timezone) };
  return { program: p, dates: occurrenceDates(p.startDate, p.expiryDate, p.frequency, p.interval, range.from, range.to), occurrences: await db.select().from(occurrences).where(and(eq(occurrences.programId, id), gte(occurrences.scheduledDate, range.from), lte(occurrences.scheduledDate, range.to))).orderBy(desc(occurrences.scheduledAt)).limit(366) };
}
export async function commandProgram(id: string, command: string, input: unknown, actor: Actor) {
  requireManager(actor, "PM_MANAGE"); const v = commandSchema.parse(input);
  return db.transaction(async tx => {
    const [p] = await tx.select().from(programs).where(eq(programs.id, id)).for("update"); if (!p) throw new HttpError(404, "Program not found"); requirePlanningScope(actor, p, "PM_MANAGE"); expected(p.version, v.version);
    if (!["activate", "pause"].includes(command)) fail("Invalid program command");
    await tx.update(programs).set({ status: command === "activate" ? "ACTIVE" : "PAUSED", version: p.version + 1, updatedAt: new Date() }).where(eq(programs.id, id));
    await event(tx, p, "PROGRAM", id, `PROGRAM_${command.toUpperCase()}`, v.note, actor);
  });
}
export async function generateProgram(id: string, input: unknown, actor: Actor) {
  requireManager(actor, "PM_GENERATE"); const v = generateSchema.parse(input); const results: { date: string; id?: string; error?: string }[] = [];
  for (const date of [...new Set(v.dates)]) {
    try {
      const result = await db.transaction(async tx => {
        const [p] = await tx.select().from(programs).where(eq(programs.id, id)).for("update"); if (!p) throw new HttpError(404, "Program not found"); requirePlanningScope(actor, p, "PM_GENERATE"); expected(p.version, v.version);
        if (p.status !== "ACTIVE") fail("Activate program before generation");
        if (!occurrenceDates(p.startDate, p.expiryDate, p.frequency, p.interval, date, date).length) fail("Date is outside this program schedule");
        const [existing] = await tx.select().from(occurrences).where(and(eq(occurrences.programId, id), eq(occurrences.scheduledDate, date)));
        if (existing) return { date, id: existing.workOrderId ?? existing.id };
        const today = localDateAt(new Date(), p.timezone);
        if (date < today && !v.catchUp) fail("Missed dates require explicit catch-up confirmation");
        const occurrenceId = randomUUID(); const instant = scheduledInstant(date, p.localTime, p.timezone);
        if (date > localDateAt(new Date(Date.now() + p.leadTimeDays * 86400000), p.timezone)) fail("Date is outside the generation lead window");
        let wo: { id: string; code: string } | undefined;
        if (v.action === "GENERATE") wo = await createSourceOrder(tx, { ...p, id: randomUUID(), sourceId: occurrenceId, sourceType: "PREVENTIVE_EVENT", description: p.name, plannedStartAt: instant, plannedFinishAt: new Date(+instant + p.estimatedMinutes * 60000) }, actor);
        await tx.insert(occurrences).values({ id: occurrenceId, programId: id, organizationId: p.organizationId, assetId: p.assetId, scheduledDate: date, scheduledAt: instant, status: wo ? "GENERATED" : "SKIPPED", workOrderId: wo?.id, programVersion: p.version, reason: v.note, createdAt: new Date() });
        await event(tx, p, "PROGRAM", id, wo ? "PM_GENERATED" : "PM_SKIPPED", `${date}: ${v.note}`, actor); return { date, id: wo?.id ?? occurrenceId };
      }); results.push(result);
    } catch (error) { if (!(error instanceof HttpError)) throw error; results.push({ date, error: error.message }); }
  }
  return { results };
}
