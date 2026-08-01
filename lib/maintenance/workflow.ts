import type { NotificationDecision, NotificationStatus, VerificationDecision, WorkOrderStatus, WorkTaskStatus } from "../db/schema";

export class WorkflowError extends Error {
  constructor(message: string, public code = "INVALID_TRANSITION") {
    super(message);
  }
}

export function reviewNotification(current: NotificationStatus, decision: NotificationDecision): NotificationStatus {
  if (current !== "NEW") throw new WorkflowError("Only new notifications can be reviewed");
  return decision;
}

export type WorkOrderAction = "START" | "SUBMIT_COMPLETION" | "VERIFY" | "RETURN" | "CLOSE";

const transitions: Record<WorkOrderStatus, Partial<Record<WorkOrderAction, WorkOrderStatus>>> = {
  OPEN: { START: "IN_PROGRESS" },
  BACKLOG: { START: "IN_PROGRESS" },
  IN_PROGRESS: { SUBMIT_COMPLETION: "COMPLETION_PENDING" },
  COMPLETION_PENDING: { VERIFY: "VERIFIED", RETURN: "IN_PROGRESS" },
  VERIFIED: { CLOSE: "CLOSED" },
  CLOSED: {},
};

export function transitionWorkOrder(current: WorkOrderStatus, action: WorkOrderAction): WorkOrderStatus {
  const next = transitions[current][action];
  if (!next) throw new WorkflowError(`Cannot ${action.toLowerCase().replaceAll("_", " ")} a ${current.toLowerCase().replaceAll("_", " ")} work order`);
  return next;
}

export function completionReady(tasks: ReadonlyArray<{ required: boolean; status: WorkTaskStatus }>) {
  return tasks.every((task) => !task.required || task.status === "COMPLETED");
}

export function verificationAction(decision: VerificationDecision): WorkOrderAction {
  return decision === "VERIFIED" ? "VERIFY" : "RETURN";
}
