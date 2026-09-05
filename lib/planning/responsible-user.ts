import { prisma } from "../prisma";
import { HttpError } from "../http";
import type { Permission } from "../auth/permissions";
import type { ResourceScope } from "../maintenance/authorization";
import { assignmentGrants } from "./capabilities";

export async function requireResponsibleCapability(id: string | null | undefined, scope: ResourceScope, permission: Permission) {
  if (!id) throw new HttpError(409, "A responsible user is required", "INVALID_RESPONSIBLE_USER");
  const user = await prisma.user.findFirst({ where: { id, status: "ACTIVE" }, select: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } } });
  if (!user?.roles.some(r => assignmentGrants(r, scope, permission))) throw new HttpError(409, `Responsible user must have ${permission} in this organization/site`, "INVALID_RESPONSIBLE_USER");
}
