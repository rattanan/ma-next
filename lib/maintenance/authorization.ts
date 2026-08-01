import type { Permission } from "../auth/permissions";
import type { AuthenticatedUser } from "../auth/session";
import { HttpError } from "../http";

export type ResourceScope = { organizationId?: string | null; siteId?: string | null; departmentId?: string | null };

export function requireActorPermission(actor: AuthenticatedUser, permission: Permission) {
  if (!actor.permissions.includes(permission)) throw new HttpError(403, `Missing permission: ${permission}`, "FORBIDDEN");
}

export function canAccessScope(actor: AuthenticatedUser, resource: ResourceScope, permission?: Permission) {
  if (!actor.scopes?.length) return actor.role === "ADMIN";
  return actor.scopes.some((scope) => {
    if (permission && !scope.permissions.includes(permission) && scope.roleCode !== actor.role) return false;
    if (scope.scopeType === "GLOBAL") return true;
    if (scope.scopeType === "ORGANIZATION") return Boolean(resource.organizationId && resource.organizationId === scope.organizationId);
    if (scope.scopeType === "SITE") return Boolean(resource.siteId && resource.siteId === scope.siteId && (!resource.organizationId || resource.organizationId === scope.organizationId));
    return Boolean(resource.departmentId && resource.departmentId === scope.departmentId && (!resource.organizationId || resource.organizationId === scope.organizationId) && (!resource.siteId || resource.siteId === scope.siteId));
  });
}

export function requireScope(actor: AuthenticatedUser, resource: ResourceScope, permission?: Permission) {
  if (!canAccessScope(actor, resource, permission)) throw new HttpError(403, "This record is outside your authorized organization or department", "SCOPE_FORBIDDEN");
}

export function requireOwnerOrScope(actor: AuthenticatedUser, ownerId: string, resource: ResourceScope, permission?: Permission) {
  if (actor.id !== ownerId) requireScope(actor, resource, permission);
}

export function requireAssignedTechnician(actor: AuthenticatedUser, assignedTo?: string | null) {
  if (!assignedTo || assignedTo !== actor.id) throw new HttpError(403, "Only the currently assigned technician may perform this action", "ASSIGNMENT_FORBIDDEN");
}
