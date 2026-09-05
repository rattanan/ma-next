import { rolePermissions, type Permission } from "../auth/permissions";
import type { Role } from "../db/schema";
import type { ResourceScope } from "../maintenance/authorization";

export type CapabilityAssignment = ResourceScope & { scopeType: string; role: { code: string; active: boolean; permissions: { permission: { code: string } }[] } };

// A permission and its resource scope must come from the SAME active assignment.
// Never combine a technician grant in site A with a viewer grant in site B.
export function assignmentGrants(assignment: CapabilityAssignment, scope: ResourceScope, permission: Permission) {
  if (!assignment.role.active) return false;
  const baseline = Object.hasOwn(rolePermissions, assignment.role.code) ? rolePermissions[assignment.role.code as Role] : undefined;
  if (!baseline?.has(permission) && !assignment.role.permissions.some(p => p.permission.code === permission)) return false;
  if (assignment.scopeType === "GLOBAL") return true;
  if (!scope.organizationId || assignment.organizationId !== scope.organizationId) return false;
  if (assignment.scopeType === "ORGANIZATION") return true;
  if (!scope.siteId || assignment.siteId !== scope.siteId) return false;
  if (assignment.scopeType === "SITE") return true;
  return assignment.scopeType === "DEPARTMENT" && Boolean(scope.departmentId && assignment.departmentId === scope.departmentId);
}
