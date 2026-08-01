import { z } from "zod";
import { assetCriticalityValues, assetStatusValues, notificationDecisionValues, notificationPriorityValues, notificationTypeValues, verificationDecisionValues, workTaskStatusValues } from "../db/schema";

const optionalText = (max: number) => z.string().trim().max(max).optional().default("");
const optionalId = z.string().uuid().nullable().optional();

export const assetSchema = z.object({
  code: z.string().trim().min(2).max(60).transform((value) => value.toUpperCase()),
  name: z.string().trim().min(2).max(160),
  description: optionalText(4000),
  assetTypeId: z.string().uuid(),
  assetCategoryId: optionalId,
  parentAssetId: optionalId,
  location: z.string().trim().min(2).max(190),
  criticality: z.enum(assetCriticalityValues).default("MEDIUM"),
  status: z.enum(assetStatusValues).default("ACTIVE"),
  ownerUserId: optionalId,
});

export const notificationSchema = z.object({
  assetId: z.string().uuid(),
  title: z.string().trim().min(3).max(190),
  description: z.string().trim().min(5).max(8000),
  type: z.enum(notificationTypeValues).default("CORRECTIVE"),
  priority: z.enum(notificationPriorityValues).default("MEDIUM"),
  breakdown: z.boolean().default(false),
  supervisorId: optionalId,
  dueAt: z.iso.datetime().nullable().optional(),
});

export const notificationReviewSchema = z.object({
  decision: z.enum(notificationDecisionValues),
  note: z.string().trim().min(3).max(4000),
  assignedTo: optionalId,
  dueAt: z.iso.datetime().nullable().optional(),
}).superRefine((value, context) => {
  if ((value.decision === "APPROVED" || value.decision === "BACKLOG") && !value.assignedTo) {
    context.addIssue({ code: "custom", path: ["assignedTo"], message: "An assignee is required when work is authorized" });
  }
});

export const taskSchema = z.object({
  title: z.string().trim().min(2).max(190),
  description: optionalText(4000),
  required: z.boolean().default(true),
  assignedTo: optionalId,
});

export const taskStatusSchema = z.object({ status: z.enum(workTaskStatusValues) });

export const executionEntrySchema = z.object({
  description: z.string().trim().min(3).max(8000),
  minutesSpent: z.coerce.number().int().min(1).max(1440),
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
});

export const verificationSchema = z.object({
  completionId: z.string().uuid(),
  decision: z.enum(verificationDecisionValues),
  note: z.string().trim().min(3).max(4000),
});

export const closeSchema = z.object({ note: z.string().trim().min(3).max(4000) });
