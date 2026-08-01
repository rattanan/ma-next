import { describe, expect, it } from "vitest";
import { canAccessScope } from "../lib/maintenance/authorization";
import type { AuthenticatedUser } from "../lib/auth/session";
const user = { id: "operator", fullName: "Operator", username: "operator", email: "operator@example.test", role: "OPERATOR", roleCodes: ["OPERATOR"], permissions: ["NOTIFICATION_VIEW"], scopes: [{ roleCode: "OPERATOR", scopeType: "DEPARTMENT", organizationId: "org-a", siteId: "site-a", departmentId: "dept-a", permissions: ["NOTIFICATION_VIEW"] }], mustChangePassword: false } satisfies AuthenticatedUser;
describe("maintenance scope isolation", () => {
  it("allows the granted department", () => expect(canAccessScope(user, { organizationId: "org-a", departmentId: "dept-a" }, "NOTIFICATION_VIEW")).toBe(true));
  it("blocks another department and tenant", () => { expect(canAccessScope(user, { organizationId: "org-a", departmentId: "dept-b" }, "NOTIFICATION_VIEW")).toBe(false); expect(canAccessScope(user, { organizationId: "org-b", departmentId: "dept-a" }, "NOTIFICATION_VIEW")).toBe(false); });
});
