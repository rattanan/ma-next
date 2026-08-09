import { describe, expect, it } from "vitest";
import { canAccessScope, canReadWorkOrder } from "../lib/maintenance/authorization";
import type { AuthenticatedUser } from "../lib/auth/session";
const user = { id: "operator", fullName: "Operator", username: "operator", email: "operator@example.test", role: "OPERATOR", roleCodes: ["OPERATOR"], permissions: ["NOTIFICATION_VIEW"], scopes: [{ roleCode: "OPERATOR", scopeType: "DEPARTMENT", organizationId: "org-a", siteId: "site-a", departmentId: "dept-a", permissions: ["NOTIFICATION_VIEW"] }], mustChangePassword: false } satisfies AuthenticatedUser;
describe("maintenance scope isolation", () => {
  it("allows the granted department", () => expect(canAccessScope(user, { organizationId: "org-a", departmentId: "dept-a" }, "NOTIFICATION_VIEW")).toBe(true));
  it("blocks another department and tenant", () => { expect(canAccessScope(user, { organizationId: "org-a", departmentId: "dept-b" }, "NOTIFICATION_VIEW")).toBe(false); expect(canAccessScope(user, { organizationId: "org-b", departmentId: "dept-a" }, "NOTIFICATION_VIEW")).toBe(false); });
});

const technician = {
  ...user,
  id: "technician-a",
  role: "TECHNICIAN",
  roleCodes: ["TECHNICIAN"],
  permissions: ["VIEW_MAINTENANCE", "EXECUTE_WORK_ORDERS"],
  scopes: [{ roleCode: "TECHNICIAN", scopeType: "DEPARTMENT", organizationId: "org-a", siteId: "site-a", departmentId: "dept-a", permissions: ["VIEW_MAINTENANCE", "EXECUTE_WORK_ORDERS"] }],
} satisfies AuthenticatedUser;

describe("work-order read isolation", () => {
  it("allows a technician to read an assigned work order in scope", () => {
    expect(canReadWorkOrder(technician, { organizationId: "org-a", siteId: "site-a", departmentId: "dept-a", assignedTo: technician.id })).toBe(true);
  });

  it("blocks unassigned and cross-scope work orders", () => {
    expect(canReadWorkOrder(technician, { organizationId: "org-a", siteId: "site-a", departmentId: "dept-a", assignedTo: "technician-b" })).toBe(false);
    expect(canReadWorkOrder(technician, { organizationId: "org-b", siteId: "site-b", departmentId: "dept-b", assignedTo: technician.id })).toBe(false);
  });
});
