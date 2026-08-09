import { describe, expect, it } from "vitest";
import type { AuthenticatedUser } from "../lib/auth/session";
import { scopedNotificationWhere, scopedWorkOrderWhere, type DashboardScopeFilters } from "../lib/dashboard/scope";

const filters: DashboardScopeFilters = { from: new Date("2026-01-01T00:00:00.000Z"), to: new Date("2026-01-31T23:59:59.999Z") };

function actor(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: "user-a",
    fullName: "Scoped user",
    username: "scoped.user",
    email: "scoped@example.test",
    role: "TECHNICIAN",
    roleCodes: ["TECHNICIAN"],
    permissions: ["VIEW_MAINTENANCE"],
    scopes: [{ roleCode: "TECHNICIAN", scopeType: "DEPARTMENT", organizationId: "org-a", siteId: "site-a", departmentId: "dept-a", permissions: ["VIEW_MAINTENANCE"] }],
    mustChangePassword: false,
    ...overrides,
  };
}

describe("dashboard scope filters", () => {
  it("restricts technicians by both department scope and work-order involvement", () => {
    const where = scopedWorkOrderWhere(actor(), filters);
    expect(where.AND).toEqual([
      { OR: [{ organizationId: "org-a", siteId: "site-a", departmentId: "dept-a" }] },
      { OR: [{ assignedTo: "user-a" }, { leadUserId: "user-a" }, { createdBy: "user-a" }] },
    ]);
  });

  it("fails closed when a non-admin user has no authorization scope", () => {
    const where = scopedWorkOrderWhere(actor({ role: "VIEWER", roleCodes: ["VIEWER"], scopes: [] }), filters);
    expect(where.AND).toEqual([{ id: "__NO_AUTHORIZED_SCOPE__" }]);
  });

  it("lets an operator see their own notifications in addition to scoped records", () => {
    const where = scopedNotificationWhere(actor({ role: "OPERATOR", roleCodes: ["OPERATOR"] }), filters);
    expect(where.OR).toEqual([
      { OR: [{ organizationId: "org-a", siteId: "site-a", departmentId: "dept-a" }] },
      { requestedBy: "user-a" },
    ]);
  });
});
