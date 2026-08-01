import { randomBytes, randomUUID } from "node:crypto";
import { and, asc, count, desc, eq, gte, like, lt, lte, or } from "drizzle-orm";
import type { z } from "zod";
import { db } from "@/lib/db";
import {
  assets, auditLogs, workOrderAcceptances, workOrderAssignments, workOrderBacklogEvents, workOrderEvents,
  workOrderToolLoans, workOrders, type WorkOrderStatus,
} from "@/lib/db/schema";
import type { AuthenticatedUser } from "@/lib/auth/session";
import type { RequestMeta } from "@/lib/auth/request";
import { maskSensitive } from "@/lib/auth/mask";
import { HttpError } from "@/lib/http";
import { createNotification } from "@/lib/notifications/service";
import { logger } from "@/lib/logger";
import { transitionWorkOrder } from "@/lib/maintenance/workflow";
import type { acceptanceSchema, assignmentSchema, backlogSchema, resumeSchema, toolLoanCommandSchema, toolLoanSchema, workOrderCreateSchema, workOrderListSchema, workOrderUpdateSchema } from "@/lib/maintenance/validation";

type Actor = AuthenticatedUser;
type ListInput = z.infer<typeof workOrderListSchema>;
type CreateInput = z.infer<typeof workOrderCreateSchema>;
type UpdateInput = z.infer<typeof workOrderUpdateSchema>;
type AssignmentInput = z.infer<typeof assignmentSchema>;
type BacklogInput = z.infer<typeof backlogSchema>;
type ResumeInput = z.infer<typeof resumeSchema>;
type ToolInput = z.infer<typeof toolLoanSchema>;
type ToolCommandInput = z.infer<typeof toolLoanCommandSchema>;
type AcceptanceInput = z.infer<typeof acceptanceSchema>;

const code = () => `WO-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomBytes(3).toString("hex").toUpperCase()}`;
const dateOrNull = (value?: string | null) => value ? new Date(value) : null;
const requireActorPermission = (actor: Actor, permission: "MANAGE_WORK_ORDERS" | "EXECUTE_WORK_ORDERS") => {
  if (!actor.permissions.includes(permission)) throw new HttpError(403, `Missing workflow permission: ${permission}`, "WORKFLOW_FORBIDDEN");
};
const audit = (actor: Actor, meta: RequestMeta, action: string, order: { id: string; code: string }, description: string, previousValues?: unknown, newValues?: unknown) => ({
  id: randomUUID(), actorUserId: actor.id, actorName: actor.fullName, action, category: "WORK_ORDER", targetType: "WORK_ORDER", targetId: order.id, targetName: order.code,
  result: "SUCCESS" as const, description, previousValues: previousValues === undefined ? undefined : JSON.stringify(maskSensitive(previousValues)), newValues: newValues === undefined ? undefined : JSON.stringify(maskSensitive(newValues)),
  ipAddress: meta.ipAddress, userAgent: meta.userAgent, requestId: meta.requestId, createdAt: new Date(),
});

export async function listWorkOrders(input: ListInput) {
  const conditions = [];
  if (input.q) conditions.push(or(like(workOrders.code, `%${input.q}%`), like(workOrders.title, `%${input.q}%`), like(assets.code, `%${input.q}%`), like(assets.name, `%${input.q}%`))!);
  if (input.type) conditions.push(eq(workOrders.workType, input.type));
  if (input.status) conditions.push(eq(workOrders.status, input.status));
  if (input.priority) conditions.push(eq(workOrders.priority, input.priority));
  if (input.departmentId) conditions.push(eq(workOrders.departmentId, input.departmentId));
  if (input.assignedTo) conditions.push(eq(workOrders.assignedTo, input.assignedTo));
  if (input.dateFrom) conditions.push(gte(workOrders.dueAt, new Date(input.dateFrom)));
  if (input.dateTo) conditions.push(lte(workOrders.dueAt, new Date(input.dateTo)));
  if (input.overdue === "true") conditions.push(and(lt(workOrders.dueAt, new Date()), or(eq(workOrders.status, "OPEN"), eq(workOrders.status, "IN_PROGRESS"), eq(workOrders.status, "BACKLOG")))!);
  const where = conditions.length ? and(...conditions) : undefined;
  const sortColumns = { updatedAt: workOrders.updatedAt, code: workOrders.code, dueAt: workOrders.dueAt, priority: workOrders.priority, status: workOrders.status } as const;
  const orderBy = input.order === "asc" ? asc(sortColumns[input.sort]) : desc(sortColumns[input.sort]);
  const base = db.select({
    id: workOrders.id, code: workOrders.code, sourceType: workOrders.sourceType, workType: workOrders.workType, title: workOrders.title,
    priority: workOrders.priority, severity: workOrders.severity, status: workOrders.status, assetId: workOrders.assetId, assetCode: assets.code,
    assetName: assets.name, departmentId: workOrders.departmentId, crewName: workOrders.crewName, assignedTo: workOrders.assignedTo,
    plannedStartAt: workOrders.plannedStartAt, plannedFinishAt: workOrders.plannedFinishAt, dueAt: workOrders.dueAt,
    estimatedMinutes: workOrders.estimatedMinutes, startedAt: workOrders.startedAt, closedAt: workOrders.closedAt, updatedAt: workOrders.updatedAt,
  }).from(workOrders).innerJoin(assets, eq(workOrders.assetId, assets.id)).where(where);
  const [items, totals] = await Promise.all([
    base.orderBy(orderBy).limit(input.pageSize).offset((input.page - 1) * input.pageSize),
    db.select({ count: count() }).from(workOrders).innerJoin(assets, eq(workOrders.assetId, assets.id)).where(where),
  ]);
  return { items, total: totals[0]?.count ?? 0, page: input.page, pageSize: input.pageSize };
}

export async function createWorkOrder(input: CreateInput, actor: Actor, meta: RequestMeta) {
  requireActorPermission(actor, "MANAGE_WORK_ORDERS");
  if (input.sourceType === "NOTIFICATION") throw new HttpError(400, "Use the notification review command to create notification work orders", "INVALID_SOURCE_COMMAND");
  const id = randomUUID(); const orderCode = code(); const now = new Date();
  await db.transaction(async (tx) => {
    const asset = (await tx.select({ status: assets.status }).from(assets).where(eq(assets.id, input.assetId)).limit(1))[0];
    if (!asset || asset.status !== "ACTIVE") throw new HttpError(400, "Work order requires an active asset", "INVALID_ASSET");
    await tx.insert(workOrders).values({
      id, code: orderCode, notificationId: null, sourceType: input.sourceType, sourceRecordId: input.sourceRecordId ?? null, workType: input.workType,
      assetId: input.assetId, title: input.title, description: input.description, priority: input.priority, severity: input.severity,
      equipmentOperatingStatus: input.equipmentOperatingStatus, status: "OPEN", departmentId: input.departmentId ?? null, crewName: input.crewName ?? null,
      leadUserId: input.leadUserId ?? null, vendorName: input.vendorName ?? null, customerName: input.customerName ?? null,
      reporterName: input.reporterName ?? actor.fullName, reporterPhone: input.reporterPhone ?? null, reportedAt: dateOrNull(input.reportedAt) ?? now,
      plannedStartAt: dateOrNull(input.plannedStartAt), plannedFinishAt: dateOrNull(input.plannedFinishAt), dueAt: dateOrNull(input.dueAt), estimatedMinutes: input.estimatedMinutes ?? null,
      checklistTemplateId: input.checklistTemplateId ?? null, maintenanceTemplateId: input.maintenanceTemplateId ?? null, assignedTo: input.assignedTo ?? null,
      supervisorId: input.supervisorId ?? null, backlogReason: null, notes: input.notes || null, createdAt: now, updatedAt: now, createdBy: actor.id, updatedBy: actor.id,
    });
    if (input.assignedTo) await tx.insert(workOrderAssignments).values({ id: randomUUID(), workOrderId: id, departmentId: input.departmentId ?? null, userId: input.assignedTo, teamName: input.crewName ?? null, assignmentType: "TECHNICIAN", assignedAt: now, assignedBy: actor.id, note: "Initial assignment" });
    await tx.insert(workOrderEvents).values({ id: randomUUID(), workOrderId: id, eventType: "WORK_ORDER_CREATED", toStatus: "OPEN", note: `${input.workType} work order created from ${input.sourceType}`, actorUserId: actor.id, createdAt: now });
    await tx.insert(auditLogs).values(audit(actor, meta, "WORK_ORDER_CREATED", { id, code: orderCode }, `Created ${orderCode}`, undefined, input));
  });
  if (input.assignedTo) await createNotification({ type: "WORK_ORDER_ASSIGNED", title: `Work order ${orderCode} assigned`, message: input.title, actionUrl: `/work-orders/${id}`, sourceType: "WORK_ORDER", sourceId: id, recipientIds: [input.assignedTo] }, actor, meta).catch((error) => logger.error("Work order notification failed", { id, error: error instanceof Error ? error.message : "Unknown" }));
  return { id, code: orderCode, status: "OPEN" as const };
}

export async function updateWorkOrder(id: string, input: UpdateInput, actor: Actor, meta: RequestMeta) {
  requireActorPermission(actor, "MANAGE_WORK_ORDERS"); const now = new Date();
  return db.transaction(async (tx) => {
    const order = (await tx.select().from(workOrders).where(eq(workOrders.id, id)).limit(1))[0];
    if (!order) throw new HttpError(404, "Work order not found", "WORK_ORDER_NOT_FOUND");
    if (["COMPLETION_PENDING", "VERIFIED", "CLOSED"].includes(order.status)) throw new HttpError(409, "Submitted or closed work orders cannot be edited", "WORK_ORDER_LOCKED");
    const values = { ...input, dueAt: dateOrNull(input.dueAt), reportedAt: dateOrNull(input.reportedAt), plannedStartAt: dateOrNull(input.plannedStartAt), plannedFinishAt: dateOrNull(input.plannedFinishAt), updatedAt: now, updatedBy: actor.id };
    await tx.update(workOrders).set(values).where(and(eq(workOrders.id, id), eq(workOrders.status, order.status)));
    await tx.insert(workOrderEvents).values({ id: randomUUID(), workOrderId: id, eventType: "WORK_ORDER_UPDATED", note: input.notes || "Planning details updated", actorUserId: actor.id, createdAt: now });
    await tx.insert(auditLogs).values(audit(actor, meta, "WORK_ORDER_UPDATED", order, `Updated ${order.code}`, order, input));
    return { id, status: order.status };
  });
}

export async function assignWorkOrder(id: string, input: AssignmentInput, actor: Actor, meta: RequestMeta) {
  requireActorPermission(actor, "MANAGE_WORK_ORDERS"); const now = new Date();
  const result = await db.transaction(async (tx) => {
    const order = (await tx.select().from(workOrders).where(eq(workOrders.id, id)).limit(1))[0];
    if (!order) throw new HttpError(404, "Work order not found", "WORK_ORDER_NOT_FOUND");
    if (["VERIFIED", "CLOSED"].includes(order.status)) throw new HttpError(409, "Verified or closed work cannot be reassigned", "WORK_ORDER_LOCKED");
    await tx.update(workOrderAssignments).set({ endedAt: now }).where(and(eq(workOrderAssignments.workOrderId, id), eq(workOrderAssignments.assignmentType, input.assignmentType)));
    await tx.insert(workOrderAssignments).values({ id: randomUUID(), workOrderId: id, departmentId: input.departmentId ?? null, userId: input.assignedTo, teamName: input.teamName ?? null, positionName: input.positionName ?? null, assignmentType: input.assignmentType, assignedAt: now, assignedBy: actor.id, note: input.note });
    await tx.update(workOrders).set({ departmentId: input.departmentId ?? order.departmentId, assignedTo: input.assignedTo, crewName: input.teamName ?? order.crewName, updatedAt: now, updatedBy: actor.id }).where(eq(workOrders.id, id));
    await tx.insert(workOrderEvents).values({ id: randomUUID(), workOrderId: id, eventType: "WORK_ORDER_ASSIGNED", note: input.note, actorUserId: actor.id, createdAt: now });
    await tx.insert(auditLogs).values(audit(actor, meta, "WORK_ORDER_ASSIGNED", order, `Assigned ${order.code}`, { assignedTo: order.assignedTo }, input));
    return { id, code: order.code };
  });
  await createNotification({ type: "WORK_ORDER_ASSIGNED", title: `${result.code} assigned to you`, message: input.note, actionUrl: `/work-orders/${id}`, sourceType: "WORK_ORDER", sourceId: id, recipientIds: [input.assignedTo] }, actor, meta).catch((error) => logger.error("Assignment notification failed", { id, error: error instanceof Error ? error.message : "Unknown" }));
  return result;
}

export async function backlogWorkOrder(id: string, input: BacklogInput, actor: Actor, meta: RequestMeta) {
  const now = new Date();
  return db.transaction(async (tx) => {
    const order = (await tx.select().from(workOrders).where(eq(workOrders.id, id)).limit(1))[0];
    if (!order) throw new HttpError(404, "Work order not found", "WORK_ORDER_NOT_FOUND");
    const status = transitionWorkOrder(order.status, "BACKLOG", { actor, backlogReason: input.reason });
    await tx.insert(workOrderBacklogEvents).values({ id: randomUUID(), workOrderId: id, scope: "WORK_ORDER", previousStatus: order.status, reasonCode: input.reasonCode ?? null, reason: input.reason, category: input.category ?? null, expectedResumeAt: dateOrNull(input.expectedResumeAt), enteredBy: actor.id, enteredAt: now });
    await tx.update(workOrders).set({ status, backlogReason: input.reason, updatedAt: now, updatedBy: actor.id }).where(and(eq(workOrders.id, id), eq(workOrders.status, order.status)));
    await tx.insert(workOrderEvents).values({ id: randomUUID(), workOrderId: id, eventType: "WORK_ORDER_BACKLOGGED", fromStatus: order.status, toStatus: status, note: input.reason, actorUserId: actor.id, createdAt: now });
    await tx.insert(auditLogs).values(audit(actor, meta, "WORK_ORDER_BACKLOGGED", order, `Moved ${order.code} to backlog`, { status: order.status }, input));
    return { id, status };
  });
}

export async function resumeWorkOrder(id: string, input: ResumeInput, actor: Actor, meta: RequestMeta) {
  const now = new Date();
  return db.transaction(async (tx) => {
    const order = (await tx.select().from(workOrders).where(eq(workOrders.id, id)).limit(1))[0];
    if (!order) throw new HttpError(404, "Work order not found", "WORK_ORDER_NOT_FOUND");
    transitionWorkOrder(order.status, "RESUME", { actor, note: input.resolution });
    const backlog = (await tx.select().from(workOrderBacklogEvents).where(and(eq(workOrderBacklogEvents.workOrderId, id), eq(workOrderBacklogEvents.scope, "WORK_ORDER"))).orderBy(desc(workOrderBacklogEvents.enteredAt)).limit(1))[0];
    if (!backlog || backlog.resumedAt) throw new HttpError(409, "No open backlog event exists", "BACKLOG_NOT_OPEN");
    const status: WorkOrderStatus = backlog.previousStatus === "IN_PROGRESS" ? "IN_PROGRESS" : "OPEN";
    await tx.update(workOrderBacklogEvents).set({ resumedBy: actor.id, resumedAt: now, resolution: input.resolution }).where(eq(workOrderBacklogEvents.id, backlog.id));
    await tx.update(workOrders).set({ status, backlogReason: null, updatedAt: now, updatedBy: actor.id }).where(and(eq(workOrders.id, id), eq(workOrders.status, "BACKLOG")));
    await tx.insert(workOrderEvents).values({ id: randomUUID(), workOrderId: id, eventType: "WORK_ORDER_RESUMED", fromStatus: "BACKLOG", toStatus: status, note: input.resolution, actorUserId: actor.id, createdAt: now });
    await tx.insert(auditLogs).values(audit(actor, meta, "WORK_ORDER_RESUMED", order, `Resumed ${order.code}`, { status: order.status }, { status, ...input }));
    return { id, status };
  });
}

export async function addToolLoan(id: string, input: ToolInput, actor: Actor, meta: RequestMeta) {
  requireActorPermission(actor, "MANAGE_WORK_ORDERS"); const now = new Date(); const loanId = randomUUID();
  return db.transaction(async (tx) => {
    const order = (await tx.select().from(workOrders).where(eq(workOrders.id, id)).limit(1))[0];
    if (!order) throw new HttpError(404, "Work order not found", "WORK_ORDER_NOT_FOUND");
    if (["COMPLETION_PENDING", "VERIFIED", "CLOSED"].includes(order.status)) throw new HttpError(409, "Tools cannot be added after completion submission", "WORK_ORDER_LOCKED");
    await tx.insert(workOrderToolLoans).values({ id: loanId, workOrderId: id, toolCode: input.toolCode, toolName: input.toolName, quantity: String(input.quantity), usageCondition: input.usageCondition || null, status: "PLANNED", notes: input.notes || null, createdAt: now, updatedAt: now });
    await tx.insert(workOrderEvents).values({ id: randomUUID(), workOrderId: id, eventType: "TOOL_LOAN_PLANNED", note: `${input.toolCode} × ${input.quantity}`, actorUserId: actor.id, createdAt: now });
    await tx.insert(auditLogs).values(audit(actor, meta, "TOOL_LOAN_PLANNED", order, `Planned tool for ${order.code}`, undefined, input));
    return { id: loanId, status: "PLANNED" as const };
  });
}

export async function commandToolLoan(id: string, input: ToolCommandInput, actor: Actor, meta: RequestMeta) {
  requireActorPermission(actor, "EXECUTE_WORK_ORDERS"); const now = new Date();
  return db.transaction(async (tx) => {
    const order = (await tx.select().from(workOrders).where(eq(workOrders.id, id)).limit(1))[0];
    const loan = (await tx.select().from(workOrderToolLoans).where(and(eq(workOrderToolLoans.id, input.loanId), eq(workOrderToolLoans.workOrderId, id))).limit(1))[0];
    if (!order || !loan) throw new HttpError(404, "Work order or tool loan not found", "TOOL_LOAN_NOT_FOUND");
    const allowed = input.command === "ISSUE" ? loan.status === "PLANNED" : input.command === "RETURN" ? loan.status === "ISSUED" : loan.status === "PLANNED";
    if (!allowed) throw new HttpError(409, `Cannot ${input.command.toLowerCase()} a ${loan.status.toLowerCase()} tool loan`, "INVALID_TOOL_TRANSITION");
    const status = input.command === "ISSUE" ? "ISSUED" : input.command === "RETURN" ? "RETURNED" : "CANCELLED";
    await tx.update(workOrderToolLoans).set({ status, issuedAt: status === "ISSUED" ? now : loan.issuedAt, issuedBy: status === "ISSUED" ? actor.id : loan.issuedBy, returnedAt: status === "RETURNED" ? now : loan.returnedAt, returnedBy: status === "RETURNED" ? actor.id : loan.returnedBy, notes: input.note || loan.notes, updatedAt: now }).where(eq(workOrderToolLoans.id, loan.id));
    await tx.insert(workOrderEvents).values({ id: randomUUID(), workOrderId: id, eventType: `TOOL_LOAN_${status}`, note: input.note || loan.toolCode, actorUserId: actor.id, createdAt: now });
    await tx.insert(auditLogs).values(audit(actor, meta, `TOOL_LOAN_${status}`, order, `${status} ${loan.toolCode}`, { status: loan.status }, { status, note: input.note }));
    return { id: loan.id, status };
  });
}

export async function recordAcceptance(id: string, input: AcceptanceInput, actor: Actor, meta: RequestMeta) {
  requireActorPermission(actor, "EXECUTE_WORK_ORDERS"); const now = new Date(); const acceptanceId = randomUUID();
  return db.transaction(async (tx) => {
    const order = (await tx.select().from(workOrders).where(eq(workOrders.id, id)).limit(1))[0];
    if (!order) throw new HttpError(404, "Work order not found", "WORK_ORDER_NOT_FOUND");
    if (order.status !== "IN_PROGRESS") throw new HttpError(409, "Acceptance can only be recorded during execution", "INVALID_WORK_ORDER_STATUS");
    await tx.insert(workOrderAcceptances).values({ id: acceptanceId, workOrderId: id, acceptedAt: new Date(input.acceptedAt), acceptedBy: actor.id, details: input.details, notes: input.notes || null, lotoReference: input.lotoReference || null, isolationPoints: input.isolationPoints || null, permitNumber: input.permitNumber || null, safetyInstructions: input.safetyInstructions || null, hazards: input.hazards || null, operatingConditions: input.operatingConditions || null, logSheetReference: input.logSheetReference || null, testResult: input.testResult || null, handoverDetails: input.handoverDetails || null, attachmentIds: JSON.stringify(input.attachmentIds), createdAt: now });
    await tx.insert(workOrderEvents).values({ id: randomUUID(), workOrderId: id, eventType: "EXECUTION_ACCEPTED", note: input.details, actorUserId: actor.id, createdAt: now });
    await tx.insert(auditLogs).values(audit(actor, meta, "EXECUTION_ACCEPTED", order, `Recorded acceptance for ${order.code}`, undefined, input));
    return { id: acceptanceId };
  });
}
