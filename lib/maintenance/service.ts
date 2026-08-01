import { randomBytes, randomUUID } from "node:crypto";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "../db";
import {
  assetCategories, assets, assetTypes, auditLogs, maintenanceNotifications, notificationReviews, users,
  workExecutionEntries, workOrderCompletions, workOrderEvents, workOrderTasks, workOrderVerifications, workOrders,
  type NotificationDecision, type WorkOrderStatus,
} from "../db/schema";
import { HttpError } from "../http";
import { maskSensitive } from "../auth/mask";
import type { AuthenticatedUser } from "../auth/session";
import type { RequestMeta } from "../auth/request";
import { completionReady, reviewNotification, transitionWorkOrder, verificationAction } from "./workflow";
import type { z } from "zod";
import type { assetSchema, closeSchema, completionSchema, executionEntrySchema, notificationReviewSchema, notificationSchema, taskSchema, taskStatusSchema, verificationSchema } from "./validation";

type Actor = AuthenticatedUser;
type AssetInput = z.infer<typeof assetSchema>;
type NotificationInput = z.infer<typeof notificationSchema>;
type ReviewInput = z.infer<typeof notificationReviewSchema>;
type TaskInput = z.infer<typeof taskSchema>;
type TaskStatusInput = z.infer<typeof taskStatusSchema>;
type ExecutionInput = z.infer<typeof executionEntrySchema>;
type CompletionInput = z.infer<typeof completionSchema>;
type VerificationInput = z.infer<typeof verificationSchema>;
type CloseInput = z.infer<typeof closeSchema>;

const nowCode = (prefix: string) => {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `${prefix}-${date}-${randomBytes(3).toString("hex").toUpperCase()}`;
};

function auditRow(input: { actor: Actor; action: string; category: string; targetType: string; targetId: string; targetName: string; description: string; previousValues?: unknown; newValues?: unknown; meta: RequestMeta; createdAt: Date }) {
  return {
    id: randomUUID(), actorUserId: input.actor.id, actorName: input.actor.fullName, action: input.action, category: input.category,
    targetType: input.targetType, targetId: input.targetId, targetName: input.targetName, result: "SUCCESS" as const, description: input.description,
    previousValues: input.previousValues === undefined ? undefined : JSON.stringify(maskSensitive(input.previousValues)),
    newValues: input.newValues === undefined ? undefined : JSON.stringify(maskSensitive(input.newValues)),
    ipAddress: input.meta.ipAddress, userAgent: input.meta.userAgent, requestId: input.meta.requestId, createdAt: input.createdAt,
  };
}

const dateOrNull = (value?: string | null) => value ? new Date(value) : null;

export async function listMaintenanceOverview() {
  const [assetRows, notificationRows, workOrderRows, userRows, typeRows, categoryRows] = await Promise.all([
    db.select({ id: assets.id, code: assets.code, name: assets.name, location: assets.location, criticality: assets.criticality, status: assets.status, typeName: assetTypes.name, categoryName: assetCategories.name }).from(assets).innerJoin(assetTypes, eq(assets.assetTypeId, assetTypes.id)).leftJoin(assetCategories, eq(assets.assetCategoryId, assetCategories.id)).orderBy(asc(assets.code)),
    db.select({ id: maintenanceNotifications.id, code: maintenanceNotifications.code, title: maintenanceNotifications.title, description: maintenanceNotifications.description, type: maintenanceNotifications.type, priority: maintenanceNotifications.priority, status: maintenanceNotifications.status, assetId: maintenanceNotifications.assetId, assetCode: assets.code, assetName: assets.name, dueAt: maintenanceNotifications.dueAt, createdAt: maintenanceNotifications.createdAt, requestedByName: users.fullName }).from(maintenanceNotifications).innerJoin(assets, eq(maintenanceNotifications.assetId, assets.id)).innerJoin(users, eq(maintenanceNotifications.requestedBy, users.id)).orderBy(desc(maintenanceNotifications.createdAt)),
    db.select({ id: workOrders.id, code: workOrders.code, title: workOrders.title, description: workOrders.description, priority: workOrders.priority, status: workOrders.status, notificationId: workOrders.notificationId, assetId: workOrders.assetId, assetCode: assets.code, assetName: assets.name, assignedTo: workOrders.assignedTo, dueAt: workOrders.dueAt, startedAt: workOrders.startedAt, verifiedAt: workOrders.verifiedAt, closedAt: workOrders.closedAt, updatedAt: workOrders.updatedAt }).from(workOrders).innerJoin(assets, eq(workOrders.assetId, assets.id)).orderBy(desc(workOrders.updatedAt)),
    db.select({ id: users.id, fullName: users.fullName, role: users.role }).from(users).where(eq(users.status, "ACTIVE")).orderBy(asc(users.fullName)),
    db.select({ id: assetTypes.id, code: assetTypes.code, name: assetTypes.name }).from(assetTypes).where(eq(assetTypes.active, true)).orderBy(asc(assetTypes.name)),
    db.select({ id: assetCategories.id, code: assetCategories.code, name: assetCategories.name }).from(assetCategories).where(eq(assetCategories.active, true)).orderBy(asc(assetCategories.name)),
  ]);
  return { assets: assetRows, notifications: notificationRows, workOrders: workOrderRows, users: userRows, assetTypes: typeRows, assetCategories: categoryRows };
}

export async function getWorkOrderDetail(id: string) {
  const order = (await db.select({ id: workOrders.id, code: workOrders.code, title: workOrders.title, description: workOrders.description, priority: workOrders.priority, status: workOrders.status, notificationId: workOrders.notificationId, assetId: workOrders.assetId, assetCode: assets.code, assetName: assets.name, assignedTo: workOrders.assignedTo, dueAt: workOrders.dueAt, startedAt: workOrders.startedAt, verifiedAt: workOrders.verifiedAt, closedAt: workOrders.closedAt, updatedAt: workOrders.updatedAt }).from(workOrders).innerJoin(assets, eq(workOrders.assetId, assets.id)).where(eq(workOrders.id, id)).limit(1))[0];
  if (!order) throw new HttpError(404, "Work order not found", "WORK_ORDER_NOT_FOUND");
  const [tasks, execution, completions, verifications, events] = await Promise.all([
    db.select().from(workOrderTasks).where(eq(workOrderTasks.workOrderId, id)).orderBy(asc(workOrderTasks.sequence)),
    db.select().from(workExecutionEntries).where(eq(workExecutionEntries.workOrderId, id)).orderBy(desc(workExecutionEntries.actionAt)),
    db.select().from(workOrderCompletions).where(eq(workOrderCompletions.workOrderId, id)).orderBy(desc(workOrderCompletions.completedAt)),
    db.select().from(workOrderVerifications).where(eq(workOrderVerifications.workOrderId, id)).orderBy(desc(workOrderVerifications.verifiedAt)),
    db.select().from(workOrderEvents).where(eq(workOrderEvents.workOrderId, id)).orderBy(desc(workOrderEvents.createdAt)),
  ]);
  return { order, tasks, execution, completions, verifications, events };
}

export async function createAsset(input: AssetInput, actor: Actor, meta: RequestMeta) {
  const id = randomUUID(); const now = new Date();
  await db.transaction(async (tx) => {
    await tx.insert(assets).values({ id, ...input, description: input.description || null, assetCategoryId: input.assetCategoryId ?? null, parentAssetId: input.parentAssetId ?? null, ownerUserId: input.ownerUserId ?? null, createdAt: now, updatedAt: now, createdBy: actor.id, updatedBy: actor.id });
    await tx.insert(auditLogs).values(auditRow({ actor, action: "ASSET_CREATED", category: "MAINTENANCE", targetType: "ASSET", targetId: id, targetName: input.code, description: `Created asset ${input.code}`, newValues: input, meta, createdAt: now }));
  });
  return { id, code: input.code };
}

export async function createNotification(input: NotificationInput, actor: Actor, meta: RequestMeta) {
  const id = randomUUID(); const code = nowCode("NO"); const now = new Date();
  await db.transaction(async (tx) => {
    const asset = (await tx.select({ id: assets.id, status: assets.status }).from(assets).where(eq(assets.id, input.assetId)).limit(1))[0];
    if (!asset || asset.status !== "ACTIVE") throw new HttpError(400, "Notification requires an active asset", "INVALID_ASSET");
    await tx.insert(maintenanceNotifications).values({ id, code, assetId: input.assetId, title: input.title, description: input.description, type: input.type, priority: input.priority, breakdown: input.breakdown, status: "NEW", requestedBy: actor.id, supervisorId: input.supervisorId ?? null, dueAt: dateOrNull(input.dueAt), createdAt: now, updatedAt: now, createdBy: actor.id, updatedBy: actor.id });
    await tx.insert(auditLogs).values(auditRow({ actor, action: "MAINTENANCE_NOTIFICATION_CREATED", category: "MAINTENANCE", targetType: "MAINTENANCE_NOTIFICATION", targetId: id, targetName: code, description: `Reported ${code}`, newValues: input, meta, createdAt: now }));
  });
  return { id, code };
}

export async function reviewMaintenanceNotification(id: string, input: ReviewInput, actor: Actor, meta: RequestMeta) {
  const now = new Date();
  return db.transaction(async (tx) => {
    const notification = (await tx.select().from(maintenanceNotifications).where(eq(maintenanceNotifications.id, id)).limit(1))[0];
    if (!notification) throw new HttpError(404, "Notification not found", "NOTIFICATION_NOT_FOUND");
    const next = reviewNotification(notification.status, input.decision as NotificationDecision);
    await tx.insert(notificationReviews).values({ id: randomUUID(), notificationId: id, decision: input.decision, note: input.note, reviewedBy: actor.id, reviewedAt: now });
    await tx.update(maintenanceNotifications).set({ status: next, reviewedAt: now, updatedAt: now, updatedBy: actor.id }).where(and(eq(maintenanceNotifications.id, id), eq(maintenanceNotifications.status, "NEW")));
    let workOrder: { id: string; code: string } | null = null;
    if (input.decision === "APPROVED" || input.decision === "BACKLOG") {
      const orderId = randomUUID(); const code = nowCode("WO"); const orderStatus: WorkOrderStatus = input.decision === "BACKLOG" ? "BACKLOG" : "OPEN";
      await tx.insert(workOrders).values({ id: orderId, code, notificationId: id, assetId: notification.assetId, title: notification.title, description: notification.description, priority: notification.priority, status: orderStatus, assignedTo: input.assignedTo ?? null, supervisorId: notification.supervisorId, dueAt: dateOrNull(input.dueAt) ?? notification.dueAt, createdAt: now, updatedAt: now, createdBy: actor.id, updatedBy: actor.id });
      await tx.insert(workOrderEvents).values({ id: randomUUID(), workOrderId: orderId, eventType: "WORK_ORDER_CREATED", toStatus: orderStatus, note: input.note, actorUserId: actor.id, createdAt: now });
      workOrder = { id: orderId, code };
    }
    await tx.insert(auditLogs).values(auditRow({ actor, action: "MAINTENANCE_NOTIFICATION_REVIEWED", category: "MAINTENANCE", targetType: "MAINTENANCE_NOTIFICATION", targetId: id, targetName: notification.code, description: `${notification.code} reviewed as ${input.decision}`, previousValues: { status: notification.status }, newValues: { status: next, workOrder }, meta, createdAt: now }));
    return { notificationId: id, status: next, workOrder };
  });
}

async function orderForMutation(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], id: string) {
  const order = (await tx.select().from(workOrders).where(eq(workOrders.id, id)).limit(1))[0];
  if (!order) throw new HttpError(404, "Work order not found", "WORK_ORDER_NOT_FOUND");
  return order;
}

export async function startWorkOrder(id: string, actor: Actor, meta: RequestMeta) {
  const now = new Date();
  return db.transaction(async (tx) => {
    const order = await orderForMutation(tx, id); const status = transitionWorkOrder(order.status, "START");
    await tx.update(workOrders).set({ status, startedAt: order.startedAt ?? now, updatedAt: now, updatedBy: actor.id }).where(eq(workOrders.id, id));
    await tx.insert(workOrderEvents).values({ id: randomUUID(), workOrderId: id, eventType: "WORK_STARTED", fromStatus: order.status, toStatus: status, actorUserId: actor.id, createdAt: now });
    await tx.insert(auditLogs).values(auditRow({ actor, action: "WORK_ORDER_STARTED", category: "MAINTENANCE", targetType: "WORK_ORDER", targetId: id, targetName: order.code, description: `Started ${order.code}`, previousValues: { status: order.status }, newValues: { status }, meta, createdAt: now }));
    return { id, status };
  });
}

export async function addWorkOrderTask(id: string, input: TaskInput, actor: Actor, meta: RequestMeta) {
  const now = new Date(); const taskId = randomUUID();
  return db.transaction(async (tx) => {
    const order = await orderForMutation(tx, id);
    if (!(["OPEN", "BACKLOG", "IN_PROGRESS"] as WorkOrderStatus[]).includes(order.status)) throw new HttpError(409, "Tasks cannot be changed after completion is submitted", "WORK_ORDER_LOCKED");
    const existing = await tx.select({ sequence: workOrderTasks.sequence }).from(workOrderTasks).where(eq(workOrderTasks.workOrderId, id)).orderBy(desc(workOrderTasks.sequence)).limit(1);
    const sequence = (existing[0]?.sequence ?? 0) + 1;
    await tx.insert(workOrderTasks).values({ id: taskId, workOrderId: id, sequence, title: input.title, description: input.description || null, required: input.required, assignedTo: input.assignedTo ?? null, status: "OPEN", createdAt: now, updatedAt: now });
    await tx.insert(workOrderEvents).values({ id: randomUUID(), workOrderId: id, eventType: "TASK_ADDED", note: input.title, actorUserId: actor.id, createdAt: now });
    await tx.insert(auditLogs).values(auditRow({ actor, action: "WORK_ORDER_TASK_ADDED", category: "MAINTENANCE", targetType: "WORK_ORDER", targetId: id, targetName: order.code, description: `Added task ${sequence} to ${order.code}`, newValues: input, meta, createdAt: now }));
    return { id: taskId, sequence };
  });
}

export async function updateWorkOrderTask(id: string, taskId: string, input: TaskStatusInput, actor: Actor, meta: RequestMeta) {
  const now = new Date();
  return db.transaction(async (tx) => {
    const order = await orderForMutation(tx, id);
    if (!(["OPEN", "BACKLOG", "IN_PROGRESS"] as WorkOrderStatus[]).includes(order.status)) throw new HttpError(409, "Tasks cannot be changed after completion is submitted", "WORK_ORDER_LOCKED");
    const task = (await tx.select().from(workOrderTasks).where(and(eq(workOrderTasks.id, taskId), eq(workOrderTasks.workOrderId, id))).limit(1))[0];
    if (!task) throw new HttpError(404, "Task not found", "TASK_NOT_FOUND");
    await tx.update(workOrderTasks).set({ status: input.status, completedBy: input.status === "COMPLETED" ? actor.id : null, completedAt: input.status === "COMPLETED" ? now : null, updatedAt: now }).where(eq(workOrderTasks.id, taskId));
    await tx.insert(workOrderEvents).values({ id: randomUUID(), workOrderId: id, eventType: "TASK_STATUS_CHANGED", note: `${task.title}: ${input.status}`, actorUserId: actor.id, createdAt: now });
    await tx.insert(auditLogs).values(auditRow({ actor, action: "WORK_ORDER_TASK_UPDATED", category: "MAINTENANCE", targetType: "WORK_ORDER_TASK", targetId: taskId, targetName: task.title, description: `Set task to ${input.status}`, previousValues: { status: task.status }, newValues: input, meta, createdAt: now }));
    return { id: taskId, status: input.status };
  });
}

export async function addExecutionEntry(id: string, input: ExecutionInput, actor: Actor, meta: RequestMeta) {
  const now = new Date(); const entryId = randomUUID();
  return db.transaction(async (tx) => {
    const order = await orderForMutation(tx, id);
    if (order.status !== "IN_PROGRESS") throw new HttpError(409, "Execution can only be recorded while work is in progress", "INVALID_WORK_ORDER_STATUS");
    await tx.insert(workExecutionEntries).values({ id: entryId, workOrderId: id, description: input.description, minutesSpent: input.minutesSpent, actionAt: new Date(input.actionAt), actorUserId: actor.id, createdAt: now });
    await tx.insert(workOrderEvents).values({ id: randomUUID(), workOrderId: id, eventType: "EXECUTION_RECORDED", note: input.description, actorUserId: actor.id, createdAt: now });
    await tx.insert(auditLogs).values(auditRow({ actor, action: "WORK_EXECUTION_RECORDED", category: "MAINTENANCE", targetType: "WORK_ORDER", targetId: id, targetName: order.code, description: `Recorded ${input.minutesSpent} minutes on ${order.code}`, newValues: input, meta, createdAt: now }));
    return { id: entryId };
  });
}

export async function submitCompletion(id: string, input: CompletionInput, actor: Actor, meta: RequestMeta) {
  const now = new Date(); const completionId = randomUUID();
  return db.transaction(async (tx) => {
    const order = await orderForMutation(tx, id); const status = transitionWorkOrder(order.status, "SUBMIT_COMPLETION");
    const tasks = await tx.select({ required: workOrderTasks.required, status: workOrderTasks.status }).from(workOrderTasks).where(eq(workOrderTasks.workOrderId, id));
    if (!completionReady(tasks)) throw new HttpError(409, "Complete every required task before submitting completion", "REQUIRED_TASKS_INCOMPLETE");
    await tx.insert(workOrderCompletions).values({ id: completionId, workOrderId: id, result: input.result, problem: input.problem || null, cause: input.cause || null, solution: input.solution, escalation: input.escalation || null, notes: input.notes || null, durationMinutes: input.durationMinutes, completedBy: actor.id, completedAt: now, createdAt: now });
    await tx.update(workOrders).set({ status, updatedAt: now, updatedBy: actor.id }).where(eq(workOrders.id, id));
    await tx.insert(workOrderEvents).values({ id: randomUUID(), workOrderId: id, eventType: "COMPLETION_SUBMITTED", fromStatus: order.status, toStatus: status, note: input.result, actorUserId: actor.id, createdAt: now });
    await tx.insert(auditLogs).values(auditRow({ actor, action: "WORK_ORDER_COMPLETION_SUBMITTED", category: "MAINTENANCE", targetType: "WORK_ORDER", targetId: id, targetName: order.code, description: `Submitted ${order.code} for verification`, previousValues: { status: order.status }, newValues: { status, completionId, ...input }, meta, createdAt: now }));
    return { id: completionId, status };
  });
}

export async function verifyCompletion(id: string, input: VerificationInput, actor: Actor, meta: RequestMeta) {
  const now = new Date();
  return db.transaction(async (tx) => {
    const order = await orderForMutation(tx, id); const status = transitionWorkOrder(order.status, verificationAction(input.decision));
    const completion = (await tx.select({ id: workOrderCompletions.id }).from(workOrderCompletions).where(and(eq(workOrderCompletions.id, input.completionId), eq(workOrderCompletions.workOrderId, id))).limit(1))[0];
    if (!completion) throw new HttpError(404, "Completion record not found", "COMPLETION_NOT_FOUND");
    await tx.insert(workOrderVerifications).values({ id: randomUUID(), workOrderId: id, completionId: input.completionId, decision: input.decision, note: input.note, verifiedBy: actor.id, verifiedAt: now });
    await tx.update(workOrders).set({ status, verifiedAt: input.decision === "VERIFIED" ? now : null, updatedAt: now, updatedBy: actor.id }).where(eq(workOrders.id, id));
    await tx.insert(workOrderEvents).values({ id: randomUUID(), workOrderId: id, eventType: input.decision === "VERIFIED" ? "COMPLETION_VERIFIED" : "COMPLETION_RETURNED", fromStatus: order.status, toStatus: status, note: input.note, actorUserId: actor.id, createdAt: now });
    await tx.insert(auditLogs).values(auditRow({ actor, action: input.decision === "VERIFIED" ? "WORK_ORDER_VERIFIED" : "WORK_ORDER_RETURNED", category: "MAINTENANCE", targetType: "WORK_ORDER", targetId: id, targetName: order.code, description: `${input.decision} ${order.code}`, previousValues: { status: order.status }, newValues: { status, completionId: input.completionId, note: input.note }, meta, createdAt: now }));
    return { id, status };
  });
}

export async function closeWorkOrder(id: string, input: CloseInput, actor: Actor, meta: RequestMeta) {
  const now = new Date();
  return db.transaction(async (tx) => {
    const order = await orderForMutation(tx, id); const status = transitionWorkOrder(order.status, "CLOSE");
    await tx.update(workOrders).set({ status, closedAt: now, updatedAt: now, updatedBy: actor.id }).where(eq(workOrders.id, id));
    await tx.update(maintenanceNotifications).set({ status: "COMPLETED", completedAt: now, updatedAt: now, updatedBy: actor.id }).where(eq(maintenanceNotifications.id, order.notificationId));
    await tx.insert(workOrderEvents).values({ id: randomUUID(), workOrderId: id, eventType: "WORK_ORDER_CLOSED", fromStatus: order.status, toStatus: status, note: input.note, actorUserId: actor.id, createdAt: now });
    await tx.insert(auditLogs).values(auditRow({ actor, action: "WORK_ORDER_CLOSED", category: "MAINTENANCE", targetType: "WORK_ORDER", targetId: id, targetName: order.code, description: `Closed ${order.code}`, previousValues: { status: order.status }, newValues: { status, note: input.note }, meta, createdAt: now }));
    return { id, status };
  });
}
