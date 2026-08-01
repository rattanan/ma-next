import type { Prisma } from "@/generated/prisma/client";
import type { AuthenticatedUser } from "@/lib/auth/session";
import { maskSensitive } from "@/lib/auth/mask";
import type { RequestMeta } from "@/lib/auth/request";

export type AuditInput = { action: string; category: string; targetType: string; targetId: string; targetName?: string; description: string; previousValues?: unknown; newValues?: unknown };
export function auditData(input: AuditInput, actor: AuthenticatedUser, meta: RequestMeta): Prisma.AuditLogCreateInput {
  return { actorUserId: actor.id, actorName: actor.fullName, action: input.action, category: input.category, targetType: input.targetType, targetId: input.targetId, targetName: input.targetName, result: "SUCCESS", description: input.description, previousValues: input.previousValues === undefined ? undefined : JSON.stringify(maskSensitive(input.previousValues)), newValues: input.newValues === undefined ? undefined : JSON.stringify(maskSensitive(input.newValues)), ipAddress: meta.ipAddress, userAgent: meta.userAgent, requestId: meta.requestId };
}
export function writeAudit(tx: Prisma.TransactionClient, input: AuditInput, actor: AuthenticatedUser, meta: RequestMeta) { return tx.auditLog.create({ data: auditData(input, actor, meta) }); }
