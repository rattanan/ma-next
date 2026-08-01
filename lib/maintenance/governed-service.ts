import { randomBytes, randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, isNull, ne } from "drizzle-orm";
import type { z } from "zod";
import type { AuthenticatedUser } from "../auth/session";
import type { RequestMeta } from "../auth/request";
import { maskSensitive } from "../auth/mask";
import { db } from "../db";
import {
  approvalHistory, approvalTasks, assets, attachments, auditLogs, maintenanceNotifications, notificationEvents, notificationReviews, workOrderAssignments,
  workOrderCompletions, workOrderEvents, workOrderOperatorDecisions, workOrderRechecks,
  workOrderTasks, workOrders,
} from "../db/schema";
import { HttpError } from "../http";
import { prisma } from "../prisma";
import { canAccessScope, requireActorPermission, requireAssignedTechnician, requireOwnerOrScope, requireScope } from "./authorization";
import { transitionNotification, transitionWorkOrder } from "./workflow";
import { nextCompletionRevisionNumber } from "./revisions";
import type {
  completionRevisionSchema, governedAssignmentSchema, governedNotificationReviewSchema, managerCompletionDecisionSchema,
  notificationCloseSchema, notificationDraftUpdateSchema, notificationInformationResponseSchema, notificationSchema, operatorDecisionSchema,
  progressNoteSchema, waitingStatusSchema,
} from "./validation";

type Actor = AuthenticatedUser;
type NotificationInput = z.infer<typeof notificationSchema>;
type NotificationDraftUpdate = z.infer<typeof notificationDraftUpdateSchema>;
type ReviewInput = z.infer<typeof governedNotificationReviewSchema>;
type AssignmentInput = z.infer<typeof governedAssignmentSchema>;
type WaitingInput = z.infer<typeof waitingStatusSchema>;
type ProgressInput = z.infer<typeof progressNoteSchema>;
type CompletionInput = z.infer<typeof completionRevisionSchema>;
type ManagerDecisionInput = z.infer<typeof managerCompletionDecisionSchema>;
type OperatorDecisionInput = z.infer<typeof operatorDecisionSchema>;

const code = (prefix: string) => `${prefix}-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomBytes(3).toString("hex").toUpperCase()}`;
const json = (value: unknown) => JSON.stringify(maskSensitive(value));
const dateOrNull = (value?: string | null) => value ? new Date(value) : null;

function audit(actor: Actor, meta: RequestMeta, organizationId: string | null, action: string, targetType: string, targetId: string, targetName: string, previousValues: unknown, newValues: unknown, now: Date) {
  return { id: randomUUID(), actorUserId: actor.id, actorName: actor.fullName, actorRole: actor.role, organizationId, action, category: "MAINTENANCE", targetType, targetId, targetName, result: "SUCCESS" as const, description: action.replaceAll("_", " ").toLowerCase(), previousValues: json(previousValues), newValues: json(newValues), ipAddress: meta.ipAddress, userAgent: meta.userAgent, requestId: meta.requestId, createdAt: now };
}
function notificationEvent(notificationId: string, eventType: string, actor: Actor, now: Date, fromStatus?: typeof maintenanceNotifications.$inferSelect.status, toStatus?: typeof maintenanceNotifications.$inferSelect.status, note?: string, metadata?: unknown) {
  return { id: randomUUID(), notificationId, eventType, fromStatus, toStatus, note: note || null, actorUserId: actor.id, actorRole: actor.role, metadata: metadata === undefined ? null : json(metadata), createdAt: now };
}
function orderEvent(workOrderId: string, eventType: string, actor: Actor, now: Date, fromStatus?: typeof workOrders.$inferSelect.status, toStatus?: typeof workOrders.$inferSelect.status, note?: string, metadata?: unknown) {
  return { id: randomUUID(), workOrderId, eventType, fromStatus, toStatus, note: note || null, actorUserId: actor.id, actorRole: actor.role, metadata: metadata === undefined ? null : json(metadata), createdAt: now };
}

async function primaryOrganization(actor: Actor, requested?: string | null) {
  if (requested) { requireScope(actor, { organizationId: requested }, "NOTIFICATION_CREATE"); return requested; }
  const ids = [...new Set((actor.scopes ?? []).map((scope) => scope.organizationId).filter((id): id is string => Boolean(id)))];
  if (ids.length === 1) return ids[0];
  if ((actor.scopes ?? []).some((scope) => scope.scopeType === "GLOBAL") || actor.role === "ADMIN") {
    const organizations = await prisma.organization.findMany({ where: { active: true }, select: { id: true }, take: 2 });
    if (organizations.length === 1) return organizations[0].id;
  }
  throw new HttpError(400, "Organization is required", "ORGANIZATION_REQUIRED");
}

async function notificationForMutation(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], id: string, actor: Actor, permission: Parameters<typeof requireActorPermission>[1]) {
  requireActorPermission(actor, permission);
  const row = (await tx.select().from(maintenanceNotifications).where(eq(maintenanceNotifications.id, id)).limit(1))[0];
  if (!row) throw new HttpError(404, "Maintenance notification not found", "NOTIFICATION_NOT_FOUND");
  requireScope(actor, row, permission);
  return row;
}
async function orderForMutation(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], id: string, actor: Actor, permission: Parameters<typeof requireActorPermission>[1]) {
  requireActorPermission(actor, permission);
  const row = (await tx.select().from(workOrders).where(eq(workOrders.id, id)).limit(1))[0];
  if (!row) throw new HttpError(404, "Work order not found", "WORK_ORDER_NOT_FOUND");
  requireScope(actor, row, permission);
  return row;
}

export async function createGovernedNotification(input: NotificationInput, actor: Actor, meta: RequestMeta) {
  requireActorPermission(actor, "NOTIFICATION_CREATE");
  const organizationId = await primaryOrganization(actor, input.organizationId); const id = randomUUID(); const number = code("MN"); const now = new Date();
  await db.transaction(async (tx) => {
    const asset = (await tx.select({ id: assets.id, status: assets.status }).from(assets).where(eq(assets.id, input.assetId)).limit(1))[0];
    if (!asset || asset.status !== "ACTIVE") throw new HttpError(400, "An active asset is required", "INVALID_ASSET");
    const photoIds = [...new Set(input.photoAttachmentIds)];
    if (photoIds.length !== input.photoAttachmentIds.length) throw new HttpError(400, "Duplicate photo attachments are not allowed", "INVALID_ATTACHMENT");
    if (photoIds.length) {
      const uploadedPhotos = await tx.select({ id: attachments.id }).from(attachments).where(and(inArray(attachments.id, photoIds), eq(attachments.entityType, "MAINTENANCE_NOTIFICATION_DRAFT"), eq(attachments.uploadedBy, actor.id), isNull(attachments.deletedAt)));
      if (uploadedPhotos.length !== photoIds.length) throw new HttpError(400, "One or more notification photos are invalid", "INVALID_ATTACHMENT");
    }
    await tx.insert(maintenanceNotifications).values({ id, code: number, organizationId, siteId: input.siteId ?? null, assetId: input.assetId, title: input.title, description: input.description, symptoms: input.symptoms || null, problemCategory: input.problemCategory || null, operationalImpact: input.operationalImpact || null, safetyImpact: input.safetyImpact || null, productionImpact: input.productionImpact || null, incidentAt: dateOrNull(input.incidentAt), responsibleGroup: input.responsibleGroup || null, remarks: input.remarks || null, requestedUrgency: input.requestedUrgency || null, contactPerson: input.contactPerson || null, contactPhone: input.contactPhone || null, type: input.type, priority: input.priority, severity: input.severity, equipmentOperatingStatus: input.equipmentOperatingStatus, breakdown: input.breakdown, status: "DRAFT", requestedBy: actor.id, departmentId: input.departmentId ?? null, photoAttachmentIds: json(input.photoAttachmentIds), dueAt: dateOrNull(input.dueAt), createdAt: now, updatedAt: now, createdBy: actor.id, updatedBy: actor.id });
    if (photoIds.length) await tx.update(attachments).set({ entityType: "MAINTENANCE_NOTIFICATION", entityId: id }).where(inArray(attachments.id, photoIds));
    await tx.insert(notificationEvents).values(notificationEvent(id, "NOTIFICATION_CREATED", actor, now, undefined, "DRAFT"));
    await tx.insert(auditLogs).values(audit(actor, meta, organizationId, "NOTIFICATION_CREATED", "MAINTENANCE_NOTIFICATION", id, number, {}, input, now));
  });
  return { id, code: number, status: "DRAFT" as const };
}

export async function getGovernedNotification(id: string, actor: Actor) {
  requireActorPermission(actor, "NOTIFICATION_VIEW");
  const row = (await db.select().from(maintenanceNotifications).where(eq(maintenanceNotifications.id, id)).limit(1))[0];
  if (!row) throw new HttpError(404, "Maintenance notification not found", "NOTIFICATION_NOT_FOUND");
  if (row.requestedBy !== actor.id) requireScope(actor, row, "NOTIFICATION_VIEW");
  return row;
}

export async function updateGovernedNotificationDraft(id: string, input: NotificationDraftUpdate, actor: Actor, meta: RequestMeta) {
  requireActorPermission(actor, "NOTIFICATION_EDIT_OWN_DRAFT"); const now = new Date();
  return db.transaction(async (tx) => {
    const row = (await tx.select().from(maintenanceNotifications).where(eq(maintenanceNotifications.id, id)).limit(1))[0];
    if (!row) throw new HttpError(404, "Maintenance notification not found", "NOTIFICATION_NOT_FOUND");
    requireOwnerOrScope(actor, row.requestedBy, row, "NOTIFICATION_EDIT_OWN_DRAFT");
    if (!["DRAFT", "RETURNED", "NEEDS_INFORMATION"].includes(row.status)) throw new HttpError(409, "Only draft or returned notifications can be edited", "NOTIFICATION_READ_ONLY");
    const changes = { ...(input.assetId !== undefined && { assetId: input.assetId }), ...(input.siteId !== undefined && { siteId: input.siteId }), ...(input.title !== undefined && { title: input.title }), ...(input.description !== undefined && { description: input.description }), ...(input.symptoms !== undefined && { symptoms: input.symptoms || null }), ...(input.problemCategory !== undefined && { problemCategory: input.problemCategory || null }), ...(input.operationalImpact !== undefined && { operationalImpact: input.operationalImpact || null }), ...(input.safetyImpact !== undefined && { safetyImpact: input.safetyImpact || null }), ...(input.productionImpact !== undefined && { productionImpact: input.productionImpact || null }), ...(input.incidentAt !== undefined && { incidentAt: dateOrNull(input.incidentAt) }), ...(input.responsibleGroup !== undefined && { responsibleGroup: input.responsibleGroup || null }), ...(input.remarks !== undefined && { remarks: input.remarks || null }), ...(input.requestedUrgency !== undefined && { requestedUrgency: input.requestedUrgency || null }), ...(input.contactPerson !== undefined && { contactPerson: input.contactPerson || null }), ...(input.contactPhone !== undefined && { contactPhone: input.contactPhone || null }), ...(input.type !== undefined && { type: input.type }), ...(input.priority !== undefined && { priority: input.priority }), ...(input.severity !== undefined && { severity: input.severity }), ...(input.equipmentOperatingStatus !== undefined && { equipmentOperatingStatus: input.equipmentOperatingStatus }), ...(input.breakdown !== undefined && { breakdown: input.breakdown }), ...(input.departmentId !== undefined && { departmentId: input.departmentId }), ...(input.photoAttachmentIds !== undefined && { photoAttachmentIds: json(input.photoAttachmentIds) }), ...(input.dueAt !== undefined && { dueAt: dateOrNull(input.dueAt) }), updatedAt: now, updatedBy: actor.id };
    await tx.update(maintenanceNotifications).set(changes).where(and(eq(maintenanceNotifications.id, id), eq(maintenanceNotifications.status, row.status)));
    await tx.insert(notificationEvents).values(notificationEvent(id, "NOTIFICATION_DRAFT_UPDATED", actor, now, row.status, row.status, "Operator updated editable fields"));
    await tx.insert(auditLogs).values(audit(actor, meta, row.organizationId, "NOTIFICATION_DRAFT_UPDATED", "MAINTENANCE_NOTIFICATION", id, row.code, row, changes, now));
    return { id, status: row.status, updatedAt: now };
  });
}

export async function submitGovernedNotification(id: string, comment: string, actor: Actor, meta: RequestMeta) {
  const now = new Date();
  return db.transaction(async (tx) => {
    const row = await notificationForMutation(tx, id, actor, "NOTIFICATION_SUBMIT");
    requireOwnerOrScope(actor, row.requestedBy, row, "NOTIFICATION_SUBMIT");
    const next = transitionNotification(row.status, "SUBMIT", { actor });
    await tx.update(maintenanceNotifications).set({ status: next, submittedAt: now, updatedAt: now, updatedBy: actor.id }).where(and(eq(maintenanceNotifications.id, id), eq(maintenanceNotifications.status, row.status)));
    const previous = (await tx.select({ approvalRound: approvalTasks.approvalRound }).from(approvalTasks).where(and(eq(approvalTasks.approvalType, "NOTIFICATION"), eq(approvalTasks.referenceId, id))).orderBy(desc(approvalTasks.approvalRound)).limit(1))[0];
    const taskId = randomUUID();
    await tx.insert(approvalTasks).values({ id: taskId, approvalType: "NOTIFICATION", referenceId: id, referenceNumber: row.code, title: row.title, requestedById: actor.id, requestedAt: now, assignedRole: "MAINTENANCE_MANAGER", status: "PENDING", priority: row.priority, organizationId: row.organizationId, siteId: row.siteId, departmentId: row.departmentId, approvalRound: (previous?.approvalRound ?? 0) + 1, createdAt: now, updatedAt: now });
    await tx.insert(approvalHistory).values({ id: randomUUID(), approvalTaskId: taskId, action: previous ? "RESUBMITTED" : "SUBMITTED", actionById: actor.id, comment: comment || null, createdAt: now });
    await tx.insert(notificationEvents).values(notificationEvent(id, "NOTIFICATION_SUBMITTED", actor, now, row.status, next, comment));
    await tx.insert(auditLogs).values(audit(actor, meta, row.organizationId, "NOTIFICATION_SUBMITTED", "MAINTENANCE_NOTIFICATION", id, row.code, { status: row.status }, { status: next }, now));
    return { id, status: next };
  });
}

export async function provideNotificationInformation(id: string, input: z.infer<typeof notificationInformationResponseSchema>, actor: Actor, meta: RequestMeta) {
  const now = new Date(); return db.transaction(async (tx) => {
    const row = await notificationForMutation(tx, id, actor, "NOTIFICATION_SUBMIT"); requireOwnerOrScope(actor, row.requestedBy, row, "NOTIFICATION_SUBMIT");
    const next = transitionNotification(row.status, "PROVIDE_INFORMATION", { actor });
    await tx.update(maintenanceNotifications).set({ status: next, submittedAt: now, informationRequest: null, updatedAt: now, updatedBy: actor.id }).where(eq(maintenanceNotifications.id, id));
    const previous = (await tx.select({ approvalRound: approvalTasks.approvalRound }).from(approvalTasks).where(and(eq(approvalTasks.approvalType, "NOTIFICATION"), eq(approvalTasks.referenceId, id))).orderBy(desc(approvalTasks.approvalRound)).limit(1))[0];
    const taskId = randomUUID();
    await tx.insert(approvalTasks).values({ id: taskId, approvalType: "NOTIFICATION", referenceId: id, referenceNumber: row.code, title: row.title, requestedById: actor.id, requestedAt: now, assignedRole: "MAINTENANCE_MANAGER", status: "PENDING", priority: row.priority, organizationId: row.organizationId, siteId: row.siteId, departmentId: row.departmentId, approvalRound: (previous?.approvalRound ?? 0) + 1, createdAt: now, updatedAt: now });
    await tx.insert(approvalHistory).values({ id: randomUUID(), approvalTaskId: taskId, action: "RESUBMITTED", actionById: actor.id, comment: input.response, createdAt: now });
    await tx.insert(notificationEvents).values(notificationEvent(id, "INFORMATION_PROVIDED", actor, now, row.status, next, input.response, { attachmentIds: input.attachmentIds }));
    await tx.insert(auditLogs).values(audit(actor, meta, row.organizationId, "NOTIFICATION_INFORMATION_PROVIDED", "MAINTENANCE_NOTIFICATION", id, row.code, { status: row.status }, { status: next, response: input.response }, now));
    return { id, status: next };
  });
}

export async function reviewGovernedNotification(id: string, input: ReviewInput, actor: Actor, meta: RequestMeta) {
  const now = new Date(); return db.transaction(async (tx) => {
    const permission = input.action === "REQUEST_INFORMATION" ? "NOTIFICATION_REQUEST_INFORMATION" : input.action === "REJECT" ? "NOTIFICATION_REJECT" : input.action === "APPROVE" ? "NOTIFICATION_APPROVE" : "NOTIFICATION_REVIEW";
    const row = await notificationForMutation(tx, id, actor, permission);
    const task = (await tx.select().from(approvalTasks).where(and(eq(approvalTasks.approvalType, "NOTIFICATION"), eq(approvalTasks.referenceId, id), inArray(approvalTasks.status, ["PENDING", "IN_REVIEW"]))).orderBy(desc(approvalTasks.approvalRound)).limit(1))[0];
    if (!task) throw new HttpError(409, "No active approval task exists for this notification", "APPROVAL_TASK_NOT_ACTIVE");
    if (task.assignedApproverId && task.assignedApproverId !== actor.id) throw new HttpError(403, "This approval is assigned to another approver", "APPROVAL_ASSIGNEE_FORBIDDEN");
    const next = transitionNotification(row.status, input.action, { actor, note: input.comment });
    const decision = input.action === "REQUEST_INFORMATION" ? "NEEDS_INFORMATION" : input.action === "REJECT" ? "REJECTED" : input.action === "APPROVE" ? "APPROVED" : null;
    if (decision) await tx.insert(notificationReviews).values({ id: randomUUID(), notificationId: id, decision, note: input.comment || input.action, reviewedBy: actor.id, reviewedAt: now });
    const taskStatus = input.action === "START_REVIEW" ? "IN_REVIEW" : input.action === "REQUEST_INFORMATION" ? "RETURNED" : input.action === "APPROVE" ? "APPROVED" : input.action === "REJECT" ? "REJECTED" : task.status;
    const historyAction = input.action === "START_REVIEW" ? "OPENED" : input.action === "REQUEST_INFORMATION" ? "RETURNED" : input.action === "APPROVE" ? "APPROVED" : "REJECTED";
    await tx.update(approvalTasks).set({ status: taskStatus, assignedApproverId: task.assignedApproverId ?? actor.id, reviewedAt: task.reviewedAt ?? now, completedAt: input.action === "START_REVIEW" ? null : now, decisionById: input.action === "START_REVIEW" ? null : actor.id, decisionComment: input.comment || null, returnReason: input.action === "REQUEST_INFORMATION" ? input.comment : null, updatedAt: now }).where(and(eq(approvalTasks.id, task.id), eq(approvalTasks.status, task.status)));
    await tx.insert(approvalHistory).values({ id: randomUUID(), approvalTaskId: task.id, action: historyAction, actionById: actor.id, comment: input.comment || null, createdAt: now });
    await tx.update(maintenanceNotifications).set({ status: next, reviewedAt: now, reviewedBy: actor.id, informationRequest: input.action === "REQUEST_INFORMATION" ? input.comment : row.informationRequest, rejectionReason: input.action === "REJECT" ? input.comment : row.rejectionReason, ...(input.action === "APPROVE" && input.responsibleGroup ? { responsibleGroup: input.responsibleGroup } : {}), ...(input.action === "APPROVE" && input.priority ? { priority: input.priority } : {}), ...(input.action === "APPROVE" && input.type ? { type: input.type } : {}), updatedAt: now, updatedBy: actor.id }).where(eq(maintenanceNotifications.id, id));
    await tx.insert(notificationEvents).values(notificationEvent(id, `NOTIFICATION_${input.action}`, actor, now, row.status, next, input.comment));
    await tx.insert(auditLogs).values(audit(actor, meta, row.organizationId, `NOTIFICATION_${input.action}`, "MAINTENANCE_NOTIFICATION", id, row.code, { status: row.status }, { status: next, comment: input.comment }, now));
    return { id, status: next };
  });
}

export async function createWorkOrderFromNotification(notificationId: string, input: Omit<AssignmentInput, "reason"> & { title?: string; description?: string; priority?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" }, actor: Actor, meta: RequestMeta) {
  requireActorPermission(actor, "WORK_ORDER_CREATE"); const now = new Date(); const id = randomUUID(); const number = code("WO");
  return db.transaction(async (tx) => {
    const notification = await notificationForMutation(tx, notificationId, actor, "WORK_ORDER_CREATE");
    if (notification.status !== "APPROVED" && notification.status !== "CONVERTED_TO_WORK_ORDER" && notification.status !== "IN_MAINTENANCE") throw new HttpError(409, "Work orders require an approved notification", "INVALID_NOTIFICATION_STATUS");
    const technician = await prisma.user.findFirst({ where: { id: input.technicianId, status: "ACTIVE", roles: { some: { role: { code: "TECHNICIAN", active: true } } } }, select: { id: true } });
    if (!technician) throw new HttpError(400, "Assignee must be an active Technician", "INVALID_TECHNICIAN");
    await tx.insert(workOrders).values({ id, code: number, organizationId: notification.organizationId, siteId: notification.siteId, notificationId, sourceType: "NOTIFICATION", sourceRecordId: null, workType: "CORRECTIVE", assetId: notification.assetId, title: input.title || notification.title, description: input.description || notification.description, priority: input.priority || notification.priority, severity: notification.severity, equipmentOperatingStatus: notification.equipmentOperatingStatus, status: "ASSIGNED", departmentId: notification.departmentId, crewName: input.teamName || null, assignedTo: input.technicianId, assignedBy: actor.id, assignedAt: now, dueAt: dateOrNull(input.dueAt), reportedAt: notification.submittedAt || notification.createdAt, createdAt: now, updatedAt: now, createdBy: actor.id, updatedBy: actor.id });
    await tx.insert(workOrderAssignments).values({ id: randomUUID(), workOrderId: id, departmentId: notification.departmentId, userId: input.technicianId, teamName: input.teamName || null, assignmentType: "TECHNICIAN", assignedAt: now, assignedBy: actor.id, note: input.instructions });
    await tx.insert(workOrderEvents).values(orderEvent(id, "WORK_ORDER_CREATED_AND_ASSIGNED", actor, now, undefined, "ASSIGNED", input.instructions));
    if (notification.status === "APPROVED") { const next = transitionNotification(notification.status, "START_MAINTENANCE", { actor }); await tx.update(maintenanceNotifications).set({ status: next, updatedAt: now, updatedBy: actor.id }).where(eq(maintenanceNotifications.id, notificationId)); await tx.insert(notificationEvents).values(notificationEvent(notificationId, "WORK_ORDER_CREATED", actor, now, notification.status, next, input.instructions, { workOrderId: id, workOrderCode: number })); }
    await tx.insert(auditLogs).values(audit(actor, meta, notification.organizationId, "WORK_ORDER_CREATED", "WORK_ORDER", id, number, {}, { notificationId, technicianId: input.technicianId }, now));
    return { id, code: number, status: "ASSIGNED" as const };
  });
}

export async function assignGovernedWorkOrder(id: string, input: AssignmentInput, actor: Actor, meta: RequestMeta) {
  const now = new Date(); return db.transaction(async (tx) => {
    const order = await orderForMutation(tx, id, actor, await orderStatusStarted(tx, id) ? "WORK_ORDER_REASSIGN" : "WORK_ORDER_ASSIGN");
    if (!["CREATED", "ASSIGNED", "RETURNED_TO_TECHNICIAN"].includes(order.status)) throw new HttpError(409, "Work order cannot be assigned in its current status", "INVALID_TRANSITION");
    if (order.startedAt && !input.reason) throw new HttpError(400, "A reassignment reason is required after work starts", "REASSIGNMENT_REASON_REQUIRED");
    const technician = await prisma.user.findFirst({ where: { id: input.technicianId, status: "ACTIVE", roles: { some: { role: { code: "TECHNICIAN", active: true } } } }, select: { id: true } });
    if (!technician) throw new HttpError(400, "Assignee must be an active Technician", "INVALID_TECHNICIAN");
    await tx.update(workOrderAssignments).set({ endedAt: now }).where(and(eq(workOrderAssignments.workOrderId, id), isNull(workOrderAssignments.endedAt)));
    await tx.insert(workOrderAssignments).values({ id: randomUUID(), workOrderId: id, departmentId: order.departmentId, userId: input.technicianId, teamName: input.teamName || null, assignmentType: "TECHNICIAN", assignedAt: now, assignedBy: actor.id, note: input.reason || input.instructions });
    const status = order.status === "CREATED" ? "ASSIGNED" : order.status;
    await tx.update(workOrders).set({ status, assignedTo: input.technicianId, assignedAt: now, assignedBy: actor.id, crewName: input.teamName || order.crewName, dueAt: dateOrNull(input.dueAt) ?? order.dueAt, updatedAt: now, updatedBy: actor.id }).where(eq(workOrders.id, id));
    await tx.insert(workOrderEvents).values(orderEvent(id, order.assignedTo ? "TECHNICIAN_REASSIGNED" : "TECHNICIAN_ASSIGNED", actor, now, order.status, status, input.reason || input.instructions, { previousTechnicianId: order.assignedTo, technicianId: input.technicianId }));
    await tx.insert(auditLogs).values(audit(actor, meta, order.organizationId, order.assignedTo ? "WORK_ORDER_REASSIGNED" : "WORK_ORDER_ASSIGNED", "WORK_ORDER", id, order.code, { assignedTo: order.assignedTo }, { assignedTo: input.technicianId, reason: input.reason }, now));
    return { id, status, assignedTo: input.technicianId };
  });
}
async function orderStatusStarted(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], id: string) { return Boolean((await tx.select({ startedAt: workOrders.startedAt }).from(workOrders).where(eq(workOrders.id, id)).limit(1))[0]?.startedAt); }

export async function technicianTransition(id: string, action: "ACCEPT_ASSIGNMENT" | "START" | "RESUME", input: ProgressInput, actor: Actor, meta: RequestMeta) {
  const permission = action === "ACCEPT_ASSIGNMENT" ? "WORK_ORDER_ACCEPT_ASSIGNMENT" : action === "START" ? "WORK_ORDER_START" : "WORK_ORDER_UPDATE_PROGRESS"; const now = new Date();
  return db.transaction(async (tx) => { const order = await orderForMutation(tx, id, actor, permission); requireAssignedTechnician(actor, order.assignedTo); const next = transitionWorkOrder(order.status, action, { actor, assignedTo: order.assignedTo, note: input.note }); await tx.update(workOrders).set({ status: next, technicianAcceptedAt: action === "ACCEPT_ASSIGNMENT" ? now : order.technicianAcceptedAt, startedAt: action === "START" ? order.startedAt ?? now : order.startedAt, backlogReason: action === "RESUME" ? null : order.backlogReason, updatedAt: now, updatedBy: actor.id }).where(eq(workOrders.id, id)); await tx.insert(workOrderEvents).values(orderEvent(id, `WORK_ORDER_${action}`, actor, now, order.status, next, input.note)); await tx.insert(auditLogs).values(audit(actor, meta, order.organizationId, `WORK_ORDER_${action}`, "WORK_ORDER", id, order.code, { status: order.status }, { status: next }, now)); return { id, status: next }; });
}

export async function setWaitingStatus(id: string, input: WaitingInput, actor: Actor, meta: RequestMeta) {
  const action = input.status === "WAITING_FOR_PARTS" ? "WAIT_FOR_PARTS" : input.status === "WAITING_FOR_VENDOR" ? "WAIT_FOR_VENDOR" : input.status === "WAITING_FOR_ACCESS" ? "WAIT_FOR_ACCESS" : "HOLD"; const now = new Date();
  return db.transaction(async (tx) => { const order = await orderForMutation(tx, id, actor, "WORK_ORDER_UPDATE_PROGRESS"); requireAssignedTechnician(actor, order.assignedTo); const next = transitionWorkOrder(order.status, action, { actor, assignedTo: order.assignedTo, note: input.reason }); await tx.update(workOrders).set({ status: next, backlogReason: input.reason, updatedAt: now, updatedBy: actor.id }).where(eq(workOrders.id, id)); await tx.insert(workOrderEvents).values(orderEvent(id, action, actor, now, order.status, next, input.reason, { expectedResumeAt: input.expectedResumeAt })); await tx.insert(auditLogs).values(audit(actor, meta, order.organizationId, action, "WORK_ORDER", id, order.code, { status: order.status }, { status: next, reason: input.reason }, now)); return { id, status: next }; });
}

export async function submitCompletionRevision(id: string, input: CompletionInput, actor: Actor, meta: RequestMeta) {
  const now = new Date(); return db.transaction(async (tx) => {
    const order = await orderForMutation(tx, id, actor, "WORK_ORDER_SUBMIT_COMPLETION"); requireAssignedTechnician(actor, order.assignedTo);
    const tasks = await tx.select({ required: workOrderTasks.required, status: workOrderTasks.status }).from(workOrderTasks).where(eq(workOrderTasks.workOrderId, id));
    const next = transitionWorkOrder(order.status, "SUBMIT_COMPLETION", { actor, assignedTo: order.assignedTo, requiredTasks: tasks });
    const latest = (await tx.select({ revisionNumber: workOrderCompletions.revisionNumber }).from(workOrderCompletions).where(eq(workOrderCompletions.workOrderId, id)).orderBy(desc(workOrderCompletions.revisionNumber)).limit(1))[0]; const revisionNumber = nextCompletionRevisionNumber(latest?.revisionNumber); const completionId = randomUUID();
    await tx.insert(workOrderCompletions).values({ id: completionId, workOrderId: id, revisionNumber, result: input.workSummary.slice(0, 190), problem: input.diagnosis, cause: input.rootCause || null, rootCauseUnknownReason: input.rootCauseUnknownReason || null, solution: input.correctiveAction, notes: input.workSummary, durationMinutes: input.laborMinutes, testProcedure: input.testProcedure, testResult: input.testResult, remainingIssue: input.remainingIssue || null, recommendation: input.recommendation || null, beforePhotoAttachmentIds: json(input.beforePhotoAttachmentIds), afterPhotoAttachmentIds: json(input.afterPhotoAttachmentIds), managerDecision: "PENDING", completedBy: actor.id, completedAt: now, createdAt: now });
    await tx.update(workOrderRechecks).set({ status: "RESUBMITTED" }).where(and(eq(workOrderRechecks.workOrderId, id), inArray(workOrderRechecks.status, ["OPEN", "IN_PROGRESS", "RETURNED_AGAIN"])));
    await tx.update(workOrders).set({ status: next, technicianCompletedAt: now, actualFinishAt: now, updatedAt: now, updatedBy: actor.id }).where(eq(workOrders.id, id));
    await tx.insert(workOrderEvents).values(orderEvent(id, "TECHNICIAN_COMPLETION_SUBMITTED", actor, now, order.status, next, input.workSummary, { revisionNumber, completionId })); await tx.insert(auditLogs).values(audit(actor, meta, order.organizationId, "COMPLETION_REVISION_SUBMITTED", "WORK_ORDER", id, order.code, { status: order.status }, { status: next, revisionNumber }, now)); return { id, status: next, completionId, revisionNumber };
  });
}

export async function decideCompletion(id: string, input: ManagerDecisionInput, actor: Actor, meta: RequestMeta) {
  const now = new Date(); return db.transaction(async (tx) => {
    const order = await orderForMutation(tx, id, actor, input.decision === "APPROVE" ? "WORK_ORDER_APPROVE_COMPLETION" : "WORK_ORDER_RETURN_FOR_RECHECK");
    const completion = (await tx.select().from(workOrderCompletions).where(eq(workOrderCompletions.workOrderId, id)).orderBy(desc(workOrderCompletions.revisionNumber)).limit(1))[0]; if (!completion) throw new HttpError(409, "No completion revision exists", "COMPLETION_NOT_FOUND");
    let reviewStatus = order.status; if (["TECHNICIAN_COMPLETED", "COMPLETION_PENDING"].includes(reviewStatus)) reviewStatus = transitionWorkOrder(reviewStatus, "BEGIN_MANAGER_REVIEW", { actor });
    const action = input.decision === "APPROVE" ? "APPROVE_COMPLETION" : "RETURN_FOR_RECHECK"; const next = transitionWorkOrder(reviewStatus, action, { actor, completionExists: true, completionOwnerId: completion.completedBy, note: input.comment });
    await tx.update(workOrderCompletions).set({ managerDecision: input.decision === "APPROVE" ? "APPROVED" : "RETURNED", managerId: actor.id, managerComment: input.comment, managerReviewedAt: now }).where(eq(workOrderCompletions.id, completion.id));
    if (input.decision === "RETURN") { const latest = (await tx.select({ cycleNumber: workOrderRechecks.cycleNumber }).from(workOrderRechecks).where(eq(workOrderRechecks.workOrderId, id)).orderBy(desc(workOrderRechecks.cycleNumber)).limit(1))[0]; const technicianId = input.technicianId || order.assignedTo; await tx.insert(workOrderRechecks).values({ id: randomUUID(), workOrderId: id, completionId: completion.id, cycleNumber: (latest?.cycleNumber ?? 0) + 1, requestedByUserId: actor.id, requestedByRole: actor.role, returnReason: input.comment, requiredActions: json(input.requiredActions), assignedTechnicianId: technicianId, returnedAt: now, dueAt: dateOrNull(input.dueAt), status: "OPEN" }); if (technicianId && technicianId !== order.assignedTo) { await tx.update(workOrderAssignments).set({ endedAt: now }).where(and(eq(workOrderAssignments.workOrderId, id), isNull(workOrderAssignments.endedAt))); await tx.insert(workOrderAssignments).values({ id: randomUUID(), workOrderId: id, departmentId: order.departmentId, userId: technicianId, teamName: order.crewName, assignmentType: "TECHNICIAN", assignedAt: now, assignedBy: actor.id, note: input.comment }); } await tx.update(workOrders).set({ status: next, assignedTo: technicianId, dueAt: dateOrNull(input.dueAt) ?? order.dueAt, updatedAt: now, updatedBy: actor.id }).where(eq(workOrders.id, id)); }
    else { const waiting = transitionWorkOrder(next, "REQUEST_OPERATOR_ACCEPTANCE", { actor }); await tx.update(workOrderRechecks).set({ status: "APPROVED", resolvedAt: now }).where(and(eq(workOrderRechecks.workOrderId, id), ne(workOrderRechecks.status, "APPROVED"))); await tx.update(workOrders).set({ status: waiting, managerApprovedAt: now, updatedAt: now, updatedBy: actor.id }).where(eq(workOrders.id, id)); if (order.notificationId) { const notification = (await tx.select().from(maintenanceNotifications).where(eq(maintenanceNotifications.id, order.notificationId)).limit(1))[0]; if (notification && ["CONVERTED_TO_WORK_ORDER", "IN_MAINTENANCE"].includes(notification.status)) { const siblings = await tx.select({ id: workOrders.id, status: workOrders.status }).from(workOrders).where(eq(workOrders.notificationId, order.notificationId)); if (siblings.every((item) => item.id === id || ["MANAGER_APPROVED", "WAITING_FOR_OPERATOR_ACCEPTANCE", "OPERATOR_ACCEPTED", "CLOSED"].includes(item.status))) { const nnext = transitionNotification(notification.status, "REQUEST_OPERATOR_ACCEPTANCE", { actor }); await tx.update(maintenanceNotifications).set({ status: nnext, updatedAt: now, updatedBy: actor.id }).where(eq(maintenanceNotifications.id, notification.id)); await tx.insert(notificationEvents).values(notificationEvent(notification.id, "OPERATOR_ACCEPTANCE_REQUESTED", actor, now, notification.status, nnext)); } } } }
    const finalStatus = input.decision === "APPROVE" ? "WAITING_FOR_OPERATOR_ACCEPTANCE" : next; await tx.insert(workOrderEvents).values(orderEvent(id, input.decision === "APPROVE" ? "MANAGER_APPROVED_COMPLETION" : "MANAGER_RETURNED_FOR_RECHECK", actor, now, order.status, finalStatus, input.comment, { revisionNumber: completion.revisionNumber })); await tx.insert(auditLogs).values(audit(actor, meta, order.organizationId, input.decision === "APPROVE" ? "COMPLETION_APPROVED" : "WORK_RETURNED_FOR_RECHECK", "WORK_ORDER", id, order.code, { status: order.status }, { status: finalStatus, revisionNumber: completion.revisionNumber }, now)); return { id, status: finalStatus };
  });
}

export async function recordOperatorDecision(id: string, input: OperatorDecisionInput, actor: Actor, meta: RequestMeta) {
  const permission = input.decision === "ACCEPT" ? "NOTIFICATION_ACCEPT_WORK" : "NOTIFICATION_REJECT_WORK"; const now = new Date(); return db.transaction(async (tx) => {
    const order = await orderForMutation(tx, id, actor, permission); if (!order.notificationId) throw new HttpError(409, "Operator decisions require a linked notification", "NOTIFICATION_REQUIRED"); const notification = await notificationForMutation(tx, order.notificationId, actor, permission); requireOwnerOrScope(actor, notification.requestedBy, notification, permission);
    const action = input.decision === "ACCEPT" ? "OPERATOR_ACCEPT" : "OPERATOR_REJECT"; const next = transitionWorkOrder(order.status, action, { actor, note: input.decision === "REJECT" ? input.reason : input.comment });
    const siblings = input.decision === "ACCEPT" ? await tx.select({ id: workOrders.id, status: workOrders.status }).from(workOrders).where(eq(workOrders.notificationId, notification.id)) : [];
    const allAccepted = input.decision === "ACCEPT" && siblings.every((item) => item.id === id || ["OPERATOR_ACCEPTED", "CLOSED"].includes(item.status));
    const nnext = input.decision === "REJECT" || allAccepted ? transitionNotification(notification.status, action, { actor, note: input.decision === "REJECT" ? input.reason : input.comment }) : notification.status;
    await tx.insert(workOrderOperatorDecisions).values({ id: randomUUID(), workOrderId: id, notificationId: notification.id, decision: input.decision === "ACCEPT" ? "ACCEPTED" : "REJECTED", reason: input.decision === "REJECT" ? input.reason : input.comment || null, remainingProblem: input.decision === "REJECT" ? input.remainingProblem : null, attachmentIds: input.decision === "REJECT" ? json(input.attachmentIds) : null, decidedBy: actor.id, decidedAt: now });
    await tx.update(workOrders).set({ status: next, operatorAcceptedAt: input.decision === "ACCEPT" ? now : null, updatedAt: now, updatedBy: actor.id }).where(eq(workOrders.id, id)); await tx.update(maintenanceNotifications).set({ status: nnext, operatorAcceptedBy: input.decision === "ACCEPT" ? actor.id : null, operatorAcceptedAt: input.decision === "ACCEPT" ? now : null, operatorRejectionReason: input.decision === "REJECT" ? input.reason : null, updatedAt: now, updatedBy: actor.id }).where(eq(maintenanceNotifications.id, notification.id));
    await tx.insert(workOrderEvents).values(orderEvent(id, `OPERATOR_${input.decision}ED_WORK`, actor, now, order.status, next, input.decision === "REJECT" ? input.reason : input.comment)); await tx.insert(notificationEvents).values(notificationEvent(notification.id, `OPERATOR_${input.decision}ED_WORK`, actor, now, notification.status, nnext, input.decision === "REJECT" ? input.reason : input.comment)); await tx.insert(auditLogs).values(audit(actor, meta, order.organizationId, `OPERATOR_WORK_${input.decision}ED`, "WORK_ORDER", id, order.code, { status: order.status }, { status: next }, now)); return { id, status: next, notificationStatus: nnext };
  });
}

export async function returnOperatorRejection(id: string, input: ManagerDecisionInput, actor: Actor, meta: RequestMeta) {
  if (input.decision !== "RETURN") throw new HttpError(400, "Operator rejection must be returned for recheck", "INVALID_DECISION"); const now = new Date(); return db.transaction(async (tx) => { const order = await orderForMutation(tx, id, actor, "WORK_ORDER_RETURN_FOR_RECHECK"); if (!order.notificationId) throw new HttpError(409, "Linked notification required", "NOTIFICATION_REQUIRED"); const next = transitionWorkOrder(order.status, "RETURN_OPERATOR_REJECTION", { actor, note: input.comment }); const notification = await notificationForMutation(tx, order.notificationId, actor, "WORK_ORDER_RETURN_FOR_RECHECK"); const nnext = transitionNotification(notification.status, "RETURN_TO_MAINTENANCE", { actor, note: input.comment }); const latest = (await tx.select({ cycleNumber: workOrderRechecks.cycleNumber }).from(workOrderRechecks).where(eq(workOrderRechecks.workOrderId, id)).orderBy(desc(workOrderRechecks.cycleNumber)).limit(1))[0]; const technicianId = input.technicianId || order.assignedTo; await tx.insert(workOrderRechecks).values({ id: randomUUID(), workOrderId: id, cycleNumber: (latest?.cycleNumber ?? 0) + 1, requestedByUserId: actor.id, requestedByRole: "OPERATOR", returnReason: input.comment, requiredActions: json(input.requiredActions), assignedTechnicianId: technicianId, returnedAt: now, dueAt: dateOrNull(input.dueAt), status: "OPEN" }); await tx.update(workOrders).set({ status: next, assignedTo: technicianId, dueAt: dateOrNull(input.dueAt) ?? order.dueAt, updatedAt: now, updatedBy: actor.id }).where(eq(workOrders.id, id)); await tx.update(maintenanceNotifications).set({ status: nnext, updatedAt: now, updatedBy: actor.id }).where(eq(maintenanceNotifications.id, notification.id)); await tx.insert(workOrderEvents).values(orderEvent(id, "OPERATOR_REJECTION_RETURNED", actor, now, order.status, next, input.comment)); await tx.insert(notificationEvents).values(notificationEvent(notification.id, "OPERATOR_REJECTION_RETURNED", actor, now, notification.status, nnext, input.comment)); await tx.insert(auditLogs).values(audit(actor, meta, order.organizationId, "OPERATOR_REJECTION_RETURNED", "WORK_ORDER", id, order.code, { status: order.status }, { status: next }, now)); return { id, status: next }; });
}

export async function closeGovernedWorkOrder(id: string, comment: string, actor: Actor, meta: RequestMeta) {
  const now = new Date(); return db.transaction(async (tx) => { const order = await orderForMutation(tx, id, actor, "WORK_ORDER_CLOSE"); const open = await tx.select({ id: workOrderRechecks.id }).from(workOrderRechecks).where(and(eq(workOrderRechecks.workOrderId, id), inArray(workOrderRechecks.status, ["OPEN", "IN_PROGRESS", "RESUBMITTED", "RETURNED_AGAIN"]))).limit(1); const next = transitionWorkOrder(order.status, "CLOSE", { actor, note: comment, operatorAcceptanceExists: Boolean(order.operatorAcceptedAt), openRecheckExists: open.length > 0 }); await tx.update(workOrders).set({ status: next, closedAt: now, updatedAt: now, updatedBy: actor.id }).where(eq(workOrders.id, id)); await tx.insert(workOrderEvents).values(orderEvent(id, "WORK_ORDER_CLOSED", actor, now, order.status, next, comment)); if (order.notificationId) { const notification = (await tx.select().from(maintenanceNotifications).where(eq(maintenanceNotifications.id, order.notificationId)).limit(1))[0]; const otherOpen = await tx.select({ id: workOrders.id }).from(workOrders).where(and(eq(workOrders.notificationId, order.notificationId), ne(workOrders.id, id), ne(workOrders.status, "CLOSED"))).limit(1); if (notification?.status === "OPERATOR_ACCEPTED" && otherOpen.length === 0) { const nnext = transitionNotification(notification.status, "WORK_ORDERS_CLOSED", { actor, allWorkOrdersClosed: true }); await tx.update(maintenanceNotifications).set({ status: nnext, updatedAt: now, updatedBy: actor.id }).where(eq(maintenanceNotifications.id, notification.id)); await tx.insert(notificationEvents).values(notificationEvent(notification.id, "NOTIFICATION_READY_TO_CLOSE", actor, now, notification.status, nnext)); } } await tx.insert(auditLogs).values(audit(actor, meta, order.organizationId, "WORK_ORDER_CLOSED", "WORK_ORDER", id, order.code, { status: order.status }, { status: next }, now)); return { id, status: next }; });
}

export async function closeGovernedNotification(id: string, input: z.infer<typeof notificationCloseSchema>, actor: Actor, meta: RequestMeta) {
  const now = new Date(); return db.transaction(async (tx) => { const notification = await notificationForMutation(tx, id, actor, "NOTIFICATION_CLOSE"); requireOwnerOrScope(actor, notification.requestedBy, notification, "NOTIFICATION_CLOSE"); const openOrders = await tx.select({ id: workOrders.id }).from(workOrders).where(and(eq(workOrders.notificationId, id), ne(workOrders.status, "CLOSED"))).limit(1); const openRechecks = await tx.select({ id: workOrderRechecks.id }).from(workOrderRechecks).innerJoin(workOrders, eq(workOrderRechecks.workOrderId, workOrders.id)).where(and(eq(workOrders.notificationId, id), inArray(workOrderRechecks.status, ["OPEN", "IN_PROGRESS", "RESUBMITTED", "RETURNED_AGAIN"]))).limit(1); const next = transitionNotification(notification.status, "CLOSE", { actor, note: input.comment, allWorkOrdersClosed: openOrders.length === 0, openRecheckExists: openRechecks.length > 0 }); await tx.update(maintenanceNotifications).set({ status: next, closedBy: actor.id, closedAt: now, completedAt: now, updatedAt: now, updatedBy: actor.id }).where(eq(maintenanceNotifications.id, id)); await tx.insert(notificationEvents).values(notificationEvent(id, "NOTIFICATION_CLOSED", actor, now, notification.status, next, input.comment)); await tx.insert(auditLogs).values(audit(actor, meta, notification.organizationId, "NOTIFICATION_CLOSED", "MAINTENANCE_NOTIFICATION", id, notification.code, { status: notification.status }, { status: next }, now)); return { id, status: next }; });
}

export async function getGovernedTimeline(entityType: "NOTIFICATION" | "WORK_ORDER", id: string, actor: Actor) {
  requireActorPermission(actor, "AUDIT_VIEW");
  if (entityType === "NOTIFICATION") { const row = (await db.select().from(maintenanceNotifications).where(eq(maintenanceNotifications.id, id)).limit(1))[0]; if (!row) throw new HttpError(404, "Notification not found", "NOTIFICATION_NOT_FOUND"); requireScope(actor, row, "AUDIT_VIEW"); return db.select().from(notificationEvents).where(eq(notificationEvents.notificationId, id)).orderBy(asc(notificationEvents.createdAt)); }
  const row = (await db.select().from(workOrders).where(eq(workOrders.id, id)).limit(1))[0]; if (!row) throw new HttpError(404, "Work order not found", "WORK_ORDER_NOT_FOUND"); requireScope(actor, row, "AUDIT_VIEW"); return db.select().from(workOrderEvents).where(eq(workOrderEvents.workOrderId, id)).orderBy(asc(workOrderEvents.createdAt));
}

export async function listGovernedQueue(actor: Actor) {
  requireActorPermission(actor, "VIEW_MAINTENANCE");
  const [notificationRows, orderRows, technicianRows, assetRows] = await Promise.all([
    db.select().from(maintenanceNotifications).orderBy(desc(maintenanceNotifications.updatedAt)),
    db.select().from(workOrders).orderBy(desc(workOrders.updatedAt)),
    prisma.user.findMany({ where: { status: "ACTIVE", roles: { some: { role: { code: "TECHNICIAN", active: true } } } }, select: { id: true, fullName: true }, orderBy: { fullName: "asc" } }),
    db.select({ id: assets.id, code: assets.code, name: assets.name, location: assets.location }).from(assets).where(eq(assets.status, "ACTIVE")).orderBy(asc(assets.code)),
  ]);
  const notifications = notificationRows.filter((row) => canAccessScope(actor, row) || row.requestedBy === actor.id);
  const workOrderRows = orderRows.filter((row) => canAccessScope(actor, row) && (actor.role !== "TECHNICIAN" || row.assignedTo === actor.id));
  return { notifications, workOrders: workOrderRows, technicians: actor.permissions.includes("WORK_ORDER_ASSIGN") ? technicianRows : [], assets: assetRows, generatedAt: new Date() };
}
