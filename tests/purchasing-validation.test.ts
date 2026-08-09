import { describe, expect, it } from "vitest";
import { approvalWorkflowMutationSchema, purchaseApprovalActionSchema, purchaseRequestMutationSchema } from "@/lib/purchasing/validation";

const userId = "11111111-1111-4111-8111-111111111111";
const stockItemId = "22222222-2222-4222-8222-222222222222";
const departmentId = "33333333-3333-4333-8333-333333333333";
const vendorId = "44444444-4444-4444-8444-444444444444";

const step = { stepNumber: 1, stepName: "Manager", approverType: "SPECIFIC_USER" as const, approverUserId: userId, approverRole: null, alternateUserId: null, minAmountThb: "0", maxAmountThb: null, isRequired: true, allowSelfApproval: false, canReject: true, canReturnForRevision: true, canDelegate: false, escalationDurationHours: null, isActive: true };

describe("purchasing validation", () => {
  it("rejects invalid workflow ranges and duplicate steps", () => {
    const result = approvalWorkflowMutationSchema.safeParse({ workflowName: "PR route", documentType: "PURCHASE_REQUEST", departmentId, minAmountThb: "50000", maxAmountThb: "1000", effectiveFrom: "2026-08-06", priority: 1, steps: [step, { ...step, stepName: "Finance" }] });
    expect(result.success).toBe(false);
  });

  it("requires a configured user for specific-user steps", () => {
    const result = approvalWorkflowMutationSchema.safeParse({ workflowName: "PR route", documentType: "PURCHASE_REQUEST", minAmountThb: "0", effectiveFrom: "2026-08-06", steps: [{ ...step, approverUserId: null }] });
    expect(result.success).toBe(false);
  });

  it("rejects duplicate candidate vendors", () => {
    const result = purchaseRequestMutationSchema.safeParse({ departmentId, lines: [{ stockItemId, quantity: "2", estimatedUnitPrice: "10" }], candidateVendorIds: [vendorId, vendorId] });
    expect(result.success).toBe(false);
  });

  it("requires a comment for decision, comment, and delegation actions", () => {
    expect(purchaseApprovalActionSchema.safeParse({ action: "APPROVE", comment: "ok" }).success).toBe(false);
    expect(purchaseApprovalActionSchema.safeParse({ action: "COMMENT", comment: "Context added" }).success).toBe(true);
    expect(purchaseApprovalActionSchema.safeParse({ action: "DELEGATE", delegateUserId: userId, comment: "Out of office" }).success).toBe(true);
  });
});
