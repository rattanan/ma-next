import { describe, expect, it } from "vitest";
import { availableNotificationActions, availableWorkOrderActions, completionReady, transitionNotification, transitionWorkOrder, WorkflowError } from "../lib/maintenance/workflow";

const actor = (id: string, permissions: string[]) => ({ id, permissions: permissions as never[] });
const operator = actor("operator", ["NOTIFICATION_SUBMIT", "NOTIFICATION_ACCEPT_WORK", "NOTIFICATION_REJECT_WORK", "NOTIFICATION_CLOSE"]);
const manager = actor("manager", ["NOTIFICATION_REVIEW", "NOTIFICATION_REQUEST_INFORMATION", "NOTIFICATION_REJECT", "NOTIFICATION_APPROVE", "WORK_ORDER_CREATE", "WORK_ORDER_ASSIGN", "WORK_ORDER_REVIEW_COMPLETION", "WORK_ORDER_APPROVE_COMPLETION", "WORK_ORDER_RETURN_FOR_RECHECK", "WORK_ORDER_CLOSE"]);
const technician = actor("tech", ["WORK_ORDER_ACCEPT_ASSIGNMENT", "WORK_ORDER_START", "WORK_ORDER_UPDATE_PROGRESS", "WORK_ORDER_SUBMIT_COMPLETION"]);

describe("notification lifecycle", () => {
  it("supports information return without overwriting the original state history", () => {
    let status = transitionNotification("DRAFT", "SUBMIT", { actor: operator });
    status = transitionNotification(status, "START_REVIEW", { actor: manager });
    status = transitionNotification(status, "REQUEST_INFORMATION", { actor: manager, note: "Add operating readings" });
    expect(status).toBe("RETURNED");
    expect(transitionNotification(status, "PROVIDE_INFORMATION", { actor: operator })).toBe("SUBMITTED");
  });
  it("marks an approved notification as converted when a work order is created", () => {
    expect(transitionNotification("APPROVED", "START_MAINTENANCE", { actor: manager })).toBe("CONVERTED_TO_WORK_ORDER");
  });
  it("requires linked work closure before final notification closure", () => {
    expect(() => transitionNotification("READY_TO_CLOSE", "CLOSE", { actor: operator, note: "Confirmed", allWorkOrdersClosed: false })).toThrow("All linked work orders");
    expect(transitionNotification("READY_TO_CLOSE", "CLOSE", { actor: operator, note: "Confirmed", allWorkOrdersClosed: true, openRecheckExists: false })).toBe("CLOSED");
  });
  it("offers only permission-compatible UI actions", () => {
    expect(availableNotificationActions("UNDER_REVIEW", operator)).toEqual([]);
    expect(availableNotificationActions("UNDER_REVIEW", manager)).toEqual(expect.arrayContaining(["APPROVE", "REJECT", "REQUEST_INFORMATION"]));
  });
});

describe("work order lifecycle", () => {
  it("runs the full governed sequence", () => {
    let status = transitionWorkOrder("CREATED", "ASSIGN", { actor: manager });
    status = transitionWorkOrder(status, "ACCEPT_ASSIGNMENT", { actor: technician, assignedTo: "tech" });
    status = transitionWorkOrder(status, "START", { actor: technician, assignedTo: "tech" });
    status = transitionWorkOrder(status, "SUBMIT_COMPLETION", { actor: technician, assignedTo: "tech", requiredTasks: [{ required: true, status: "COMPLETED" }] });
    status = transitionWorkOrder(status, "BEGIN_MANAGER_REVIEW", { actor: manager });
    status = transitionWorkOrder(status, "APPROVE_COMPLETION", { actor: manager, completionExists: true, completionOwnerId: "tech" });
    status = transitionWorkOrder(status, "REQUEST_OPERATOR_ACCEPTANCE", { actor: manager });
    status = transitionWorkOrder(status, "OPERATOR_ACCEPT", { actor: operator });
    status = transitionWorkOrder(status, "CLOSE", { actor: manager, note: "Administrative close", operatorAcceptanceExists: true, openRecheckExists: false });
    expect(status).toBe("CLOSED");
  });
  it("cannot skip assignment acceptance or operator acceptance", () => {
    expect(() => transitionWorkOrder("ASSIGNED", "SUBMIT_COMPLETION", { actor: technician, assignedTo: "tech", requiredTasks: [] })).toThrow(WorkflowError);
    expect(() => transitionWorkOrder("MANAGER_APPROVED", "CLOSE", { actor: manager, note: "Too soon", operatorAcceptanceExists: false })).toThrow(WorkflowError);
    expect(() => transitionWorkOrder("CLOSED", "START", { actor: technician, assignedTo: "tech" })).toThrow(WorkflowError);
  });
  it("preserves the recheck route", () => {
    const returned = transitionWorkOrder("UNDER_MANAGER_REVIEW", "RETURN_FOR_RECHECK", { actor: manager, completionExists: true, completionOwnerId: "tech", note: "Repeat load test" });
    expect(transitionWorkOrder(returned, "START", { actor: technician, assignedTo: "tech" })).toBe("IN_PROGRESS");
  });
  it("requires assigned ownership and completed tasks", () => {
    expect(() => transitionWorkOrder("ASSIGNED", "ACCEPT_ASSIGNMENT", { actor: technician, assignedTo: "other" })).toThrow("assigned technician");
    expect(completionReady([{ required: true, status: "OPEN" }])).toBe(false);
    expect(availableWorkOrderActions("ASSIGNED", technician, "other")).not.toContain("ACCEPT_ASSIGNMENT");
  });
});
