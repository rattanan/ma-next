import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { workOrders, workOrderEvents, workOrderRechecks } from "@/lib/db/schema";
import { maintenanceProjects as projects, maintenanceProjectTasks as tasks, projectTaskDependencies as dependencies, pmOccurrences as occurrences, preventivePrograms as programs, planningEvents as events } from "@/lib/db/planning-schema";
import type { AuthenticatedUser } from "@/lib/auth/session";
import { HttpError } from "@/lib/http";
import { recomputeProject, type Tx } from "./service";
import { taskStatusFromWorkOrder } from "./domain";
import { enqueuePlanningNotification } from "./outbox";
import { transitionWorkOrder } from "../maintenance/workflow";
import { requireResponsibleCapability } from "./responsible-user";

export async function lockPlanningSource(tx: Tx, workOrderId: string) {
  // Read identity first, then acquire locks in source -> WO order everywhere.
  const [order] = await tx.select({ sourceType: workOrders.sourceType, sourceRecordId: workOrders.sourceRecordId }).from(workOrders).where(eq(workOrders.id, workOrderId));
  if (order?.sourceType === "SHUTDOWN_TASK" && order.sourceRecordId) {
    const [task] = await tx.select().from(tasks).where(and(eq(tasks.id, order.sourceRecordId), eq(tasks.workOrderId, workOrderId)));
    if (!task) throw new HttpError(409, "Shutdown source link requires reconciliation", "INVALID_SOURCE_LINK");
    await tx.select({ id: projects.id }).from(projects).where(eq(projects.id, task.projectId)).for("update");
    await tx.select({ id: tasks.id }).from(tasks).where(eq(tasks.id, task.id)).for("update");
  }
  if (order?.sourceType === "PREVENTIVE_EVENT" && order.sourceRecordId) {
    const [occurrence] = await tx.select().from(occurrences).where(and(eq(occurrences.id, order.sourceRecordId), eq(occurrences.workOrderId, workOrderId)));
    if (!occurrence) throw new HttpError(409, "PM source link requires reconciliation", "INVALID_SOURCE_LINK");
    await tx.select({ id: programs.id }).from(programs).where(eq(programs.id, occurrence.programId)).for("update");
  }
}

export async function assertPlanningCanStart(tx: Tx, order: typeof workOrders.$inferSelect) {
  if (order.sourceType !== "SHUTDOWN_TASK") return;
  const [task] = await tx.select().from(tasks).where(eq(tasks.workOrderId, order.id));
  if (!task) throw new HttpError(409, "Missing shutdown task");
  const [project] = await tx.select().from(projects).where(eq(projects.id, task.projectId));
  if (!["PLANNED", "IN_PROGRESS"].includes(project.status)) throw new HttpError(409, "Project is not open for execution");
  const predecessors = await tx.select({ status: tasks.status }).from(dependencies).innerJoin(tasks, eq(dependencies.predecessorId, tasks.id)).where(eq(dependencies.successorId, task.id));
  if (predecessors.some(p => p.status !== "COMPLETED")) throw new HttpError(409, "Complete predecessor tasks before starting this work order", "DEPENDENCY_BLOCKED");
}

export async function syncPlanningSource(tx: Tx, id: string, actor: AuthenticatedUser) {
  const [order] = await tx.select().from(workOrders).where(eq(workOrders.id, id));
  if (order.sourceType === "SHUTDOWN_TASK") {
    const [task] = await tx.select().from(tasks).where(and(eq(tasks.id, order.sourceRecordId!), eq(tasks.workOrderId, id)));
    if (!task) throw new HttpError(409, "Missing shutdown source link");
    const status = taskStatusFromWorkOrder[order.status];
    if (task.status === status) return;
    await tx.update(tasks).set({ status, actualFinishAt: order.status === "CLOSED" ? order.closedAt : null, version: task.version + 1, updatedAt: new Date() }).where(eq(tasks.id, task.id));
    await recomputeProject(tx, task.projectId);
    if (order.status === "CLOSED") {
      const [p] = await tx.select().from(projects).where(eq(projects.id, task.projectId));
      await enqueuePlanningNotification(tx, `TASK_CLOSED:${id}`, p.ownerId, actor.id, `${order.code} closed`, `${task.name}: ${p.status}`, `/projects/${p.id}`);
    }
    await tx.insert(events).values({ id: randomUUID(), organizationId: task.organizationId, entityType: "PROJECT", entityId: task.projectId, eventType: "WORK_ORDER_SYNCHRONIZED", actorId: actor.id, note: `${order.code}: ${task.status} → ${status}`, createdAt: new Date() });
  } else if (order.sourceType === "PREVENTIVE_EVENT" && order.status === "CLOSED") {
    await tx.update(occurrences).set({ status: "COMPLETED", completedAt: order.closedAt }).where(and(eq(occurrences.id, order.sourceRecordId!), eq(occurrences.workOrderId, id)));
  }
}

export async function sourceOperatorDecision(tx: Tx, order: typeof workOrders.$inferSelect, actor: AuthenticatedUser, accepted: boolean, note: string) {
  let operatorId: string | undefined;
  if (order.sourceType === "SHUTDOWN_TASK") {
    const [source] = await tx.select({ operatorId: projects.operatorId }).from(tasks).innerJoin(projects, eq(projects.id, tasks.projectId)).where(eq(tasks.workOrderId, order.id)); operatorId = source?.operatorId;
  } else if (order.sourceType === "PREVENTIVE_EVENT") {
    const [source] = await tx.select({ operatorId: programs.operatorId }).from(occurrences).innerJoin(programs, eq(programs.id, occurrences.programId)).where(eq(occurrences.workOrderId, order.id)); operatorId = source?.operatorId;
  }
  if (operatorId !== actor.id) throw new HttpError(403, "Only the source's designated operator may accept or reject this work");
  await requireResponsibleCapability(actor.id, order, accepted ? "NOTIFICATION_ACCEPT_WORK" : "NOTIFICATION_REJECT_WORK");
  if (order.status !== "WAITING_FOR_OPERATOR_ACCEPTANCE") throw new HttpError(409, "Work is not awaiting operator acceptance");
  const status = transitionWorkOrder(order.status, accepted ? "OPERATOR_ACCEPT" : "OPERATOR_REJECT", { actor, note });
  const now = new Date();
  await tx.update(workOrders).set({ status, operatorAcceptedAt: accepted ? now : null, updatedAt: now, updatedBy: actor.id }).where(eq(workOrders.id, order.id));
  await tx.insert(workOrderEvents).values({ id: randomUUID(), workOrderId: order.id, eventType: accepted ? "SOURCE_OPERATOR_ACCEPTED" : "SOURCE_OPERATOR_RETURNED", fromStatus: order.status, toStatus: status, note, actorUserId: actor.id, createdAt: now });
  await syncPlanningSource(tx, order.id, actor); return { id: order.id, status };
}

export async function returnPlanningOperatorRejection(tx: Tx, order: typeof workOrders.$inferSelect, actor: AuthenticatedUser, note: string) {
  if (!["SHUTDOWN_TASK", "PREVENTIVE_EVENT"].includes(order.sourceType)) throw new HttpError(409, "Linked source required");
  const status = transitionWorkOrder(order.status, "RETURN_OPERATOR_REJECTION", { actor, note });
  const previous = await tx.select({ cycle: workOrderRechecks.cycleNumber }).from(workOrderRechecks).where(eq(workOrderRechecks.workOrderId, order.id));
  const now = new Date();
  await tx.insert(workOrderRechecks).values({ id: randomUUID(), workOrderId: order.id, cycleNumber: Math.max(0, ...previous.map(r => r.cycle)) + 1, requestedByUserId: actor.id, requestedByRole: actor.role, returnReason: note, requiredActions: JSON.stringify([note]), assignedTechnicianId: order.assignedTo, returnedAt: now, status: "OPEN" });
  await tx.update(workOrders).set({ status, updatedBy: actor.id, updatedAt: now }).where(eq(workOrders.id, order.id));
  await tx.insert(workOrderEvents).values({ id: randomUUID(), workOrderId: order.id, eventType: "SOURCE_OPERATOR_REJECTION_RETURNED", fromStatus: order.status, toStatus: status, note, actorUserId: actor.id, createdAt: now });
  await syncPlanningSource(tx, order.id, actor);
  return { id: order.id, status };
}
