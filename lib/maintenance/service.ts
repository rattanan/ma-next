import { randomBytes, randomUUID } from "node:crypto";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "../db";
import { prisma } from "../prisma";
import {
  assetCategories, assets, assetTypes, auditLogs, maintenanceNotifications, notificationReviews, spareParts, users,
  workExecutionEntries, workOrderCompletions, workOrderEvents, workOrderSpareParts, workOrderTasks, workOrderVerifications, workOrders,
  type WorkOrderStatus,
} from "../db/schema";
import { HttpError } from "../http";
import { maskSensitive } from "../auth/mask";
import type { AuthenticatedUser } from "../auth/session";
import type { RequestMeta } from "../auth/request";
import { createNotification as createInAppNotification } from "../notifications/service";
import { logger } from "../logger";
import { completeNotification, convertNotificationToWorkOrder, initializeNotification, transitionNotification, transitionTask, transitionWorkOrder, verificationAction } from "./workflow";
import type { z } from "zod";
import type { assetSchema, closeSchema, completionSchema, executionEntrySchema, notificationReviewSchema, notificationSchema, sparePartUsageSchema, taskSchema, taskStatusSchema, verificationSchema } from "./validation";

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
type SparePartUsageInput = z.infer<typeof sparePartUsageSchema>;

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
  const [assetRows, notificationRows, workOrderRows, userRows, typeRows, categoryRows, sparePartRows, departmentRows] = await Promise.all([
    db.select({ id: assets.id, code: assets.code, name: assets.name, location: assets.location, criticality: assets.criticality, status: assets.status, typeName: assetTypes.name, categoryName: assetCategories.name }).from(assets).innerJoin(assetTypes, eq(assets.assetTypeId, assetTypes.id)).leftJoin(assetCategories, eq(assets.assetCategoryId, assetCategories.id)).orderBy(asc(assets.code)),
    db.select({ id: maintenanceNotifications.id, code: maintenanceNotifications.code, title: maintenanceNotifications.title, description: maintenanceNotifications.description, type: maintenanceNotifications.type, priority: maintenanceNotifications.priority, severity: maintenanceNotifications.severity, equipmentOperatingStatus: maintenanceNotifications.equipmentOperatingStatus, status: maintenanceNotifications.status, assetId: maintenanceNotifications.assetId, assetCode: assets.code, assetName: assets.name, departmentId: maintenanceNotifications.departmentId, assignedPersonId: maintenanceNotifications.assignedPersonId, photoAttachmentIds: maintenanceNotifications.photoAttachmentIds, dueAt: maintenanceNotifications.dueAt, createdAt: maintenanceNotifications.createdAt, requestedByName: users.fullName }).from(maintenanceNotifications).innerJoin(assets, eq(maintenanceNotifications.assetId, assets.id)).innerJoin(users, eq(maintenanceNotifications.requestedBy, users.id)).orderBy(desc(maintenanceNotifications.createdAt)),
    db.select({ id: workOrders.id, code: workOrders.code, title: workOrders.title, description: workOrders.description, priority: workOrders.priority, severity: workOrders.severity, status: workOrders.status, backlogReason: workOrders.backlogReason, notificationId: workOrders.notificationId, assetId: workOrders.assetId, assetCode: assets.code, assetName: assets.name, assignedTo: workOrders.assignedTo, dueAt: workOrders.dueAt, startedAt: workOrders.startedAt, verifiedAt: workOrders.verifiedAt, closedAt: workOrders.closedAt, updatedAt: workOrders.updatedAt }).from(workOrders).innerJoin(assets, eq(workOrders.assetId, assets.id)).orderBy(desc(workOrders.updatedAt)),
    db.select({ id: users.id, fullName: users.fullName, role: users.role }).from(users).where(eq(users.status, "ACTIVE")).orderBy(asc(users.fullName)),
    db.select({ id: assetTypes.id, code: assetTypes.code, name: assetTypes.name }).from(assetTypes).where(eq(assetTypes.active, true)).orderBy(asc(assetTypes.name)),
    db.select({ id: assetCategories.id, code: assetCategories.code, name: assetCategories.name }).from(assetCategories).where(eq(assetCategories.active, true)).orderBy(asc(assetCategories.name)),
    db.select({ id: spareParts.id, code: spareParts.code, name: spareParts.name, unit: spareParts.unit, availableQuantity: spareParts.availableQuantity }).from(spareParts).orderBy(asc(spareParts.code)),
    prisma.department.findMany({ where: { active: true }, select: { id: true, code: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return { assets: assetRows, notifications: notificationRows, workOrders: workOrderRows, users: userRows, assetTypes: typeRows, assetCategories: categoryRows, spareParts: sparePartRows, departments: departmentRows };
}

export async function getWorkOrderDetail(id: string) {
  const order = (await db.select({ id: workOrders.id, code: workOrders.code, title: workOrders.title, description: workOrders.description, priority: workOrders.priority, status: workOrders.status, notificationId: workOrders.notificationId, assetId: workOrders.assetId, assetCode: assets.code, assetName: assets.name, assignedTo: workOrders.assignedTo, dueAt: workOrders.dueAt, startedAt: workOrders.startedAt, verifiedAt: workOrders.verifiedAt, closedAt: workOrders.closedAt, updatedAt: workOrders.updatedAt }).from(workOrders).innerJoin(assets, eq(workOrders.assetId, assets.id)).where(eq(workOrders.id, id)).limit(1))[0];
  if (!order) throw new HttpError(404, "Work order not found", "WORK_ORDER_NOT_FOUND");
  const [tasks, execution, completions, verifications, events, usedSpareParts] = await Promise.all([
    db.select().from(workOrderTasks).where(eq(workOrderTasks.workOrderId, id)).orderBy(asc(workOrderTasks.sequence)),
    db.select().from(workExecutionEntries).where(eq(workExecutionEntries.workOrderId, id)).orderBy(desc(workExecutionEntries.actionAt)),
    db.select().from(workOrderCompletions).where(eq(workOrderCompletions.workOrderId, id)).orderBy(desc(workOrderCompletions.completedAt)),
    db.select().from(workOrderVerifications).where(eq(workOrderVerifications.workOrderId, id)).orderBy(desc(workOrderVerifications.verifiedAt)),
    db.select().from(workOrderEvents).where(eq(workOrderEvents.workOrderId, id)).orderBy(desc(workOrderEvents.createdAt)),
    db.select({ id: workOrderSpareParts.id, sparePartId: workOrderSpareParts.sparePartId, code: spareParts.code, name: spareParts.name, quantity: workOrderSpareParts.quantity, unit: spareParts.unit, note: workOrderSpareParts.note, usedAt: workOrderSpareParts.usedAt }).from(workOrderSpareParts).innerJoin(spareParts, eq(workOrderSpareParts.sparePartId, spareParts.id)).where(eq(workOrderSpareParts.workOrderId, id)).orderBy(desc(workOrderSpareParts.usedAt)),
  ]);
  return { order, tasks, execution, completions, verifications, events, usedSpareParts };
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
  const initialStatus = initializeNotification(actor, input);
  let duplicateWarning: string | null = null;
  await db.transaction(async (tx) => {
    const asset = (await tx.select({ id: assets.id, status: assets.status }).from(assets).where(eq(assets.id, input.assetId)).limit(1))[0];
    if (!asset || asset.status !== "ACTIVE") throw new HttpError(400, "Notification requires an active asset", "INVALID_ASSET");
    const duplicate = (await tx.select({ code: maintenanceNotifications.code }).from(maintenanceNotifications).where(and(eq(maintenanceNotifications.assetId, input.assetId), eq(maintenanceNotifications.status, "NEW"))).limit(1))[0];
    if (duplicate) duplicateWarning = `${duplicate.code} is already new for this asset; verify this is not a duplicate.`;
    await tx.insert(maintenanceNotifications).values({ id, code, assetId: input.assetId, title: input.title, description: input.description, type: input.type, priority: input.priority, severity: input.severity, equipmentOperatingStatus: input.equipmentOperatingStatus, breakdown: input.breakdown, status: initialStatus, requestedBy: actor.id, departmentId: input.departmentId ?? null, assignedPersonId: input.assignedPersonId ?? null, supervisorId: input.supervisorId ?? null, photoAttachmentIds: JSON.stringify(input.photoAttachmentIds), dueAt: dateOrNull(input.dueAt), createdAt: now, updatedAt: now, createdBy: actor.id, updatedBy: actor.id });
    await tx.insert(auditLogs).values(auditRow({ actor, action: "MAINTENANCE_NOTIFICATION_CREATED", category: "MAINTENANCE", targetType: "MAINTENANCE_NOTIFICATION", targetId: id, targetName: code, description: `Reported ${code}`, newValues: input, meta, createdAt: now }));
  });
  const recipients = [...new Set([input.supervisorId, input.assignedPersonId].filter((value): value is string => Boolean(value)))];
  if (recipients.length) await createInAppNotification({ type: "MAINTENANCE_NOTIFICATION_CREATED", title: `New maintenance notification ${code}`, message: `${actor.fullName} reported ${input.title}`, actionUrl: "/maintenance", sourceType: "MAINTENANCE_NOTIFICATION", sourceId: id, recipientIds: recipients }, actor, meta).catch((error) => logger.error("Maintenance notification delivery failed", { sourceId: id, error: error instanceof Error ? error.message : "Unknown error" }));
  return { id, code, duplicateWarning };
}

export async function reviewMaintenanceNotification(id: string, input: ReviewInput, actor: Actor, meta: RequestMeta) {
  const now = new Date();
  const result = await db.transaction(async (tx) => {
    const notification = (await tx.select().from(maintenanceNotifications).where(eq(maintenanceNotifications.id, id)).limit(1))[0];
    if (!notification) throw new HttpError(404, "Notification not found", "NOTIFICATION_NOT_FOUND");
    const action = input.decision === "APPROVED" ? "APPROVE" : input.decision === "BACKLOG" ? "BACKLOG" : "REJECT";
    const next = transitionNotification(notification.status, action, { actor, assignedTo: input.assignedTo, note: input.note, backlogReason: input.backlogReason });
    await tx.insert(notificationReviews).values({ id: randomUUID(), notificationId: id, decision: input.decision, note: input.note, reviewedBy: actor.id, reviewedAt: now });
    await tx.update(maintenanceNotifications).set({ status: next, reviewedAt: now, updatedAt: now, updatedBy: actor.id }).where(and(eq(maintenanceNotifications.id, id), eq(maintenanceNotifications.status, "NEW")));
    let workOrder: { id: string; code: string } | null = null;
    if (input.decision === "APPROVED" || input.decision === "BACKLOG") {
      const orderId = randomUUID(); const code = nowCode("WO"); const orderStatus: WorkOrderStatus = convertNotificationToWorkOrder(next, actor, { assignedTo: input.assignedTo, backlogReason: input.backlogReason });
      await tx.insert(workOrders).values({ id: orderId, code, notificationId: id, assetId: notification.assetId, title: notification.title, description: notification.description, priority: notification.priority, severity: notification.severity, departmentId: notification.departmentId, backlogReason: input.decision === "BACKLOG" ? input.backlogReason : null, status: orderStatus, assignedTo: input.assignedTo ?? null, supervisorId: notification.supervisorId, dueAt: dateOrNull(input.dueAt) ?? notification.dueAt, createdAt: now, updatedAt: now, createdBy: actor.id, updatedBy: actor.id });
      await tx.insert(workOrderEvents).values({ id: randomUUID(), workOrderId: orderId, eventType: "WORK_ORDER_CREATED", toStatus: orderStatus, note: input.note, actorUserId: actor.id, createdAt: now });
      workOrder = { id: orderId, code };
    }
    await tx.insert(auditLogs).values(auditRow({ actor, action: "MAINTENANCE_NOTIFICATION_REVIEWED", category: "MAINTENANCE", targetType: "MAINTENANCE_NOTIFICATION", targetId: id, targetName: notification.code, description: `${notification.code} reviewed as ${input.decision}`, previousValues: { status: notification.status }, newValues: { status: next, workOrder }, meta, createdAt: now }));
    return { notificationId: id, status: next, workOrder };
  });
  if (input.assignedTo && result.workOrder) await createInAppNotification({ type: "WORK_ORDER_ASSIGNED", title: `Work order ${result.workOrder.code} assigned`, message: "Corrective work is ready for execution", actionUrl: "/maintenance", sourceType: "WORK_ORDER", sourceId: result.workOrder.id, recipientIds: [input.assignedTo] }, actor, meta).catch((error) => logger.error("Work-order assignment notification failed", { sourceId: result.workOrder?.id, error: error instanceof Error ? error.message : "Unknown error" }));
  return result;
}

async function orderForMutation(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], id: string) {
  const order = (await tx.select().from(workOrders).where(eq(workOrders.id, id)).limit(1))[0];
  if (!order) throw new HttpError(404, "Work order not found", "WORK_ORDER_NOT_FOUND");
  return order;
}

export async function startWorkOrder(id: string, actor: Actor, meta: RequestMeta) {
  const now = new Date();
  return db.transaction(async (tx) => {
    const order = await orderForMutation(tx, id); const status = transitionWorkOrder(order.status, "START", { actor, assignedTo: order.assignedTo });
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
    await tx.insert(workOrderTasks).values({ id: taskId, workOrderId: id, sequence, title: input.title, description: input.description || null, required: input.required, kind: input.kind, assignedTo: input.assignedTo ?? null, status: "OPEN", createdAt: now, updatedAt: now });
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
    const taskStatus = transitionTask(task.status, input.status, actor);
    await tx.update(workOrderTasks).set({ status: taskStatus, completedBy: taskStatus === "COMPLETED" ? actor.id : null, completedAt: taskStatus === "COMPLETED" ? now : null, updatedAt: now }).where(eq(workOrderTasks.id, taskId));
    await tx.insert(workOrderEvents).values({ id: randomUUID(), workOrderId: id, eventType: "TASK_STATUS_CHANGED", note: `${task.title}: ${input.status}`, actorUserId: actor.id, createdAt: now });
    await tx.insert(auditLogs).values(auditRow({ actor, action: "WORK_ORDER_TASK_UPDATED", category: "MAINTENANCE", targetType: "WORK_ORDER_TASK", targetId: taskId, targetName: task.title, description: `Set task to ${input.status}`, previousValues: { status: task.status }, newValues: input, meta, createdAt: now }));
    return { id: taskId, status: taskStatus };
  });
}

export async function addExecutionEntry(id: string, input: ExecutionInput, actor: Actor, meta: RequestMeta) {
  const now = new Date(); const entryId = randomUUID();
  return db.transaction(async (tx) => {
    const order = await orderForMutation(tx, id);
    if (order.status !== "IN_PROGRESS") throw new HttpError(409, "Execution can only be recorded while work is in progress", "INVALID_WORK_ORDER_STATUS");
    await tx.insert(workExecutionEntries).values({ id: entryId, workOrderId: id, description: input.description, minutesSpent: input.minutesSpent, overtimeMinutes: input.overtimeMinutes, overtimeMultiplier: String(input.overtimeMultiplier), actionAt: new Date(input.actionAt), actorUserId: actor.id, createdAt: now });
    await tx.insert(workOrderEvents).values({ id: randomUUID(), workOrderId: id, eventType: "EXECUTION_RECORDED", note: input.description, actorUserId: actor.id, createdAt: now });
    await tx.insert(auditLogs).values(auditRow({ actor, action: "WORK_EXECUTION_RECORDED", category: "MAINTENANCE", targetType: "WORK_ORDER", targetId: id, targetName: order.code, description: `Recorded ${input.minutesSpent} minutes on ${order.code}`, newValues: input, meta, createdAt: now }));
    return { id: entryId };
  });
}

export async function addUsedSparePart(id: string, input: SparePartUsageInput, actor: Actor, meta: RequestMeta) {
  const now = new Date(); const usageId = randomUUID();
  return db.transaction(async (tx) => {
    const order = await orderForMutation(tx, id);
    if (order.status !== "IN_PROGRESS") throw new HttpError(409, "Spare parts can only be recorded while work is in progress", "INVALID_WORK_ORDER_STATUS");
    if (!actor.permissions.includes("EXECUTE_WORK_ORDERS")) throw new HttpError(403, "Missing workflow permission", "WORKFLOW_FORBIDDEN");
    const part = (await tx.select({ id: spareParts.id, code: spareParts.code }).from(spareParts).where(eq(spareParts.id, input.sparePartId)).limit(1))[0];
    if (!part) throw new HttpError(404, "Spare part not found", "SPARE_PART_NOT_FOUND");
    await tx.insert(workOrderSpareParts).values({ id: usageId, workOrderId: id, sparePartId: input.sparePartId, quantity: String(input.quantity), note: input.note || null, usedBy: actor.id, usedAt: now });
    await tx.insert(workOrderEvents).values({ id: randomUUID(), workOrderId: id, eventType: "SPARE_PART_USED", note: `${part.code} × ${input.quantity}`, actorUserId: actor.id, createdAt: now });
    await tx.insert(auditLogs).values(auditRow({ actor, action: "WORK_ORDER_SPARE_PART_USED", category: "MAINTENANCE", targetType: "WORK_ORDER", targetId: id, targetName: order.code, description: `Recorded spare part ${part.code}`, newValues: input, meta, createdAt: now }));
    return { id: usageId };
  });
}

export async function submitCompletion(id: string, input: CompletionInput, actor: Actor, meta: RequestMeta) {
  const now = new Date(); const completionId = randomUUID();
  return db.transaction(async (tx) => {
    const order = await orderForMutation(tx, id);
    const tasks = await tx.select({ required: workOrderTasks.required, status: workOrderTasks.status }).from(workOrderTasks).where(eq(workOrderTasks.workOrderId, id));
    const status = transitionWorkOrder(order.status, "SUBMIT_COMPLETION", { actor, requiredTasks: tasks });
    await tx.insert(workOrderCompletions).values({ id: completionId, workOrderId: id, result: input.result, problem: input.problem || null, cause: input.cause || null, solution: input.solution, escalation: input.escalation || null, notes: input.notes || null, durationMinutes: input.durationMinutes, beforePhotoAttachmentIds: JSON.stringify(input.beforePhotoAttachmentIds), afterPhotoAttachmentIds: JSON.stringify(input.afterPhotoAttachmentIds), completedBy: actor.id, completedAt: now, createdAt: now });
    await tx.update(workOrders).set({ status, updatedAt: now, updatedBy: actor.id }).where(eq(workOrders.id, id));
    await tx.insert(workOrderEvents).values({ id: randomUUID(), workOrderId: id, eventType: "COMPLETION_SUBMITTED", fromStatus: order.status, toStatus: status, note: input.result, actorUserId: actor.id, createdAt: now });
    await tx.insert(auditLogs).values(auditRow({ actor, action: "WORK_ORDER_COMPLETION_SUBMITTED", category: "MAINTENANCE", targetType: "WORK_ORDER", targetId: id, targetName: order.code, description: `Submitted ${order.code} for verification`, previousValues: { status: order.status }, newValues: { status, completionId, ...input }, meta, createdAt: now }));
    return { id: completionId, status };
  });
}

export async function verifyCompletion(id: string, input: VerificationInput, actor: Actor, meta: RequestMeta) {
  const now = new Date();
  return db.transaction(async (tx) => {
    const order = await orderForMutation(tx, id);
    const completion = (await tx.select({ id: workOrderCompletions.id, completedBy: workOrderCompletions.completedBy }).from(workOrderCompletions).where(and(eq(workOrderCompletions.id, input.completionId), eq(workOrderCompletions.workOrderId, id))).limit(1))[0];
    const status = transitionWorkOrder(order.status, verificationAction(input.decision), { actor, completionExists: Boolean(completion), completionOwnerId: completion?.completedBy, note: input.note });
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
    const order = await orderForMutation(tx, id); const status = transitionWorkOrder(order.status, "CLOSE", { actor, note: input.note });
    const notification = (await tx.select({ status: maintenanceNotifications.status }).from(maintenanceNotifications).where(eq(maintenanceNotifications.id, order.notificationId)).limit(1))[0];
    if (!notification) throw new HttpError(404, "Source notification not found", "NOTIFICATION_NOT_FOUND");
    const notificationStatus = completeNotification(notification.status, actor);
    await tx.update(workOrders).set({ status, closedAt: now, updatedAt: now, updatedBy: actor.id }).where(eq(workOrders.id, id));
    await tx.update(maintenanceNotifications).set({ status: notificationStatus, completedAt: now, updatedAt: now, updatedBy: actor.id }).where(eq(maintenanceNotifications.id, order.notificationId));
    await tx.insert(workOrderEvents).values({ id: randomUUID(), workOrderId: id, eventType: "WORK_ORDER_CLOSED", fromStatus: order.status, toStatus: status, note: input.note, actorUserId: actor.id, createdAt: now });
    await tx.insert(auditLogs).values(auditRow({ actor, action: "WORK_ORDER_CLOSED", category: "MAINTENANCE", targetType: "WORK_ORDER", targetId: id, targetName: order.code, description: `Closed ${order.code}`, previousValues: { status: order.status }, newValues: { status, note: input.note }, meta, createdAt: now }));
    return { id, status };
  });
}
