import { describe, expect, it } from "vitest";
import { assignmentGrants, type CapabilityAssignment } from "../lib/planning/capabilities";
const scope = { organizationId: "org", siteId: "site", departmentId: "department" };
const assignment = (code: string, extra: Partial<CapabilityAssignment> = {}): CapabilityAssignment => ({ ...scope, scopeType: "SITE", role: { code, active: true, permissions: [] }, ...extra });
describe("planning responsible capabilities", () => {
  it("allows a scoped technician but not an operator to start work", () => {
    expect(assignmentGrants(assignment("TECHNICIAN"), scope, "WORK_ORDER_START")).toBe(true);
    expect(assignmentGrants(assignment("OPERATOR"), scope, "WORK_ORDER_START")).toBe(false);
  });
  it("requires active roles and exact site even for a scoped admin", () => {
    expect(assignmentGrants(assignment("TECHNICIAN", { role: { code: "TECHNICIAN", active: false, permissions: [] } }), scope, "WORK_ORDER_START")).toBe(false);
    expect(assignmentGrants(assignment("ADMIN", { siteId: "elsewhere" }), scope, "WORK_ORDER_START")).toBe(false);
  });
  it("does not combine capabilities across assignments", () => {
    const roles = [assignment("TECHNICIAN", { siteId: "elsewhere" }), assignment("OPERATOR")];
    expect(roles.some(r => assignmentGrants(r, scope, "WORK_ORDER_START"))).toBe(false);
  });
  it("honors explicit custom-role grants without legacy fallback", () => {
    const custom = assignment("CUSTOM", { role: { code: "CUSTOM", active: true, permissions: [{ permission: { code: "WORK_ORDER_START" } }] } });
    expect(assignmentGrants(custom, scope, "WORK_ORDER_START")).toBe(true);
    expect(assignmentGrants(assignment("CUSTOM"), scope, "WORK_ORDER_START")).toBe(false);
  });
  it("requires a department on department-scoped assignments", () => {
    const role = assignment("TECHNICIAN", { scopeType: "DEPARTMENT" });
    expect(assignmentGrants(role, { ...scope, departmentId: null }, "WORK_ORDER_START")).toBe(false);
    expect(assignmentGrants(role, scope, "WORK_ORDER_START")).toBe(true);
  });
});
