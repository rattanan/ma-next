import { describe, expect, it } from "vitest";
import type { AuthenticatedUser } from "../lib/auth/session";
import { requirePlanningScope } from "../lib/planning/authorization";
const resource = { organizationId: "org", siteId: "site" };
const actor: AuthenticatedUser = { id: "user", fullName: "Tester", email: "test@example.invalid", username: "tester", role: "VIEWER", mustChangePassword: false, permissions: ["PROJECT_MANAGE", "PM_VIEW"], scopes: [{ roleCode: "CUSTOM", scopeType: "SITE", ...resource, departmentId: null, permissions: ["PM_VIEW"] }] };
describe("dedicated planning authorization", () => {
  it("does not accept an aggregate permission from a different scope", () => {
    expect(() => requirePlanningScope(actor, resource, "PROJECT_MANAGE")).toThrow();
    expect(() => requirePlanningScope(actor, resource, "PM_VIEW")).not.toThrow();
  });
  it("does not treat work order creation as project management", () => {
    expect(() => requirePlanningScope({ ...actor, permissions: ["WORK_ORDER_CREATE"] }, resource, "PROJECT_MANAGE")).toThrow();
  });
  it("keeps view, management and generation independent", () => {
    const generator: AuthenticatedUser = { ...actor, permissions: ["PM_GENERATE"], scopes: actor.scopes!.map(s => ({ ...s, permissions: ["PM_GENERATE"] })) };
    expect(() => requirePlanningScope(generator, resource, "PM_GENERATE")).not.toThrow();
    expect(() => requirePlanningScope(generator, resource, "PM_MANAGE")).toThrow();
    expect(() => requirePlanningScope(generator, { ...resource, siteId: "other" }, "PM_GENERATE")).toThrow();
  });
});
