import type { z } from "zod";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit/service";
import type { AuthenticatedUser } from "@/lib/auth/session";
import type { RequestMeta } from "@/lib/auth/request";
import { masterDataTypeSchema, masterDataValueSchema } from "./validation";

export function listMasterData() { return prisma.masterDataType.findMany({ include: { values: { orderBy: [{ sortOrder: "asc" }, { label: "asc" }] } }, orderBy: { name: "asc" } }); }
export function createMasterDataType(input: z.infer<typeof masterDataTypeSchema>, actor: AuthenticatedUser, meta: RequestMeta) { return prisma.$transaction(async (tx) => { const record = await tx.masterDataType.create({ data: { ...input, description: input.description || null, valueSchema: input.valueSchema || null } }); await writeAudit(tx, { action: "MASTER_DATA_TYPE_CREATED", category: "CONFIGURATION", targetType: "MASTER_DATA_TYPE", targetId: record.id, targetName: record.name, description: `Created master-data type ${record.code}`, newValues: input }, actor, meta); return record; }); }
export function createMasterDataValue(input: z.infer<typeof masterDataValueSchema>, actor: AuthenticatedUser, meta: RequestMeta) { return prisma.$transaction(async (tx) => { const record = await tx.masterDataValue.create({ data: { ...input, description: input.description || null, metadata: input.metadata || null } }); await writeAudit(tx, { action: "MASTER_DATA_VALUE_CREATED", category: "CONFIGURATION", targetType: "MASTER_DATA_VALUE", targetId: record.id, targetName: record.label, description: `Created master-data value ${record.code}`, newValues: input }, actor, meta); return record; }); }
