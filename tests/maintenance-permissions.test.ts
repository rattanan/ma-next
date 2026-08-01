import { describe, expect, it } from "vitest";
import { rolePermissions } from "../lib/auth/permissions";
import { transitionNotification, transitionWorkOrder } from "../lib/maintenance/workflow";

const actor = (id: string, permissions: string[]) => ({ id, permissions: permissions as never[] });
describe("governed maintenance permissions", () => {
  it("keeps operational duties separated", () => {
    expect(rolePermissions.OPERATOR.has("WORK_ORDER_ASSIGN")).toBe(false);
    expect(rolePermissions.TECHNICIAN.has("WORK_ORDER_CLOSE")).toBe(false);
    expect(rolePermissions.TECHNICIAN.has("WORK_ORDER_APPROVE_COMPLETION")).toBe(false);
    expect(rolePermissions.MAINTENANCE_MANAGER.has("WORK_ORDER_ASSIGN")).toBe(true);
    expect(rolePermissions.MAINTENANCE_MANAGER.has("WORK_ORDER_RETURN_FOR_RECHECK")).toBe(true);
  });
  it("blocks direct permission bypasses", () => {
    expect(() => transitionWorkOrder("CREATED", "ASSIGN", { actor: actor("operator", ["NOTIFICATION_CREATE"]) })).toThrow("WORK_ORDER_ASSIGN");
    expect(() => transitionWorkOrder("OPERATOR_ACCEPTED", "CLOSE", { actor: actor("tech", ["WORK_ORDER_SUBMIT_COMPLETION"]), operatorAcceptanceExists: true })).toThrow("WORK_ORDER_CLOSE");
    expect(() => transitionNotification("UNDER_REVIEW", "APPROVE", { actor: actor("operator", ["NOTIFICATION_SUBMIT"]) })).toThrow("NOTIFICATION_APPROVE");
  });
  it("prevents a technician approving their own revision", () => {
    expect(() => transitionWorkOrder("UNDER_MANAGER_REVIEW", "APPROVE_COMPLETION", { actor: actor("tech", ["WORK_ORDER_APPROVE_COMPLETION"]), completionExists: true, completionOwnerId: "tech" })).toThrow("cannot review their own");
  });
});
