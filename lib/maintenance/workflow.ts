import type { Permission } from "../auth/permissions";
import type { NotificationDecision, NotificationStatus, VerificationDecision, WorkOrderStatus, WorkTaskStatus } from "../db/schema";
import { HttpError } from "../http";

export class WorkflowError extends HttpError {
  constructor(message: string, code = "INVALID_TRANSITION") { super(code === "WORKFLOW_FORBIDDEN" ? 403 : 409, message, code); }
}

export type NotificationAction = "SUBMIT" | "START_REVIEW" | "REQUEST_INFORMATION" | "PROVIDE_INFORMATION" | "APPROVE" | "BACKLOG" | "REJECT" | "START_MAINTENANCE" | "REQUEST_OPERATOR_ACCEPTANCE" | "OPERATOR_ACCEPT" | "OPERATOR_REJECT" | "WORK_ORDERS_CLOSED" | "RETURN_TO_MAINTENANCE" | "CLOSE" | "CANCEL";
export type WorkOrderAction = "ASSIGN" | "ACCEPT_ASSIGNMENT" | "START" | "WAIT_FOR_PARTS" | "WAIT_FOR_VENDOR" | "WAIT_FOR_ACCESS" | "HOLD" | "BACKLOG" | "RESUME" | "SUBMIT_COMPLETION" | "BEGIN_MANAGER_REVIEW" | "VERIFY" | "APPROVE_COMPLETION" | "RETURN" | "RETURN_FOR_RECHECK" | "REQUEST_OPERATOR_ACCEPTANCE" | "OPERATOR_ACCEPT" | "OPERATOR_REJECT" | "RETURN_OPERATOR_REJECTION" | "CLOSE" | "CANCEL";

type WorkflowActor = { id: string; permissions: readonly Permission[] };
type TransitionContext = {
  actor: WorkflowActor;
  assignedTo?: string | null;
  note?: string | null;
  backlogReason?: string | null;
  requiredTasks?: ReadonlyArray<{ required: boolean; status: WorkTaskStatus }>;
  completionExists?: boolean;
  completionOwnerId?: string | null;
  operatorAcceptanceExists?: boolean;
  allWorkOrdersClosed?: boolean;
  openRecheckExists?: boolean;
};

const notificationTransitions: Record<NotificationStatus, Partial<Record<NotificationAction, NotificationStatus>>> = {
  NEW: { START_REVIEW: "UNDER_REVIEW" },
  BACKLOG: { START_MAINTENANCE: "IN_MAINTENANCE" },
  COMPLETED: { WORK_ORDERS_CLOSED: "READY_TO_CLOSE" },
  DRAFT: { SUBMIT: "SUBMITTED", CANCEL: "CANCELLED" },
  SUBMITTED: { START_REVIEW: "UNDER_REVIEW" },
  UNDER_REVIEW: { REQUEST_INFORMATION: "NEEDS_INFORMATION", APPROVE: "APPROVED", BACKLOG: "APPROVED", REJECT: "REJECTED", CANCEL: "CANCELLED" },
  NEEDS_INFORMATION: { PROVIDE_INFORMATION: "SUBMITTED", CANCEL: "CANCELLED" },
  REJECTED: {}, APPROVED: { START_MAINTENANCE: "IN_MAINTENANCE" },
  IN_MAINTENANCE: { REQUEST_OPERATOR_ACCEPTANCE: "WAITING_FOR_OPERATOR_ACCEPTANCE" },
  WAITING_FOR_OPERATOR_ACCEPTANCE: { OPERATOR_ACCEPT: "OPERATOR_ACCEPTED", OPERATOR_REJECT: "OPERATOR_REJECTED" },
  OPERATOR_REJECTED: { RETURN_TO_MAINTENANCE: "IN_MAINTENANCE" },
  OPERATOR_ACCEPTED: { WORK_ORDERS_CLOSED: "READY_TO_CLOSE" },
  READY_TO_CLOSE: { CLOSE: "CLOSED" }, CLOSED: {}, CANCELLED: {},
};

const workOrderTransitions: Record<WorkOrderStatus, Partial<Record<WorkOrderAction, WorkOrderStatus>>> = {
  OPEN: { ASSIGN: "ASSIGNED", START: "IN_PROGRESS", BACKLOG: "WAITING_FOR_PARTS", CANCEL: "CANCELLED" },
  BACKLOG: { RESUME: "IN_PROGRESS", START: "IN_PROGRESS", CANCEL: "CANCELLED" },
  COMPLETION_PENDING: { BEGIN_MANAGER_REVIEW: "UNDER_MANAGER_REVIEW", VERIFY: "MANAGER_APPROVED", RETURN: "RETURNED_TO_TECHNICIAN" },
  VERIFIED: { REQUEST_OPERATOR_ACCEPTANCE: "WAITING_FOR_OPERATOR_ACCEPTANCE" },
  CREATED: { ASSIGN: "ASSIGNED", CANCEL: "CANCELLED" },
  ASSIGNED: { ACCEPT_ASSIGNMENT: "TECHNICIAN_ACCEPTED", ASSIGN: "ASSIGNED", CANCEL: "CANCELLED" },
  TECHNICIAN_ACCEPTED: { START: "IN_PROGRESS" },
  IN_PROGRESS: { WAIT_FOR_PARTS: "WAITING_FOR_PARTS", WAIT_FOR_VENDOR: "WAITING_FOR_VENDOR", WAIT_FOR_ACCESS: "WAITING_FOR_ACCESS", HOLD: "ON_HOLD", BACKLOG: "WAITING_FOR_PARTS", SUBMIT_COMPLETION: "TECHNICIAN_COMPLETED" },
  WAITING_FOR_PARTS: { RESUME: "IN_PROGRESS", CANCEL: "CANCELLED" }, WAITING_FOR_VENDOR: { RESUME: "IN_PROGRESS", CANCEL: "CANCELLED" }, WAITING_FOR_ACCESS: { RESUME: "IN_PROGRESS", CANCEL: "CANCELLED" }, ON_HOLD: { RESUME: "IN_PROGRESS", CANCEL: "CANCELLED" },
  TECHNICIAN_COMPLETED: { BEGIN_MANAGER_REVIEW: "UNDER_MANAGER_REVIEW" },
  UNDER_MANAGER_REVIEW: { APPROVE_COMPLETION: "MANAGER_APPROVED", VERIFY: "MANAGER_APPROVED", RETURN_FOR_RECHECK: "RETURNED_TO_TECHNICIAN", RETURN: "RETURNED_TO_TECHNICIAN" },
  RETURNED_TO_TECHNICIAN: { START: "IN_PROGRESS" },
  MANAGER_APPROVED: { REQUEST_OPERATOR_ACCEPTANCE: "WAITING_FOR_OPERATOR_ACCEPTANCE" },
  WAITING_FOR_OPERATOR_ACCEPTANCE: { OPERATOR_ACCEPT: "OPERATOR_ACCEPTED", OPERATOR_REJECT: "OPERATOR_REJECTED" },
  OPERATOR_REJECTED: { RETURN_OPERATOR_REJECTION: "RETURNED_TO_TECHNICIAN" },
  OPERATOR_ACCEPTED: { CLOSE: "CLOSED" }, CLOSED: {}, CANCELLED: {},
};

const notificationPermission: Record<NotificationAction, Permission> = {
  SUBMIT: "NOTIFICATION_SUBMIT", START_REVIEW: "NOTIFICATION_REVIEW", REQUEST_INFORMATION: "NOTIFICATION_REQUEST_INFORMATION", PROVIDE_INFORMATION: "NOTIFICATION_SUBMIT", APPROVE: "NOTIFICATION_APPROVE", BACKLOG: "NOTIFICATION_APPROVE", REJECT: "NOTIFICATION_REJECT", START_MAINTENANCE: "WORK_ORDER_CREATE", REQUEST_OPERATOR_ACCEPTANCE: "WORK_ORDER_APPROVE_COMPLETION", OPERATOR_ACCEPT: "NOTIFICATION_ACCEPT_WORK", OPERATOR_REJECT: "NOTIFICATION_REJECT_WORK", WORK_ORDERS_CLOSED: "WORK_ORDER_CLOSE", RETURN_TO_MAINTENANCE: "WORK_ORDER_RETURN_FOR_RECHECK", CLOSE: "NOTIFICATION_CLOSE", CANCEL: "NOTIFICATION_REVIEW",
};
const workOrderPermission: Record<WorkOrderAction, Permission> = {
  ASSIGN: "WORK_ORDER_ASSIGN", ACCEPT_ASSIGNMENT: "WORK_ORDER_ACCEPT_ASSIGNMENT", START: "WORK_ORDER_START", WAIT_FOR_PARTS: "WORK_ORDER_UPDATE_PROGRESS", WAIT_FOR_VENDOR: "WORK_ORDER_UPDATE_PROGRESS", WAIT_FOR_ACCESS: "WORK_ORDER_UPDATE_PROGRESS", HOLD: "WORK_ORDER_UPDATE_PROGRESS", BACKLOG: "WORK_ORDER_UPDATE_PROGRESS", RESUME: "WORK_ORDER_UPDATE_PROGRESS", SUBMIT_COMPLETION: "WORK_ORDER_SUBMIT_COMPLETION", BEGIN_MANAGER_REVIEW: "WORK_ORDER_REVIEW_COMPLETION", VERIFY: "WORK_ORDER_APPROVE_COMPLETION", APPROVE_COMPLETION: "WORK_ORDER_APPROVE_COMPLETION", RETURN: "WORK_ORDER_RETURN_FOR_RECHECK", RETURN_FOR_RECHECK: "WORK_ORDER_RETURN_FOR_RECHECK", REQUEST_OPERATOR_ACCEPTANCE: "WORK_ORDER_APPROVE_COMPLETION", OPERATOR_ACCEPT: "NOTIFICATION_ACCEPT_WORK", OPERATOR_REJECT: "NOTIFICATION_REJECT_WORK", RETURN_OPERATOR_REJECTION: "WORK_ORDER_RETURN_FOR_RECHECK", CLOSE: "WORK_ORDER_CLOSE", CANCEL: "WORK_ORDER_ASSIGN",
};

function requirePermission(actor: WorkflowActor, permission: Permission) { if (!actor.permissions.includes(permission)) throw new WorkflowError(`Missing permission: ${permission}`, "WORKFLOW_FORBIDDEN"); }
function requireNote(note?: string | null, field = "reason") { if (!note?.trim()) throw new WorkflowError(`${field} is required`, "MANDATORY_DATA_MISSING"); }

export function initializeNotification(actor: WorkflowActor, data: { assetId?: string | null; title?: string | null; description?: string | null }): NotificationStatus {
  if (!actor.permissions.includes("NOTIFICATION_CREATE") && !actor.permissions.includes("CREATE_MAINTENANCE_NOTIFICATION")) requirePermission(actor, "NOTIFICATION_CREATE");
  if (!data.assetId || !data.title?.trim() || !data.description?.trim()) throw new WorkflowError("Asset, title, and problem description are required", "MANDATORY_DATA_MISSING");
  return "DRAFT";
}

export function transitionNotification(current: NotificationStatus, action: NotificationAction, context: TransitionContext): NotificationStatus {
  const next = notificationTransitions[current]?.[action];
  if (!next) throw new WorkflowError(`Cannot ${action.toLowerCase().replaceAll("_", " ")} a ${current.toLowerCase().replaceAll("_", " ")} notification`);
  requirePermission(context.actor, notificationPermission[action]);
  if (["REQUEST_INFORMATION", "REJECT", "OPERATOR_REJECT", "RETURN_TO_MAINTENANCE", "CLOSE", "CANCEL"].includes(action)) requireNote(context.note);
  if (action === "WORK_ORDERS_CLOSED" && !context.allWorkOrdersClosed) throw new WorkflowError("All linked work orders must be closed", "WORK_ORDERS_OPEN");
  if (action === "CLOSE" && !context.allWorkOrdersClosed) throw new WorkflowError("All linked work orders must be closed before the Notification can close", "CLOSURE_INCOMPLETE");
  if (action === "CLOSE" && context.openRecheckExists) throw new WorkflowError("Notification cannot close while a recheck remains active", "CLOSURE_INCOMPLETE");
  return next;
}

export function transitionWorkOrder(current: WorkOrderStatus, action: WorkOrderAction, context?: TransitionContext): WorkOrderStatus {
  const next = workOrderTransitions[current]?.[action];
  if (!next) throw new WorkflowError(`Cannot ${action.toLowerCase().replaceAll("_", " ")} a ${current.toLowerCase().replaceAll("_", " ")} work order`);
  if (!context) return next;
  requirePermission(context.actor, workOrderPermission[action]);
  if (["ACCEPT_ASSIGNMENT", "START", "WAIT_FOR_PARTS", "WAIT_FOR_VENDOR", "WAIT_FOR_ACCESS", "HOLD", "BACKLOG", "RESUME", "SUBMIT_COMPLETION"].includes(action) && context.assignedTo !== context.actor.id) throw new WorkflowError("Only the assigned technician may perform this action", "WORKFLOW_FORBIDDEN");
  if (["WAIT_FOR_PARTS", "WAIT_FOR_VENDOR", "WAIT_FOR_ACCESS", "HOLD", "BACKLOG", "RESUME", "RETURN", "RETURN_FOR_RECHECK", "OPERATOR_REJECT", "RETURN_OPERATOR_REJECTION", "CLOSE", "CANCEL"].includes(action)) requireNote(action === "BACKLOG" ? context.backlogReason : context.note);
  if (action === "SUBMIT_COMPLETION" && !completionReady(context.requiredTasks ?? [])) throw new WorkflowError("Complete every required task before submitting completion", "REQUIRED_TASKS_INCOMPLETE");
  if (["VERIFY", "APPROVE_COMPLETION", "RETURN", "RETURN_FOR_RECHECK"].includes(action)) {
    if (!context.completionExists) throw new WorkflowError("A completion revision is required", "COMPLETION_NOT_FOUND");
    if (context.completionOwnerId === context.actor.id) throw new WorkflowError("A technician cannot review their own completion", "SEGREGATION_OF_DUTIES");
  }
  if (action === "CLOSE" && (!context.operatorAcceptanceExists || context.openRecheckExists)) throw new WorkflowError("Operator acceptance and resolved rechecks are required before closure", "CLOSURE_INCOMPLETE");
  return next;
}

export function availableNotificationActions(status: NotificationStatus, actor: WorkflowActor) { return Object.keys(notificationTransitions[status] ?? {}).filter((action) => actor.permissions.includes(notificationPermission[action as NotificationAction])) as NotificationAction[]; }
export function availableWorkOrderActions(status: WorkOrderStatus, actor: WorkflowActor, assignedTo?: string | null) { return Object.keys(workOrderTransitions[status] ?? {}).filter((action) => actor.permissions.includes(workOrderPermission[action as WorkOrderAction]) && (!["ACCEPT_ASSIGNMENT", "START", "WAIT_FOR_PARTS", "WAIT_FOR_VENDOR", "WAIT_FOR_ACCESS", "HOLD", "BACKLOG", "RESUME", "SUBMIT_COMPLETION"].includes(action) || assignedTo === actor.id)) as WorkOrderAction[]; }
export function completionReady(tasks: ReadonlyArray<{ required: boolean; status: WorkTaskStatus }>) { return tasks.every((task) => !task.required || task.status === "COMPLETED"); }
export function transitionTask(current: WorkTaskStatus, next: WorkTaskStatus, actor: WorkflowActor) { requirePermission(actor, actor.permissions.includes("WORK_ORDER_UPDATE_PROGRESS") ? "WORK_ORDER_UPDATE_PROGRESS" : "EXECUTE_WORK_ORDERS"); const allowed: Record<WorkTaskStatus, readonly WorkTaskStatus[]> = { OPEN: ["IN_PROGRESS", "BACKLOG", "COMPLETED"], IN_PROGRESS: ["OPEN", "BACKLOG", "COMPLETED"], BACKLOG: ["OPEN", "IN_PROGRESS"], COMPLETED: ["OPEN"] }; if (!allowed[current].includes(next)) throw new WorkflowError(`Cannot move a ${current.toLowerCase()} task to ${next.toLowerCase()}`); return next; }

// Compatibility helpers retained for legacy callers while all HTTP commands use
// explicit action names and the governed state machine above.
export function reviewNotification(current: NotificationStatus, decision: NotificationDecision): NotificationStatus { if (current !== "UNDER_REVIEW" && current !== "NEW") throw new WorkflowError("Only notifications under review can be decided"); return decision === "NEEDS_INFORMATION" ? "NEEDS_INFORMATION" : decision === "BACKLOG" ? "APPROVED" : decision; }
export function verificationAction(decision: VerificationDecision): WorkOrderAction { return decision === "VERIFIED" ? "APPROVE_COMPLETION" : "RETURN_FOR_RECHECK"; }
export function convertNotificationToWorkOrder(current: NotificationStatus, actor: WorkflowActor, data: { assignedTo?: string | null; backlogReason?: string | null }): WorkOrderStatus { requirePermission(actor, actor.permissions.includes("WORK_ORDER_CREATE") ? "WORK_ORDER_CREATE" : "MANAGE_WORK_ORDERS"); if (current !== "APPROVED") throw new WorkflowError(`Cannot convert a ${current.toLowerCase()} notification`); return data.assignedTo ? "ASSIGNED" : "CREATED"; }
export function completeNotification(current: NotificationStatus, actor: WorkflowActor): NotificationStatus { return transitionNotification(current, "WORK_ORDERS_CLOSED", { actor, allWorkOrdersClosed: true }); }
