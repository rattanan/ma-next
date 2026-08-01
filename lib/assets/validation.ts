import { z } from "zod";
import { assetStatusValues, assetStructureLevelValues } from "@/lib/db/schema";
import { assetSchema } from "@/lib/maintenance/validation";

const optionalFilter = z.string().trim().max(100).optional().default("");

export const assetListQuerySchema = z.object({
  q: z.string().trim().max(190).optional().default(""),
  status: z.enum(assetStatusValues).or(z.literal("")).optional().default(""),
  type: optionalFilter,
  category: optionalFilter,
  level: z.enum(assetStructureLevelValues).or(z.literal("")).optional().default(""),
  parentId: z.string().uuid().or(z.literal("")).optional().default(""),
});

export const assetMutationSchema = assetSchema.extend({
  customFields: z.record(z.string().uuid(), z.string().trim().max(500)).default({}),
}).strict();

export const assetArchiveSchema = z.object({
  reason: z.string().trim().min(3).max(1000),
}).strict();

export function normalizeLegacyAssetStatus(status: string) {
  const normalized = status.trim().toUpperCase().replaceAll(" ", "_");
  if (assetStatusValues.includes(normalized as (typeof assetStatusValues)[number])) return normalized as (typeof assetStatusValues)[number];
  throw new Error(`Unsupported legacy asset status: ${status}`);
}

export function assertNoHierarchyCycle(assetId: string, parentAssetId: string | null, parents: ReadonlyMap<string, string | null>) {
  let cursor = parentAssetId;
  const visited = new Set<string>();
  while (cursor) {
    if (cursor === assetId) throw new Error("Asset hierarchy cannot contain a cycle");
    if (visited.has(cursor)) throw new Error("Existing asset hierarchy contains a cycle");
    visited.add(cursor);
    cursor = parents.get(cursor) ?? null;
  }
  return true;
}
