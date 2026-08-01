import { z } from "zod";
import { assetCriticalityValues, assetStatusValues, assetStructureLevelValues, equipmentOperatingStatusValues, maintenanceSeverityValues, notificationDecisionValues, notificationPriorityValues, notificationTypeValues, verificationDecisionValues, workTaskKindValues, workTaskStatusValues } from "../db/schema";

const optionalText = (max: number) => z.string().trim().max(max).optional().default("");
const optionalId = z.string().uuid().nullable().optional();

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
  maintenanceInterval: z.coerce.number().int().nonnegative().nullable().optional(),
  runningHourCode: z.string().trim().max(45).nullable().optional(),
  budgetId: z.string().trim().max(45).nullable().optional(),
  gpsCoordinates: z.string().trim().max(90).nullable().optional(),
  costCenterLegacyId: z.coerce.number().int().positive().nullable().optional(),
  budgetReferenceLegacyId: z.coerce.number().int().positive().nullable().optional(),
  inventoryLocationLegacyId: z.coerce.number().int().positive().nullable().optional(),
  inventoryLocationName: z.string().trim().max(190).nullable().optional(),
});

export const notificationSchema = z.object({
  assetId: z.string().uuid(),
  title: z.string().trim().min(3).max(190),
  description: z.string().trim().min(5).max(8000),
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
});

export const taskStatusSchema = z.object({ status: z.enum(workTaskStatusValues) });

export const executionEntrySchema = z.object({
  description: z.string().trim().min(3).max(8000),
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

export const sparePartUsageSchema = z.object({
  sparePartId: z.string().uuid(),
  quantity: z.coerce.number().positive().max(1_000_000),
  note: optionalText(4000),
});

export const verificationSchema = z.object({
  completionId: z.string().uuid(),
  decision: z.enum(verificationDecisionValues),
  note: z.string().trim().min(3).max(4000),
});

export const closeSchema = z.object({ note: z.string().trim().min(3).max(4000) });
