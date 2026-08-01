import type { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getServerEnv } from "@/lib/env";
import { writeAudit } from "@/lib/audit/service";
import type { AuthenticatedUser } from "@/lib/auth/session";
import type { RequestMeta } from "@/lib/auth/request";
import { attachmentMetadataSchema, validateAttachmentSize } from "./validation";

export function listAttachments(entityType: string, entityId: string) { return prisma.attachment.findMany({ where: { entityType, entityId, deletedAt: null }, orderBy: { createdAt: "desc" } }); }
export function registerAttachment(input: z.infer<typeof attachmentMetadataSchema>, actor: AuthenticatedUser, meta: RequestMeta) { validateAttachmentSize(input.byteSize, getServerEnv().MAX_ATTACHMENT_BYTES); return prisma.$transaction(async (tx) => { const record = await tx.attachment.create({ data: { ...input, checksum: input.checksum || null, driver: getServerEnv().ATTACHMENT_DRIVER, uploadedBy: actor.id } }); await writeAudit(tx, { action: "ATTACHMENT_REGISTERED", category: "FILES", targetType: input.entityType, targetId: input.entityId, targetName: input.originalName, description: `Registered attachment ${input.originalName}`, newValues: { id: record.id, contentType: record.contentType, byteSize: record.byteSize } }, actor, meta); return record; }); }
