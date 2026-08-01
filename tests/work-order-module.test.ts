import { describe, expect, it } from "vitest";
import { completionRevisionSchema, governedAssignmentSchema, managerCompletionDecisionSchema, waitingStatusSchema } from "../lib/maintenance/validation";
import { transitionWorkOrder } from "../lib/maintenance/workflow";
const technician = { id: "tech", permissions: ["WORK_ORDER_UPDATE_PROGRESS"] as never[] };
describe("Work Order command validation", () => {
  it("requires a reason for waiting and resume", () => {
    expect(waitingStatusSchema.safeParse({ status: "WAITING_FOR_PARTS", reason: "" }).success).toBe(false);
    expect(() => transitionWorkOrder("IN_PROGRESS", "WAIT_FOR_PARTS", { actor: technician, assignedTo: "tech", note: "" })).toThrow("reason");
  });
  it("requires a reassignment instruction", () => expect(governedAssignmentSchema.safeParse({ technicianId: "11111111-1111-4111-8111-111111111111", instructions: "" }).success).toBe(false));
  it("validates complete revision evidence", () => {
    expect(completionRevisionSchema.safeParse({ diagnosis: "Bearing failed", correctiveAction: "Replaced", workSummary: "Done", laborMinutes: 30, partsFinalized: true, testProcedure: "Run", testResult: "Pass" }).success).toBe(false);
    expect(completionRevisionSchema.safeParse({ diagnosis: "Bearing failed", rootCauseUnknownReason: "Damage obscured evidence", correctiveAction: "Replaced", workSummary: "Done", laborMinutes: 30, partsFinalized: true, testProcedure: "Run", testResult: "Pass" }).success).toBe(true);
  });
  it("requires manager return actions", () => expect(managerCompletionDecisionSchema.safeParse({ decision: "RETURN", comment: "Retest", requiredActions: [] }).success).toBe(false));
});
