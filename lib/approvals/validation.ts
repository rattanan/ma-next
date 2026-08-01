import { z } from "zod";
import { approvalStatusValues, approvalTypeValues, notificationPriorityValues } from "@/lib/db/schema";

export const approvalQuerySchema = z.object({
  tab: z.enum(["pending", "in-review", "returned", "approved", "rejected", "all"]).default("pending"),
  search: z.string().trim().max(190).default(""),
  type: z.enum(approvalTypeValues).optional(),
  priority: z.enum(notificationPriorityValues).optional(),
  status: z.enum(approvalStatusValues).optional(),
  site: z.string().trim().max(80).optional(),
  requestedBy: z.string().uuid().optional(),
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
  sort: z.enum(["newest", "oldest", "waiting"]).default("waiting"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(20),
});

export const approvalDecisionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("OPEN"), comment: z.string().trim().max(4000).optional() }),
  z.object({ action: z.literal("APPROVE"), comment: z.string().trim().min(3).max(4000), responsibleGroup: z.string().trim().min(2).max(160), priority: z.enum(notificationPriorityValues), maintenanceType: z.enum(["CORRECTIVE", "BREAKDOWN", "INSPECTION"]) }),
  z.object({ action: z.literal("RETURN"), reason: z.string().trim().min(3).max(4000) }),
  z.object({ action: z.literal("REJECT"), reason: z.string().trim().min(3).max(4000) }),
]);
