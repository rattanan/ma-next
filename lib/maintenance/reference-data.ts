import type { Prisma } from "@/generated/prisma/client";
import type { Permission } from "@/lib/auth/permissions";
import type { AuthenticatedUser, AuthorizationScope } from "@/lib/auth/session";
import { isAdminActor } from "@/lib/maintenance/authorization";
import { prisma } from "@/lib/prisma";

function usableScopes(actor: AuthenticatedUser, permission: Permission) {
  return (actor.scopes ?? []).filter((scope) => scope.permissions.includes(permission) || scope.roleCode === actor.role);
}

function userRoleScope(scope: AuthorizationScope): Prisma.UserRoleWhereInput | undefined {
  if (scope.scopeType === "GLOBAL") return {};
  if (scope.scopeType === "ORGANIZATION" && scope.organizationId) return { organizationId: scope.organizationId };
  if (scope.scopeType === "SITE" && scope.organizationId && scope.siteId) return { organizationId: scope.organizationId, siteId: scope.siteId };
  if (scope.scopeType === "DEPARTMENT" && scope.organizationId && scope.departmentId) {
    return { organizationId: scope.organizationId, ...(scope.siteId ? { siteId: scope.siteId } : {}), departmentId: scope.departmentId };
  }
  return undefined;
}

function departmentScope(scope: AuthorizationScope): Prisma.DepartmentWhereInput | undefined {
  if (scope.scopeType === "GLOBAL") return {};
  if (scope.scopeType === "ORGANIZATION" && scope.organizationId) return { organizationId: scope.organizationId };
  if (scope.scopeType === "SITE" && scope.organizationId && scope.siteId) return { organizationId: scope.organizationId, siteId: scope.siteId };
  if (scope.scopeType === "DEPARTMENT" && scope.organizationId && scope.departmentId) return { organizationId: scope.organizationId, id: scope.departmentId };
  return undefined;
}

export async function getScopedMaintenanceReferences(actor: AuthenticatedUser, permission: Permission) {
  const scopes = usableScopes(actor, permission);
  const global = isAdminActor(actor) || scopes.some((scope) => scope.scopeType === "GLOBAL");
  const userScopes = scopes.map(userRoleScope).filter((scope): scope is Prisma.UserRoleWhereInput => Boolean(scope));
  const departmentScopes = scopes.map(departmentScope).filter((scope): scope is Prisma.DepartmentWhereInput => Boolean(scope));

  const [users, departments] = await Promise.all([
    prisma.user.findMany({
      where: {
        status: "ACTIVE",
        ...(!global ? {
          OR: [
            { id: actor.id },
            ...(userScopes.length ? [{ roles: { some: { role: { active: true }, OR: userScopes } } }] : []),
          ],
        } : {}),
      },
      select: { id: true, fullName: true, legacyRole: true, roles: { where: { role: { active: true } }, select: { role: { select: { code: true } } } } },
      orderBy: { fullName: "asc" },
    }),
    prisma.department.findMany({
      where: { active: true, ...(!global ? { OR: departmentScopes.length ? departmentScopes : [{ id: "__NO_AUTHORIZED_DEPARTMENT__" }] } : {}) },
      select: { id: true, code: true, name: true, organizationId: true, siteId: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return {
    users: users.map(({ legacyRole, roles, ...user }) => ({ ...user, role: roles[0]?.role.code ?? legacyRole })),
    departments,
  };
}
