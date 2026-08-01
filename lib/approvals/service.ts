import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { z } from "zod";
import type { AuthenticatedUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { approvalHistory, approvalTasks, assets, attachments, auditLogs, maintenanceNotifications, notificationEvents, users } from "@/lib/db/schema";
import { HttpError } from "@/lib/http";
import { canAccessScope } from "@/lib/maintenance/authorization";
import type { approvalQuerySchema } from "./validation";

type ApprovalQuery = z.infer<typeof approvalQuerySchema>;
const activeStatuses = ["PENDING", "IN_REVIEW"] as const;

function canAccessTask(actor: AuthenticatedUser, task: typeof approvalTasks.$inferSelect) {
  const assigned = task.assignedApproverId === actor.id || Boolean(task.assignedRole && (actor.role === task.assignedRole || actor.roleCodes?.includes(task.assignedRole)));
  return (actor.role === "ADMIN" || assigned) && (actor.role === "ADMIN" || canAccessScope(actor, task, "NOTIFICATION_REVIEW"));
}

export async function pendingApprovalCount(actor: AuthenticatedUser) {
  if (!actor.permissions.includes("NOTIFICATION_REVIEW")) return 0;
  const rows = await db.select().from(approvalTasks).where(inArray(approvalTasks.status, activeStatuses));
  return rows.filter((task) => canAccessTask(actor, task)).length;
}

export async function listApprovals(query: ApprovalQuery, actor: AuthenticatedUser) {
  if (!actor.permissions.includes("NOTIFICATION_REVIEW")) throw new HttpError(403, "Approval Center permission is required", "FORBIDDEN");
  const rows = await db.select().from(approvalTasks).orderBy(query.sort === "newest" ? desc(approvalTasks.requestedAt) : asc(approvalTasks.requestedAt));
  const requesterIds = [...new Set(rows.map((row) => row.requestedById))];
  const requesters = requesterIds.length ? await db.select({ id: users.id, fullName: users.fullName }).from(users).where(inArray(users.id, requesterIds)) : [];
  const requesterMap = new Map(requesters.map((user) => [user.id, user.fullName]));
  const tabStatus: Record<ApprovalQuery["tab"], readonly string[]> = { pending: ["PENDING"], "in-review": ["IN_REVIEW"], returned: ["RETURNED"], approved: ["APPROVED"], rejected: ["REJECTED"], all: [] };
  const accessible = rows.filter((task) => canAccessTask(actor, task));
  const filtered = accessible.filter((task) => {
    if (tabStatus[query.tab].length && !tabStatus[query.tab].includes(task.status)) return false;
    if (query.type && task.approvalType !== query.type) return false;
    if (query.priority && task.priority !== query.priority) return false;
    if (query.status && task.status !== query.status) return false;
    if (query.site && task.siteId !== query.site) return false;
    if (query.requestedBy && task.requestedById !== query.requestedBy) return false;
    if (query.from && task.requestedAt < new Date(query.from)) return false;
    if (query.to && task.requestedAt > new Date(query.to)) return false;
    const haystack = `${task.referenceNumber} ${task.title} ${requesterMap.get(task.requestedById) ?? ""}`.toLowerCase();
    return !query.search || haystack.includes(query.search.toLowerCase());
  });
  const start = (query.page - 1) * query.pageSize;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return { items: filtered.slice(start, start + query.pageSize).map((task) => ({ ...task, requestedByName: requesterMap.get(task.requestedById) ?? "Unknown user", waitingMinutes: Math.max(0, Math.floor((Date.now() - task.requestedAt.getTime()) / 60000)) })), total: filtered.length, page: query.page, pageSize: query.pageSize, pages: Math.max(1, Math.ceil(filtered.length / query.pageSize)), stats: { pending: accessible.filter((task) => task.status === "PENDING").length, inReview: accessible.filter((task) => task.status === "IN_REVIEW").length, overdue: accessible.filter((task) => activeStatuses.includes(task.status as (typeof activeStatuses)[number]) && Date.now() - task.requestedAt.getTime() >= 86_400_000).length, approvedToday: accessible.filter((task) => task.status === "APPROVED" && task.completedAt && task.completedAt >= today).length } };
}

export async function getApprovalDetail(id: string, actor: AuthenticatedUser) {
  if (!actor.permissions.includes("NOTIFICATION_REVIEW")) throw new HttpError(403, "Approval Center permission is required", "FORBIDDEN");
  const task = (await db.select().from(approvalTasks).where(eq(approvalTasks.id, id)).limit(1))[0];
  if (!task) throw new HttpError(404, "Approval task not found", "APPROVAL_NOT_FOUND");
  if (!canAccessTask(actor, task)) throw new HttpError(403, "Approval task is outside your assignment or scope", "SCOPE_FORBIDDEN");
  const notification = task.approvalType === "NOTIFICATION" ? (await db.select().from(maintenanceNotifications).where(eq(maintenanceNotifications.id, task.referenceId)).limit(1))[0] : null;
  const asset = notification ? (await db.select({ id: assets.id, code: assets.code, name: assets.name, location: assets.location, criticality: assets.criticality, status: assets.status }).from(assets).where(eq(assets.id, notification.assetId)).limit(1))[0] : null;
  const history = await db.select().from(approvalHistory).where(eq(approvalHistory.approvalTaskId, id)).orderBy(asc(approvalHistory.createdAt));
  const eventRows = notification ? await db.select().from(notificationEvents).where(eq(notificationEvents.notificationId, notification.id)).orderBy(asc(notificationEvents.createdAt)) : [];
  const actorIds = [...new Set([...history.map((item) => item.actionById), ...eventRows.map((item) => item.actorUserId), task.requestedById, ...(task.decisionById ? [task.decisionById] : [])])];
  const people = actorIds.length ? await db.select({ id: users.id, fullName: users.fullName }).from(users).where(inArray(users.id, actorIds)) : [];
  const peopleMap = new Map(people.map((person) => [person.id, person.fullName]));
  const files = notification ? await db.select({ id: attachments.id, originalName: attachments.originalName, contentType: attachments.contentType, byteSize: attachments.byteSize, createdAt: attachments.createdAt }).from(attachments).where(and(eq(attachments.entityType, "MAINTENANCE_NOTIFICATION"), eq(attachments.entityId, notification.id))) : [];
  const audit = await db.select().from(auditLogs).where(and(eq(auditLogs.targetType, "MAINTENANCE_NOTIFICATION"), eq(auditLogs.targetId, task.referenceId))).orderBy(asc(auditLogs.createdAt));
  return { task: { ...task, requestedByName: peopleMap.get(task.requestedById) ?? "Unknown user", decisionByName: task.decisionById ? peopleMap.get(task.decisionById) : null }, notification, asset, attachments: files, history: history.map((item) => ({ ...item, actionByName: peopleMap.get(item.actionById) ?? "Unknown user" })), timeline: eventRows.map((item) => ({ ...item, actorName: peopleMap.get(item.actorUserId) ?? "Unknown user" })), audit };
}

export async function getApprovalTask(id: string, actor: AuthenticatedUser) {
  const detail = await getApprovalDetail(id, actor);
  if (!activeStatuses.includes(detail.task.status as (typeof activeStatuses)[number])) throw new HttpError(409, "Approval task is already completed", "APPROVAL_ALREADY_COMPLETED");
  return detail.task;
}
