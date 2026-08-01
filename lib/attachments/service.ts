import type { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getServerEnv } from "@/lib/env";
import { writeAudit } from "@/lib/audit/service";
import type { AuthenticatedUser } from "@/lib/auth/session";
import type { RequestMeta } from "@/lib/auth/request";
import { attachmentMetadataSchema, validateAttachmentSize } from "./validation";
import { HttpError } from "@/lib/http";

export function listAttachments(entityType: string, entityId: string) { return prisma.attachment.findMany({ where: { entityType, entityId, deletedAt: null }, orderBy: { createdAt: "desc" } }); }
export function registerAttachment(input: z.infer<typeof attachmentMetadataSchema>, actor: AuthenticatedUser, meta: RequestMeta) { validateAttachmentSize(input.byteSize, getServerEnv().MAX_ATTACHMENT_BYTES); return prisma.$transaction(async (tx) => { const record = await tx.attachment.create({ data: { ...input, checksum: input.checksum || null, driver: getServerEnv().ATTACHMENT_DRIVER, uploadedBy: actor.id } }); await writeAudit(tx, { action: "ATTACHMENT_REGISTERED", category: "FILES", targetType: input.entityType, targetId: input.entityId, targetName: input.originalName, description: `Registered attachment ${input.originalName}`, newValues: { id: record.id, contentType: record.contentType, byteSize: record.byteSize } }, actor, meta); return record; }); }

export function updateAssetAttachmentNote(id: string, note: string | null, actor: AuthenticatedUser, meta: RequestMeta) {
  return prisma.$transaction(async (tx) => {
    const attachment = await tx.attachment.findFirst({ where: { id, entityType: "ASSET", deletedAt: null } });
    if (!attachment) throw new HttpError(404, "Asset document not found", "ATTACHMENT_NOT_FOUND");
    const metadata = await tx.assetDocumentMetadata.upsert({ where: { attachmentId: id }, create: { attachmentId: id, note: note || null }, update: { note: note || null } });
    await writeAudit(tx, { action: "ASSET_DOCUMENT_UPDATED", category: "FILES", targetType: "ASSET", targetId: attachment.entityId, targetName: attachment.originalName, description: `Updated document ${attachment.originalName}`, newValues: { note } }, actor, meta);
    return metadata;
  });
}

export function deleteAttachment(id: string, actor: AuthenticatedUser, meta: RequestMeta) {
  return prisma.$transaction(async (tx) => {
    const attachment = await tx.attachment.findFirst({ where: { id, deletedAt: null } });
    if (!attachment) throw new HttpError(404, "Attachment not found", "ATTACHMENT_NOT_FOUND");
    if (attachment.entityType !== "ASSET" && !actor.permissions.includes("MANAGE_ATTACHMENTS")) throw new HttpError(403, "You do not have permission to delete this attachment", "FORBIDDEN");
    await tx.attachment.update({ where: { id }, data: { deletedAt: new Date() } });
    if (attachment.entityType === "ASSET") await tx.asset.updateMany({ where: { id: attachment.entityId, primaryImagePath: `/api/attachments/${id}/content` }, data: { primaryImagePath: null, updatedAt: new Date(), updatedBy: actor.id } });
    await writeAudit(tx, { action: "ATTACHMENT_DELETED", category: "FILES", targetType: attachment.entityType, targetId: attachment.entityId, targetName: attachment.originalName, description: `Deleted attachment ${attachment.originalName}`, previousValues: { id, contentType: attachment.contentType } }, actor, meta);
    return { id };
  });
}
