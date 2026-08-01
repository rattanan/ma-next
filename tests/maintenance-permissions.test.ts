import { describe, expect, it } from "vitest";
import { transitionNotification, transitionWorkOrder } from "../lib/maintenance/workflow";

describe("corrective maintenance transition permissions", () => {
  const actor = (permissions: string[]) => ({ id: "actor", permissions: permissions as never[] });

  it("requires reviewer permission for approve, backlog, and reject", () => {
    for (const action of ["APPROVE", "BACKLOG", "REJECT"] as const) expect(() => transitionNotification("NEW", action, { actor: actor([]), assignedTo: "tech", note: "Decision note", backlogReason: "Awaiting outage" })).toThrow("REVIEW_MAINTENANCE_NOTIFICATION");
  });

  it.each([
    ["OPEN", "START", "EXECUTE_WORK_ORDERS"],
    ["OPEN", "BACKLOG", "EXECUTE_WORK_ORDERS"],
    ["BACKLOG", "RESUME", "EXECUTE_WORK_ORDERS"],
    ["IN_PROGRESS", "SUBMIT_COMPLETION", "EXECUTE_WORK_ORDERS"],
    ["COMPLETION_PENDING", "VERIFY", "VERIFY_WORK_ORDERS"],
    ["VERIFIED", "CLOSE", "CLOSE_WORK_ORDERS"],
  ] as const)("protects %s → %s with %s", (status, action, permission) => {
    const context = { actor: actor([]), assignedTo: "tech", requiredTasks: [], completionExists: true, completionOwnerId: "other", note: "Required note", backlogReason: "Required backlog reason" };
    expect(() => transitionWorkOrder(status, action, context)).toThrow(permission);
  });
});
