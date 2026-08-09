import { z } from "zod";

export const purchaseDocumentTypes = ["PURCHASE_REQUEST", "PURCHASE_ORDER"] as const;
export const approverTypes = ["SPECIFIC_USER", "DEPARTMENT_MANAGER", "ROLE", "REQUESTER_MANAGER", "PURCHASE_MANAGER"] as const;
export const purchaseRequestStatuses = ["DRAFT", "PENDING_APPROVAL", "RETURNED_FOR_REVISION", "APPROVED", "REJECTED", "PARTIALLY_CONVERTED", "CONVERTED", "CANCELLED"] as const;
export const purchaseOrderStatuses = ["DRAFT", "PENDING_APPROVAL", "RETURNED_FOR_REVISION", "APPROVED", "ISSUED", "PARTIAL_RECEIVED", "RECEIVED", "CLOSED", "REJECTED", "CANCELLED"] as const;

const optionalText = (max: number) => z.string().trim().max(max).optional().nullable();
const decimalText = z.union([z.string(), z.number()]).transform((value) => String(value)).refine((value) => /^\d+(\.\d{1,6})?$/.test(value), "Must be a non-negative decimal with up to 6 places");
const positiveDecimal = decimalText.refine((value) => Number(value) > 0, "Must be greater than zero");
const nonNegativeDecimal = decimalText;
const dateValue = z.coerce.date();

export const approvalWorkflowStepSchema = z.object({
  stepNumber: z.coerce.number().int().min(1).max(1000),
  stepName: z.string().trim().min(1).max(160),
  approverType: z.enum(approverTypes),
  approverUserId: z.string().uuid().optional().nullable(),
  approverRole: optionalText(120),
  alternateUserId: z.string().uuid().optional().nullable(),
  minAmountThb: nonNegativeDecimal.default("0"),
  maxAmountThb: nonNegativeDecimal.optional().nullable(),
  isRequired: z.boolean().default(true),
  allowSelfApproval: z.boolean().default(false),
  canReject: z.boolean().default(true),
  canReturnForRevision: z.boolean().default(true),
  canDelegate: z.boolean().default(false),
  escalationDurationHours: z.coerce.number().int().min(1).max(8760).optional().nullable(),
  isActive: z.boolean().default(true),
}).superRefine((step, context) => {
  if (step.maxAmountThb !== null && step.maxAmountThb !== undefined && Number(step.minAmountThb) > Number(step.maxAmountThb)) context.addIssue({ code: "custom", path: ["maxAmountThb"], message: "Maximum amount must be greater than or equal to minimum amount" });
  if (step.approverType === "SPECIFIC_USER" && !step.approverUserId) context.addIssue({ code: "custom", path: ["approverUserId"], message: "A specific user is required for this approver type" });
  if (step.approverType === "ROLE" && !step.approverRole) context.addIssue({ code: "custom", path: ["approverRole"], message: "A role is required for role-based approval" });
});

const approvalWorkflowBaseSchema = z.object({
  workflowName: z.string().trim().min(2).max(190),
  documentType: z.enum(purchaseDocumentTypes),
  departmentId: z.string().uuid().optional().nullable(),
  minAmountThb: nonNegativeDecimal.default("0"),
  maxAmountThb: nonNegativeDecimal.optional().nullable(),
  currencyBasis: z.literal("THB_EQUIVALENT").default("THB_EQUIVALENT"),
  effectiveFrom: dateValue,
  effectiveTo: dateValue.optional().nullable(),
  priority: z.coerce.number().int().min(0).max(100000).default(0),
  isActive: z.boolean().default(false),
  steps: z.array(approvalWorkflowStepSchema).min(1).max(100),
});

export const approvalWorkflowMutationSchema = approvalWorkflowBaseSchema.superRefine((workflow, context) => {
  if (workflow.maxAmountThb !== null && workflow.maxAmountThb !== undefined && Number(workflow.minAmountThb) > Number(workflow.maxAmountThb)) context.addIssue({ code: "custom", path: ["maxAmountThb"], message: "Maximum amount must be greater than or equal to minimum amount" });
  if (workflow.effectiveTo && workflow.effectiveTo < workflow.effectiveFrom) context.addIssue({ code: "custom", path: ["effectiveTo"], message: "Expiry date must be on or after effective date" });
  const numbers = workflow.steps.map((step) => step.stepNumber);
  if (new Set(numbers).size !== numbers.length) context.addIssue({ code: "custom", path: ["steps"], message: "Step numbers must be unique" });
});

export const approvalWorkflowPatchSchema = approvalWorkflowBaseSchema.partial().extend({
  steps: z.array(approvalWorkflowStepSchema).min(1).max(100).optional(),
});

export const approvalRouteSimulationSchema = z.object({
  documentType: z.enum(purchaseDocumentTypes),
  departmentId: z.string().uuid().optional().nullable(),
  amount: nonNegativeDecimal,
  currencyCode: z.string().trim().min(3).max(10).default("THB"),
  exchangeRateToThb: positiveDecimal.default("1"),
  requesterId: z.string().uuid().optional(),
});

export const approvalDelegationSchema = z.object({
  primaryApproverId: z.string().uuid(),
  delegateUserId: z.string().uuid(),
  delegationStart: dateValue,
  delegationEnd: dateValue,
  reason: optionalText(4000),
});

export const purchaseRequestLineSchema = z.object({
  stockItemId: z.string().uuid(),
  quantity: positiveDecimal,
  estimatedUnitPrice: nonNegativeDecimal,
  discountAmount: nonNegativeDecimal.default("0"),
  remark: optionalText(4000),
});

export const purchaseRequestMutationSchema = z.object({
  departmentId: z.string().uuid(),
  currencyCode: z.string().trim().min(3).max(10).default("THB"),
  exchangeRateToThb: positiveDecimal.default("1"),
  remark: optionalText(10000),
  lines: z.array(purchaseRequestLineSchema).min(1).max(500),
  candidateVendorIds: z.array(z.string().uuid()).max(3).default([]),
}).superRefine((request, context) => {
  if (new Set(request.candidateVendorIds).size !== request.candidateVendorIds.length) context.addIssue({ code: "custom", path: ["candidateVendorIds"], message: "Candidate vendors must be unique" });
});

export const purchaseOrderLineSchema = z.object({
  stockItemId: z.string().uuid(),
  quantity: positiveDecimal,
  unitPrice: nonNegativeDecimal,
  itemDiscountAmount: nonNegativeDecimal.default("0"),
  remark: optionalText(4000),
});

export const purchaseOrderMutationSchema = z.object({
  purchaseRequestId: z.string().uuid().optional().nullable(),
  vendorId: z.string().uuid(),
  departmentId: z.string().uuid(),
  purchaseMethod: optionalText(80),
  currencyCode: z.string().trim().min(3).max(10).default("THB"),
  exchangeRateToThb: positiveDecimal.default("1"),
  headerDiscountAmount: nonNegativeDecimal.default("0"),
  vatAmount: nonNegativeDecimal.default("0"),
  remark: optionalText(10000),
  internalRemark: optionalText(10000),
  lines: z.array(purchaseOrderLineSchema).min(1).max(500),
});

export const purchaseApprovalActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("OPEN"), comment: z.string().trim().max(4000).optional() }),
  z.object({ action: z.literal("COMMENT"), comment: z.string().trim().min(1).max(4000) }),
  z.object({ action: z.literal("APPROVE"), comment: z.string().trim().min(3).max(4000) }),
  z.object({ action: z.literal("REJECT"), comment: z.string().trim().min(3).max(4000) }),
  z.object({ action: z.literal("RETURN"), comment: z.string().trim().min(3).max(4000) }),
  z.object({ action: z.literal("DELEGATE"), delegateUserId: z.string().uuid(), comment: z.string().trim().min(3).max(4000) }),
]);

export const purchaseRequestActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("SUBMIT") }),
  z.object({ action: z.literal("CANCEL"), comment: z.string().trim().max(4000).optional() }),
]);

export const purchaseOrderActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("SUBMIT") }),
  z.object({ action: z.literal("ISSUE") }),
  z.object({ action: z.literal("CANCEL"), comment: z.string().trim().max(4000).optional() }),
]);

export const purchaseListQuerySchema = z.object({
  q: z.string().trim().max(190).default(""),
  status: z.string().trim().max(40).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(25),
});

export type ApprovalWorkflowInput = z.infer<typeof approvalWorkflowMutationSchema>;
export type PurchaseRequestInput = z.infer<typeof purchaseRequestMutationSchema>;
export type PurchaseOrderInput = z.infer<typeof purchaseOrderMutationSchema>;
