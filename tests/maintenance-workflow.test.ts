import { describe, expect, it } from "vitest";
import { completionReady, reviewNotification, transitionWorkOrder, verificationAction, WorkflowError } from "../lib/maintenance/workflow";

describe("maintenance notification review", () => {
  it.each(["APPROVED", "BACKLOG", "REJECTED"] as const)("moves a new notification to %s", (decision) => {
    expect(reviewNotification("NEW", decision)).toBe(decision);
  });

  it("prevents a second review", () => {
    expect(() => reviewNotification("APPROVED", "REJECTED")).toThrow(WorkflowError);
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
