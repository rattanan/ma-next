import type { Permission } from "../auth/permissions";
import type { NotificationDecision, NotificationStatus, VerificationDecision, WorkOrderStatus, WorkTaskStatus } from "../db/schema";
import { HttpError } from "../http";

export class WorkflowError extends HttpError {
  constructor(message: string, code = "INVALID_TRANSITION") {
    super(code === "WORKFLOW_FORBIDDEN" ? 403 : 409, message, code);
  }
}

export type NotificationAction = "APPROVE" | "BACKLOG" | "REJECT";
export type WorkOrderAction = "START" | "BACKLOG" | "RESUME" | "SUBMIT_COMPLETION" | "VERIFY" | "RETURN" | "CLOSE";

type WorkflowActor = { id: string; permissions: readonly Permission[] };
type TransitionContext = {
  actor: WorkflowActor;
  assignedTo?: string | null;
  supervisorId?: string | null;
  note?: string | null;
  backlogReason?: string | null;
  requiredTasks?: ReadonlyArray<{ required: boolean; status: WorkTaskStatus }>;
  completionExists?: boolean;
  completionOwnerId?: string | null;
};

export function initializeNotification(actor: WorkflowActor, data: { assetId?: string | null; title?: string | null; description?: string | null }): NotificationStatus {
  requirePermission(actor, "CREATE_MAINTENANCE_NOTIFICATION");
  if (!data.assetId || !data.title?.trim() || !data.description?.trim()) throw new WorkflowError("Asset, subject, and description are required", "MANDATORY_DATA_MISSING");
  return "NEW";
}

export function convertNotificationToWorkOrder(current: NotificationStatus, actor: WorkflowActor, data: { assignedTo?: string | null; backlogReason?: string | null }): WorkOrderStatus {
  requirePermission(actor, "MANAGE_WORK_ORDERS");
  if (current !== "APPROVED" && current !== "BACKLOG") throw new WorkflowError(`Cannot convert a ${current.toLowerCase()} notification`);
  if (!data.assignedTo) throw new WorkflowError("An assigned technician is required before conversion", "MANDATORY_DATA_MISSING");
  if (current === "BACKLOG") requireNote(data.backlogReason, "backlog reason");
  return current === "BACKLOG" ? "BACKLOG" : "OPEN";
}

const notificationTransitions: Record<NotificationStatus, Partial<Record<NotificationAction, NotificationStatus>>> = {
  NEW: { APPROVE: "APPROVED", BACKLOG: "BACKLOG", REJECT: "REJECTED" },
  APPROVED: {}, BACKLOG: {}, REJECTED: {}, COMPLETED: {},
};

const workOrderTransitions: Record<WorkOrderStatus, Partial<Record<WorkOrderAction, WorkOrderStatus>>> = {
  OPEN: { START: "IN_PROGRESS", BACKLOG: "BACKLOG" },
  BACKLOG: { START: "IN_PROGRESS", RESUME: "OPEN" },
  IN_PROGRESS: { BACKLOG: "BACKLOG", SUBMIT_COMPLETION: "COMPLETION_PENDING" },
  COMPLETION_PENDING: { VERIFY: "VERIFIED", RETURN: "IN_PROGRESS" },
  VERIFIED: { CLOSE: "CLOSED" },
  CLOSED: {},
};

const workOrderPermissions: Record<WorkOrderAction, Permission> = {
  START: "EXECUTE_WORK_ORDERS",
  BACKLOG: "EXECUTE_WORK_ORDERS",
  RESUME: "EXECUTE_WORK_ORDERS",
  SUBMIT_COMPLETION: "EXECUTE_WORK_ORDERS",
  VERIFY: "VERIFY_WORK_ORDERS",
  RETURN: "VERIFY_WORK_ORDERS",
  CLOSE: "CLOSE_WORK_ORDERS",
};

function requirePermission(actor: WorkflowActor, permission: Permission) {
  if (!actor.permissions.includes(permission)) throw new WorkflowError(`Missing permission: ${permission}`, "WORKFLOW_FORBIDDEN");
}

function requireNote(note?: string | null, field = "note") {
  if (!note?.trim()) throw new WorkflowError(`${field} is required`, "MANDATORY_DATA_MISSING");
}

export function transitionNotification(current: NotificationStatus, action: NotificationAction, context: TransitionContext): NotificationStatus {
  requirePermission(context.actor, "REVIEW_MAINTENANCE_NOTIFICATION");
  const next = notificationTransitions[current][action];
  if (!next) throw new WorkflowError(`Cannot ${action.toLowerCase()} a ${current.toLowerCase()} notification`);
  requireNote(context.note, action === "REJECT" ? "rejection reason" : "review note");
  if (action === "APPROVE" && !context.assignedTo) throw new WorkflowError("An assigned technician is required before approval", "MANDATORY_DATA_MISSING");
  if (action === "BACKLOG") {
    if (!context.assignedTo) throw new WorkflowError("An assigned technician is required for backlog work", "MANDATORY_DATA_MISSING");
    requireNote(context.backlogReason, "backlog reason");
  }
  return next;
}

export function transitionWorkOrder(current: WorkOrderStatus, action: WorkOrderAction, context?: TransitionContext): WorkOrderStatus {
  const next = workOrderTransitions[current][action];
  if (!next) throw new WorkflowError(`Cannot ${action.toLowerCase().replaceAll("_", " ")} a ${current.toLowerCase().replaceAll("_", " ")} work order`);
  if (!context) return next; // Pure state-table compatibility for callers that do not execute a command.
  requirePermission(context.actor, workOrderPermissions[action]);
  if (action === "START" && !context.assignedTo) throw new WorkflowError("An assigned technician is required before work starts", "MANDATORY_DATA_MISSING");
  if (action === "BACKLOG") requireNote(context.backlogReason, "backlog reason");
  if (action === "RESUME") requireNote(context.note, "resolution note");
  if (action === "SUBMIT_COMPLETION") {
    if (!completionReady(context.requiredTasks ?? [])) throw new WorkflowError("Complete every required task before submitting completion", "REQUIRED_TASKS_INCOMPLETE");
  }
  if (action === "VERIFY" || action === "RETURN") {
    if (!context.completionExists) throw new WorkflowError("A valid completion record is required", "COMPLETION_NOT_FOUND");
    requireNote(context.note, "verification note");
    if (context.completionOwnerId === context.actor.id) throw new WorkflowError("The technician who completed the work cannot verify it", "SEGREGATION_OF_DUTIES");
  }
  if (action === "CLOSE") requireNote(context.note, "closure note");
  return next;
}

export function reviewNotification(current: NotificationStatus, decision: NotificationDecision): NotificationStatus {
  if (current !== "NEW") throw new WorkflowError("Only new notifications can be reviewed");
  return decision;
}

export function completionReady(tasks: ReadonlyArray<{ required: boolean; status: WorkTaskStatus }>) {
  return tasks.every((task) => !task.required || task.status === "COMPLETED");
}

export function transitionTask(current: WorkTaskStatus, next: WorkTaskStatus, actor: WorkflowActor) {
  requirePermission(actor, "EXECUTE_WORK_ORDERS");
  const allowed: Record<WorkTaskStatus, readonly WorkTaskStatus[]> = { OPEN: ["IN_PROGRESS", "BACKLOG", "COMPLETED"], IN_PROGRESS: ["OPEN", "BACKLOG", "COMPLETED"], BACKLOG: ["OPEN", "IN_PROGRESS"], COMPLETED: ["OPEN"] };
  if (!allowed[current].includes(next)) throw new WorkflowError(`Cannot move a ${current.toLowerCase()} task to ${next.toLowerCase()}`);
  return next;
}

export function completeNotification(current: NotificationStatus, actor: WorkflowActor): NotificationStatus {
  requirePermission(actor, "CLOSE_WORK_ORDERS");
  if (current !== "APPROVED" && current !== "BACKLOG") throw new WorkflowError(`Cannot complete a ${current.toLowerCase()} notification`);
  return "COMPLETED";
}

export function verificationAction(decision: VerificationDecision): WorkOrderAction {
  return decision === "VERIFIED" ? "VERIFY" : "RETURN";
}
