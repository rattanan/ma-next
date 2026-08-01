import { describe, expect, it } from "vitest";
import { completeNotification, completionReady, reviewNotification, transitionNotification, transitionTask, transitionWorkOrder, verificationAction, WorkflowError } from "../lib/maintenance/workflow";

const actor = (id: string, permissions: string[]) => ({ id, permissions: permissions as never[] });
const technician = actor("tech-1", ["EXECUTE_WORK_ORDERS"]);
const supervisor = actor("supervisor-1", ["REVIEW_MAINTENANCE_NOTIFICATION", "VERIFY_WORK_ORDERS", "CLOSE_WORK_ORDERS"]);

describe("maintenance notification review", () => {
  it.each(["APPROVED", "BACKLOG", "REJECTED"] as const)("moves a new notification to %s", (decision) => {
    expect(reviewNotification("NEW", decision)).toBe(decision);
  });

  it("prevents a second review", () => {
    expect(() => reviewNotification("APPROVED", "REJECTED")).toThrow(WorkflowError);
  });

  it("validates permission, technician, note, and backlog reason centrally", () => {
    expect(() => transitionNotification("NEW", "APPROVE", { actor: technician, assignedTo: "tech-1", note: "Proceed" })).toThrow("Missing permission");
    expect(() => transitionNotification("NEW", "APPROVE", { actor: supervisor, note: "Proceed" })).toThrow("assigned technician");
    expect(() => transitionNotification("NEW", "BACKLOG", { actor: supervisor, assignedTo: "tech-1", note: "Deferred" })).toThrow("backlog reason");
    expect(transitionNotification("NEW", "BACKLOG", { actor: supervisor, assignedTo: "tech-1", note: "Deferred", backlogReason: "Shutdown window required" })).toBe("BACKLOG");
  });
});

describe("work order lifecycle", () => {
  it("follows execution, completion, verification, and close in order", () => {
    let status = transitionWorkOrder("OPEN", "START");
    status = transitionWorkOrder(status, "SUBMIT_COMPLETION");
    status = transitionWorkOrder(status, "VERIFY");
    status = transitionWorkOrder(status, "CLOSE");
    expect(status).toBe("CLOSED");
  });

  it("returns rejected completion to execution", () => {
    expect(transitionWorkOrder("COMPLETION_PENDING", verificationAction("RETURNED"))).toBe("IN_PROGRESS");
  });

  it("allows authorized backlog work to start", () => {
    expect(transitionWorkOrder("BACKLOG", "START")).toBe("IN_PROGRESS");
  });

  it("rejects skipping supervisor verification", () => {
    expect(() => transitionWorkOrder("COMPLETION_PENDING", "CLOSE")).toThrow("Cannot close");
  });

  it("rejects changes after close", () => {
    expect(() => transitionWorkOrder("CLOSED", "START")).toThrow(WorkflowError);
  });

  it("blocks unassigned work and permission bypass", () => {
    expect(() => transitionWorkOrder("OPEN", "START", { actor: technician, assignedTo: null })).toThrow("assigned technician");
    expect(() => transitionWorkOrder("OPEN", "START", { actor: supervisor, assignedTo: "tech-1" })).toThrow("Missing permission");
  });

  it("enforces required tasks and supervisor segregation of duties", () => {
    expect(() => transitionWorkOrder("IN_PROGRESS", "SUBMIT_COMPLETION", { actor: technician, requiredTasks: [{ required: true, status: "OPEN" }] })).toThrow("required task");
    expect(() => transitionWorkOrder("COMPLETION_PENDING", "VERIFY", { actor: { ...supervisor, id: "tech-1" }, completionExists: true, completionOwnerId: "tech-1", note: "Looks good" })).toThrow("cannot verify");
  });
});

describe("completion readiness", () => {
  it("allows completion when every required task is complete", () => {
    expect(completionReady([{ required: true, status: "COMPLETED" }, { required: false, status: "OPEN" }])).toBe(true);
  });

  it("blocks completion while a required task remains open", () => {
    expect(completionReady([{ required: true, status: "OPEN" }])).toBe(false);
  });

  it("matches legacy behavior when no tasks exist", () => expect(completionReady([])).toBe(true));
});

describe("complete corrective maintenance flow", () => {
  it("runs approval, conversion, execution, verification, and close without direct status edits", () => {
    const notificationStatus = transitionNotification("NEW", "APPROVE", { actor: supervisor, assignedTo: "tech-1", note: "Approved corrective repair" });
    expect(notificationStatus).toBe("APPROVED");
    let workStatus = transitionWorkOrder("OPEN", "START", { actor: technician, assignedTo: "tech-1" });
    expect(transitionTask("OPEN", "COMPLETED", technician)).toBe("COMPLETED");
    workStatus = transitionWorkOrder(workStatus, "SUBMIT_COMPLETION", { actor: technician, requiredTasks: [{ required: true, status: "COMPLETED" }] });
    workStatus = transitionWorkOrder(workStatus, "VERIFY", { actor: supervisor, completionExists: true, completionOwnerId: "tech-1", note: "Verified in operation" });
    workStatus = transitionWorkOrder(workStatus, "CLOSE", { actor: supervisor, note: "Closed after stable run" });
    expect(workStatus).toBe("CLOSED");
    expect(completeNotification(notificationStatus, supervisor)).toBe("COMPLETED");
  });
});
