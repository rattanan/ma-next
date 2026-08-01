import { z } from "zod";
import { assetCriticalityValues, assetStatusValues, assetStructureLevelValues, equipmentOperatingStatusValues, maintenanceSeverityValues, notificationDecisionValues, notificationPriorityValues, notificationTypeValues, verificationDecisionValues, workOrderSourceTypeValues, workOrderStatusValues, workOrderTypeValues, workTaskKindValues } from "../db/schema";

const optionalText = (max: number) => z.string().trim().max(max).optional().default("");
const optionalId = z.string().uuid().nullable().optional().or(z.literal("").transform(() => null));
const nullableInteger = (minimum = 0) => z.preprocess((value) => value === "" ? null : value, z.coerce.number().int().min(minimum).nullable().optional());

export const assetSchema = z.object({
  code: z.string().trim().min(2).max(60).transform((value) => value.toUpperCase()),
  name: z.string().trim().min(2).max(160),
  description: optionalText(4000),
  assetTypeId: z.string().uuid(),
  assetCategoryId: optionalId,
  parentAssetId: optionalId,
  structureLevel: z.enum(assetStructureLevelValues).default("EQUIPMENT"),
  location: z.string().trim().min(2).max(190),
  criticality: z.enum(assetCriticalityValues).default("MEDIUM"),
  status: z.enum(assetStatusValues).default("ACTIVE"),
  ownerUserId: optionalId,
  contractId: optionalId,
  primaryImagePath: z.string().trim().max(500).nullable().optional(),
  unit: z.string().trim().max(45).nullable().optional(),
  serialNumber: z.string().trim().max(45).nullable().optional(),
  maintenanceInterval: nullableInteger(),
  runningHourCode: z.string().trim().max(45).nullable().optional(),
  budgetId: z.string().trim().max(45).nullable().optional(),
  gpsCoordinates: z.string().trim().max(90).nullable().optional(),
  costCenterLegacyId: nullableInteger(1),
  budgetReferenceLegacyId: nullableInteger(1),
  inventoryLocationLegacyId: nullableInteger(1),
  inventoryLocationName: z.string().trim().max(190).nullable().optional(),
});

export const notificationSchema = z.object({
  organizationId: optionalId,
  siteId: optionalId,
  assetId: z.string().uuid(),
  title: z.string().trim().min(3).max(190),
  description: z.string().trim().min(5).max(8000),
  symptoms: z.string().trim().max(8000).optional(),
  operationalImpact: z.string().trim().max(8000).optional(),
  requestedUrgency: z.string().trim().max(80).optional(),
  contactPerson: z.string().trim().max(160).optional(),
  contactPhone: z.string().trim().max(60).optional(),
  type: z.enum(notificationTypeValues).default("CORRECTIVE"),
  priority: z.enum(notificationPriorityValues).default("MEDIUM"),
  severity: z.enum(maintenanceSeverityValues).default("MODERATE"),
  equipmentOperatingStatus: z.enum(equipmentOperatingStatusValues).default("UNKNOWN"),
  breakdown: z.boolean().default(false),
  departmentId: optionalId,
  assignedPersonId: optionalId,
  supervisorId: optionalId,
  photoAttachmentIds: z.array(z.string().uuid()).max(10).default([]),
  dueAt: z.iso.datetime().nullable().optional(),
});

export const notificationDraftUpdateSchema = notificationSchema.partial().strict();
export const notificationSubmitSchema = z.object({ comment: optionalText(4000) }).strict();
export const notificationInformationResponseSchema = z.object({ response: z.string().trim().min(3).max(8000), attachmentIds: z.array(z.string().uuid()).max(20).default([]) }).strict();
export const governedNotificationReviewSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("START_REVIEW"), comment: optionalText(4000) }),
  z.object({ action: z.literal("REQUEST_INFORMATION"), comment: z.string().trim().min(3).max(4000) }),
  z.object({ action: z.literal("REJECT"), comment: z.string().trim().min(3).max(4000) }),
  z.object({ action: z.literal("APPROVE"), comment: optionalText(4000) }),
]);

export const notificationReviewSchema = z.object({
  decision: z.enum(notificationDecisionValues),
  note: z.string().trim().min(3).max(4000),
  assignedTo: optionalId,
  dueAt: z.iso.datetime().nullable().optional(),
  backlogReason: optionalText(4000),
}).superRefine((value, context) => {
  if ((value.decision === "APPROVED" || value.decision === "BACKLOG") && !value.assignedTo) {
    context.addIssue({ code: "custom", path: ["assignedTo"], message: "An assignee is required when work is authorized" });
  }
  if (value.decision === "BACKLOG" && !value.backlogReason.trim()) context.addIssue({ code: "custom", path: ["backlogReason"], message: "A backlog reason is required" });
});

export const taskSchema = z.object({
  title: z.string().trim().min(2).max(190),
  description: optionalText(4000),
  required: z.boolean().default(true),
  kind: z.enum(workTaskKindValues).default("JOB_STEP"),
  assignedTo: optionalId,
  assetId: optionalId,
  dueAt: z.iso.datetime().nullable().optional(),
  estimatedMinutes: z.coerce.number().int().nonnegative().max(525600).nullable().optional(),
  responseType: z.enum(["TEXT", "NUMBER", "PASS_FAIL", "YES_NO", "OPTION"]).nullable().optional(),
});

export const taskStatusSchema = z.object({
  // BACKLOG is intentionally excluded: it requires a reason and must use the
  // dedicated append-only backlog command.
  status: z.enum(["OPEN", "IN_PROGRESS", "COMPLETED"]),
  result: optionalText(8000),
  responseValue: optionalText(8000),
  remarks: optionalText(8000),
  actualMinutes: z.coerce.number().int().nonnegative().max(525600).nullable().optional(),
  evidenceAttachmentId: optionalId,
});

export const workOrderListSchema = z.object({
  q: z.string().trim().max(190).optional(),
  type: z.enum(workOrderTypeValues).optional(),
  status: z.enum(workOrderStatusValues).optional(),
  priority: z.enum(notificationPriorityValues).optional(),
  departmentId: z.string().uuid().optional(),
  assignedTo: z.string().uuid().optional(),
  dateFrom: z.iso.datetime().optional(),
  dateTo: z.iso.datetime().optional(),
  overdue: z.enum(["true", "false"]).optional(),
  sort: z.enum(["updatedAt", "code", "dueAt", "priority", "status"]).default("updatedAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const workOrderCreateSchema = z.object({
  sourceType: z.enum(workOrderSourceTypeValues).default("MANUAL"),
  sourceRecordId: z.string().trim().max(80).nullable().optional(),
  workType: z.enum(workOrderTypeValues),
  assetId: z.string().uuid(),
  title: z.string().trim().min(3).max(190),
  description: z.string().trim().min(5).max(8000),
  priority: z.enum(notificationPriorityValues).default("MEDIUM"),
  severity: z.enum(maintenanceSeverityValues).default("MODERATE"),
  equipmentOperatingStatus: z.enum(equipmentOperatingStatusValues).default("UNKNOWN"),
  departmentId: optionalId,
  crewName: z.string().trim().max(160).nullable().optional(),
  assignedTo: optionalId,
  leadUserId: optionalId,
  supervisorId: optionalId,
  vendorName: z.string().trim().max(190).nullable().optional(),
  customerName: z.string().trim().max(190).nullable().optional(),
  reporterName: z.string().trim().max(160).nullable().optional(),
  reporterPhone: z.string().trim().max(60).nullable().optional(),
  reportedAt: z.iso.datetime().nullable().optional(),
  plannedStartAt: z.iso.datetime().nullable().optional(),
  plannedFinishAt: z.iso.datetime().nullable().optional(),
  dueAt: z.iso.datetime().nullable().optional(),
  estimatedMinutes: z.coerce.number().int().nonnegative().max(525600).nullable().optional(),
  checklistTemplateId: optionalId,
  maintenanceTemplateId: optionalId,
  notes: optionalText(8000),
  backlogReason: optionalText(4000),
}).strict().superRefine((value, context) => {
  if (value.sourceType !== "MANUAL" && !value.sourceRecordId) context.addIssue({ code: "custom", path: ["sourceRecordId"], message: "Source record is required" });
  if (value.plannedStartAt && value.plannedFinishAt && new Date(value.plannedFinishAt) < new Date(value.plannedStartAt)) context.addIssue({ code: "custom", path: ["plannedFinishAt"], message: "Planned finish must not precede planned start" });
});

export const workOrderUpdateSchema = z.object({
  title: z.string().trim().min(3).max(190).optional(),
  description: z.string().trim().min(5).max(8000).optional(),
  priority: z.enum(notificationPriorityValues).optional(),
  severity: z.enum(maintenanceSeverityValues).optional(),
  equipmentOperatingStatus: z.enum(equipmentOperatingStatusValues).optional(),
  departmentId: optionalId,
  crewName: z.string().trim().max(160).nullable().optional(),
  assignedTo: optionalId,
  leadUserId: optionalId,
  supervisorId: optionalId,
  vendorName: z.string().trim().max(190).nullable().optional(),
  customerName: z.string().trim().max(190).nullable().optional(),
  reporterName: z.string().trim().max(160).nullable().optional(),
  reporterPhone: z.string().trim().max(60).nullable().optional(),
  reportedAt: z.iso.datetime().nullable().optional(),
  plannedStartAt: z.iso.datetime().nullable().optional(),
  plannedFinishAt: z.iso.datetime().nullable().optional(),
  dueAt: z.iso.datetime().nullable().optional(),
  estimatedMinutes: z.coerce.number().int().nonnegative().max(525600).nullable().optional(),
  checklistTemplateId: optionalId,
  maintenanceTemplateId: optionalId,
  notes: optionalText(8000),
}).strict().superRefine((value, context) => {
  if (value.plannedStartAt && value.plannedFinishAt && new Date(value.plannedFinishAt) < new Date(value.plannedStartAt)) context.addIssue({ code: "custom", path: ["plannedFinishAt"], message: "Planned finish must not precede planned start" });
});
export const assignmentSchema = z.object({ departmentId: optionalId, assignedTo: z.string().uuid(), teamName: z.string().trim().max(160).nullable().optional(), positionName: z.string().trim().max(160).nullable().optional(), assignmentType: z.string().trim().min(2).max(40).default("TECHNICIAN"), note: z.string().trim().min(3).max(4000) });
export const backlogSchema = z.object({ reasonCode: z.string().trim().max(60).nullable().optional(), reason: z.string().trim().min(3).max(8000), category: z.string().trim().max(80).nullable().optional(), expectedResumeAt: z.iso.datetime().nullable().optional() });
export const resumeSchema = z.object({ resolution: z.string().trim().min(3).max(8000) });
export const taskBacklogSchema = backlogSchema.extend({ taskId: z.string().uuid() });
export const taskResumeSchema = resumeSchema.extend({ taskId: z.string().uuid() });
export const toolLoanSchema = z.object({ toolCode: z.string().trim().min(1).max(80), toolName: z.string().trim().min(2).max(190), quantity: z.coerce.number().positive().max(1_000_000), usageCondition: optionalText(4000), notes: optionalText(4000) });
export const toolLoanCommandSchema = z.object({ loanId: z.string().uuid(), command: z.enum(["ISSUE", "RETURN", "CANCEL"]), note: optionalText(4000) });
export const acceptanceSchema = z.object({ acceptedAt: z.iso.datetime(), details: z.string().trim().min(3).max(8000), notes: optionalText(8000), lotoReference: optionalText(190), isolationPoints: optionalText(8000), permitNumber: optionalText(120), safetyInstructions: optionalText(8000), hazards: optionalText(8000), operatingConditions: optionalText(8000), logSheetReference: optionalText(190), testResult: optionalText(8000), handoverDetails: optionalText(8000), attachmentIds: z.array(z.string().uuid()).max(20).default([]) });

export const executionEntrySchema = z.object({
  description: z.string().trim().min(3).max(8000),
  departmentId: optionalId,
  employeeId: optionalId,
  positionName: optionalText(160),
  workType: optionalText(80),
  minutesSpent: z.coerce.number().int().min(1).max(1440),
  overtimeMinutes: z.coerce.number().int().min(0).max(1440).default(0),
  overtimeMultiplier: z.coerce.number().min(1).max(3).default(1),
  actionAt: z.iso.datetime(),
});

export const completionSchema = z.object({
  result: z.string().trim().min(2).max(190),
  problem: optionalText(8000),
  cause: optionalText(8000),
  solution: z.string().trim().min(3).max(8000),
  escalation: optionalText(8000),
  notes: optionalText(8000),
  durationMinutes: z.coerce.number().int().min(1).max(525600),
  beforePhotoAttachmentIds: z.array(z.string().uuid()).max(20).default([]),
  afterPhotoAttachmentIds: z.array(z.string().uuid()).max(20).default([]),
});

export const completionRevisionSchema = z.object({
  diagnosis: z.string().trim().min(3).max(8000),
  rootCause: optionalText(8000),
  rootCauseUnknownReason: optionalText(8000),
  correctiveAction: z.string().trim().min(3).max(8000),
  workSummary: z.string().trim().min(3).max(8000),
  laborMinutes: z.coerce.number().int().min(1).max(525600),
  partsFinalized: z.boolean(),
  noPartsUsed: z.boolean().default(false),
  testProcedure: z.string().trim().min(3).max(8000),
  testResult: z.string().trim().min(2).max(8000),
  remainingIssue: optionalText(8000),
  recommendation: optionalText(8000),
  beforePhotoAttachmentIds: z.array(z.string().uuid()).max(20).default([]),
  afterPhotoAttachmentIds: z.array(z.string().uuid()).max(20).default([]),
}).strict().superRefine((value, context) => {
  if (!value.rootCause && !value.rootCauseUnknownReason) context.addIssue({ code: "custom", path: ["rootCause"], message: "Root cause or an unknown-cause explanation is required" });
  if (!value.partsFinalized) context.addIssue({ code: "custom", path: ["partsFinalized"], message: "Parts usage must be finalized" });
});

export const governedAssignmentSchema = z.object({ technicianId: z.string().uuid(), teamName: optionalText(160), instructions: z.string().trim().min(3).max(8000), reason: optionalText(4000), dueAt: z.iso.datetime().nullable().optional() }).strict();
export const waitingStatusSchema = z.object({ status: z.enum(["WAITING_FOR_PARTS", "WAITING_FOR_VENDOR", "WAITING_FOR_ACCESS", "ON_HOLD"]), reason: z.string().trim().min(3).max(8000), expectedResumeAt: z.iso.datetime().nullable().optional() }).strict();
export const progressNoteSchema = z.object({ note: z.string().trim().min(3).max(8000) }).strict();
export const managerCompletionDecisionSchema = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("APPROVE"), comment: z.string().trim().min(3).max(4000) }),
  z.object({ decision: z.literal("RETURN"), comment: z.string().trim().min(3).max(4000), requiredActions: z.array(z.string().trim().min(2).max(500)).min(1).max(20), technicianId: z.string().uuid().optional(), dueAt: z.iso.datetime().nullable().optional() }),
]);
export const operatorDecisionSchema = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("ACCEPT"), comment: optionalText(4000) }),
  z.object({ decision: z.literal("REJECT"), reason: z.string().trim().min(3).max(4000), remainingProblem: z.string().trim().min(3).max(8000), attachmentIds: z.array(z.string().uuid()).max(20).default([]) }),
]);
export const notificationCloseSchema = z.object({ comment: z.string().trim().min(3).max(4000) }).strict();

export const sparePartUsageSchema = z.object({
  sparePartId: z.string().uuid(),
  quantity: z.coerce.number().positive().max(1_000_000),
  transactionType: z.enum(["REQUESTED", "RESERVED", "ISSUED", "RETURNED", "CONSUMED"]).default("CONSUMED"),
  warehouse: optionalText(120),
  storageLocation: optionalText(120),
  unit: optionalText(40),
  referenceDocument: optionalText(190),
  note: optionalText(4000),
});

export const verificationSchema = z.object({
  completionId: z.string().uuid(),
  decision: z.enum(verificationDecisionValues),
  note: z.string().trim().min(3).max(4000),
});

export const closeSchema = z.object({ note: z.string().trim().min(3).max(4000) });
