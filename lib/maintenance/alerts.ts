import type { AuthenticatedUser } from "../auth/session";
import type { RequestMeta } from "../auth/request";
import { logger } from "../logger";
import { createNotification } from "../notifications/service";
import { prisma } from "../prisma";

async function managerIds(organizationId: string | null) {
  const rows = await prisma.userRole.findMany({ where: { role: { code: "MAINTENANCE_MANAGER", active: true }, user: { status: "ACTIVE" }, OR: [{ scopeType: "GLOBAL" }, ...(organizationId ? [{ scopeType: "ORGANIZATION" as const, organizationId }] : [])] }, select: { userId: true } });
  return [...new Set(rows.map((row) => row.userId))];
}

export async function sendWorkflowAlert(input: { entity: "NOTIFICATION" | "WORK_ORDER"; id: string; command: string; body: Record<string, unknown> }, actor: AuthenticatedUser, meta: RequestMeta) {
  try {
    let recipientIds: string[] = []; let code = ""; let title = ""; let organizationId: string | null = null;
    if (input.entity === "NOTIFICATION") {
      const row = await prisma.maintenanceNotification.findUnique({ where: { id: input.id }, select: { code: true, title: true, requestedBy: true, organizationId: true } }); if (!row) return; code = row.code; title = row.title; organizationId = row.organizationId;
      recipientIds = ["submit", "provide-information"].includes(input.command) ? await managerIds(organizationId) : input.command === "review" ? [row.requestedBy] : input.command === "create-work-order" && typeof input.body.technicianId === "string" ? [input.body.technicianId] : [];
    } else {
      const row = await prisma.workOrder.findUnique({ where: { id: input.id }, select: { code: true, title: true, assignedTo: true, organizationId: true, notificationId: true } }); if (!row) return; code = row.code; title = row.title; organizationId = row.organizationId; const linkedNotification = row.notificationId ? await prisma.maintenanceNotification.findUnique({ where: { id: row.notificationId }, select: { requestedBy: true } }) : null;
      if (["assign", "return-operator-rejection"].includes(input.command) || (input.command === "manager-decision" && input.body.decision === "RETURN")) recipientIds = [typeof input.body.technicianId === "string" ? input.body.technicianId : row.assignedTo].filter((id): id is string => Boolean(id));
      else if (input.command === "submit-completion" || input.command === "operator-decision") recipientIds = await managerIds(organizationId);
      else if (input.command === "manager-decision" && input.body.decision === "APPROVE") recipientIds = linkedNotification ? [linkedNotification.requestedBy] : [];
      else if (input.command === "close") recipientIds = linkedNotification ? [linkedNotification.requestedBy] : [];
    }
    recipientIds = [...new Set(recipientIds)].filter((id) => id !== actor.id); if (!recipientIds.length) return;
    await createNotification({ type: `MAINTENANCE_${input.command.toUpperCase().replaceAll("-", "_")}`, title: `${code}: ${input.command.replaceAll("-", " ")}`, message: title, actionUrl: "/maintenance", sourceType: input.entity === "NOTIFICATION" ? "MAINTENANCE_NOTIFICATION" : "WORK_ORDER", sourceId: input.id, recipientIds }, actor, meta);
  } catch (error) { logger.error("Workflow alert delivery failed", { entity: input.entity, id: input.id, command: input.command, error: error instanceof Error ? error.message : "Unknown error" }); }
}
