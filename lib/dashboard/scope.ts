import type { Prisma } from "@/generated/prisma/client";
import type { AuthenticatedUser } from "@/lib/auth/session";

export type DashboardScopeFilters = {
  from: Date;
  to: Date;
  departmentId?: string;
  siteId?: string;
  status?: string;
};

export function isGlobalDashboardActor(actor: AuthenticatedUser) {
  return actor.role === "ADMIN" || actor.roleCodes?.includes("ADMIN") || actor.scopes?.some((scope) => scope.scopeType === "GLOBAL");
}

function scopeConditions(actor: AuthenticatedUser) {
  if (isGlobalDashboardActor(actor)) return [];
  return (actor.scopes ?? []).map((scope) => {
    if (scope.scopeType === "ORGANIZATION") return { organizationId: scope.organizationId };
    if (scope.scopeType === "SITE") return { organizationId: scope.organizationId, siteId: scope.siteId };
    return { organizationId: scope.organizationId, siteId: scope.siteId, departmentId: scope.departmentId };
  }).filter((scope) => Object.values(scope).some(Boolean));
}

export function scopedWorkOrderWhere(actor: AuthenticatedUser, filters: DashboardScopeFilters): Prisma.WorkOrderWhereInput {
  const scopes = scopeConditions(actor);
  const roleCodes = new Set([actor.role, ...(actor.roleCodes ?? [])]);
  const identityRestriction: Prisma.WorkOrderWhereInput | undefined = roleCodes.has("TECHNICIAN")
    ? { OR: [{ assignedTo: actor.id }, { leadUserId: actor.id }, { createdBy: actor.id }] }
    : undefined;
  return {
    createdAt: { gte: filters.from, lte: filters.to },
    ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
    ...(filters.siteId ? { siteId: filters.siteId } : {}),
    ...(filters.status ? { status: filters.status as Prisma.EnumWorkOrderStatusFilter["equals"] } : {}),
    AND: [
      ...(scopes.length ? [{ OR: scopes }] : isGlobalDashboardActor(actor) ? [] : [{ id: "__NO_AUTHORIZED_SCOPE__" }]),
      ...(identityRestriction ? [identityRestriction] : []),
    ],
  };
}

export function scopedNotificationWhere(actor: AuthenticatedUser, filters: DashboardScopeFilters): Prisma.MaintenanceNotificationWhereInput {
  const scopes = scopeConditions(actor);
  const roleCodes = new Set([actor.role, ...(actor.roleCodes ?? [])]);
  const access: Prisma.MaintenanceNotificationWhereInput[] = [];
  if (scopes.length) access.push({ OR: scopes });
  if (roleCodes.has("OPERATOR") || roleCodes.has("VIEWER")) access.push({ requestedBy: actor.id });
  return {
    createdAt: { gte: filters.from, lte: filters.to },
    ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
    ...(filters.siteId ? { siteId: filters.siteId } : {}),
    ...(!isGlobalDashboardActor(actor) ? { OR: access.length ? access : [{ id: "__NO_AUTHORIZED_SCOPE__" }] } : {}),
  };
}
