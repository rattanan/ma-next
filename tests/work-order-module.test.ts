import { describe, expect, it } from "vitest";
import { acceptanceSchema, assignmentSchema, backlogSchema, taskStatusSchema, toolLoanCommandSchema, toolLoanSchema, workOrderCreateSchema, workOrderListSchema, workOrderUpdateSchema } from "../lib/maintenance/validation";
import { transitionWorkOrder, WorkflowError } from "../lib/maintenance/workflow";
import { workOrderInventoryAdapter } from "../lib/work-orders/inventory-adapter";

const technician = { id: "tech", permissions: ["EXECUTE_WORK_ORDERS"] as never[] };

describe("Work Order command-only workflow", () => {
  it("moves to backlog and resumes with mandatory details", () => {
    expect(transitionWorkOrder("IN_PROGRESS", "BACKLOG", { actor: technician, backlogReason: "Awaiting isolation" })).toBe("BACKLOG");
    expect(transitionWorkOrder("BACKLOG", "RESUME", { actor: technician, note: "Isolation completed" })).toBe("OPEN");
    expect(() => transitionWorkOrder("OPEN", "BACKLOG", { actor: technician, backlogReason: "" })).toThrow("backlog reason");
    expect(() => transitionWorkOrder("BACKLOG", "RESUME", { actor: technician, note: "" })).toThrow("resolution note");
  });

  it("rejects invalid backlog state and missing permission", () => {
    expect(() => transitionWorkOrder("CLOSED", "BACKLOG", { actor: technician, backlogReason: "Wait" })).toThrow(WorkflowError);
    expect(() => transitionWorkOrder("OPEN", "BACKLOG", { actor: { id: "viewer", permissions: [] }, backlogReason: "Wait" })).toThrow("EXECUTE_WORK_ORDERS");
  });
});

describe("Work Order validation", () => {
  const valid = { sourceType: "MANUAL", workType: "CORRECTIVE", assetId: "11111111-1111-4111-8111-111111111111", title: "Repair pump seal", description: "Replace leaking mechanical seal", priority: "HIGH", severity: "MAJOR", equipmentOperatingStatus: "DEGRADED" };
  it("accepts a complete manual Work Order", () => expect(workOrderCreateSchema.parse(valid).sourceType).toBe("MANUAL"));
  it("requires an external source record", () => expect(() => workOrderCreateSchema.parse({ ...valid, sourceType: "PREVENTIVE_EVENT" })).toThrow("Source record"));
  it("prevents direct status manipulation", () => expect(() => workOrderUpdateSchema.parse({ title: "Changed", status: "CLOSED" })).toThrow());
  it("requires the dedicated backlog command for Job Steps", () => expect(() => taskStatusSchema.parse({ status: "BACKLOG" })).toThrow());
  it("validates filters and bounds pagination", () => { expect(workOrderListSchema.parse({ page: "2", pageSize: "50", overdue: "true" })).toMatchObject({ page: 2, pageSize: 50 }); expect(() => workOrderListSchema.parse({ pageSize: 500 })).toThrow(); });
  it("validates assignment, backlog, tool and acceptance payloads", () => {
    expect(assignmentSchema.parse({ assignedTo: "22222222-2222-4222-8222-222222222222", note: "Assign mechanical technician" }).assignmentType).toBe("TECHNICIAN");
    expect(() => backlogSchema.parse({ reason: "" })).toThrow();
    expect(toolLoanSchema.parse({ toolCode: "T-01", toolName: "Torque wrench", quantity: 1 }).quantity).toBe(1);
    expect(toolLoanCommandSchema.parse({ loanId: "33333333-3333-4333-8333-333333333333", command: "RETURN" }).command).toBe("RETURN");
    expect(acceptanceSchema.parse({ acceptedAt: new Date().toISOString(), details: "Operations accepted isolation", attachmentIds: [] }).details).toContain("accepted");
  });

  it("keeps inventory mutations behind a record-only adapter", () => {
    expect(workOrderInventoryAdapter.prepare({ transactionType: "CONSUMED", quantity: 2 }).stockBalanceChanged).toBe(false);
    expect(() => workOrderInventoryAdapter.prepare({ transactionType: "ISSUED", quantity: 1 })).toThrow("reference document");
  });
});
