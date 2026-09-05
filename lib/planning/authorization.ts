import type { AuthenticatedUser, AuthorizationScope } from "../auth/session";
import type { Permission } from "../auth/permissions";
import { assignmentGrants } from "./capabilities";
import { isAdminActor, requireActorPermission, type ResourceScope } from "../maintenance/authorization";
import { HttpError } from "../http";

export function planningGrant(scope: AuthorizationScope, resource: ResourceScope, permission: Permission) {
  return assignmentGrants({ ...scope, role: { code: scope.roleCode, active: true, permissions: scope.permissions.map(code => ({ permission: { code } })) } }, resource, permission);
}
export function requirePlanningScope(actor: AuthenticatedUser, resource: ResourceScope, permission: Permission) {
  requireActorPermission(actor, permission);
  if (!isAdminActor(actor) && !actor.scopes?.some(s => planningGrant(s, resource, permission))) throw new HttpError(403, "Planning permission is not granted in this resource scope", "SCOPE_FORBIDDEN");
}
