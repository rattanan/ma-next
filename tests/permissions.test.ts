import { describe, expect, it } from "vitest";
import { canCreateDashboard, canExecuteWorkOrders, canManageDataSources, canManageUsers, canReviewMaintenance, canVerifyWorkOrders, canViewAuditLogs, hasPermission } from "../lib/auth/permissions";

describe("role-based access control", () => {
  it("allows administrators to manage users and audit logs", () => { expect(canManageUsers("ADMIN")).toBe(true); expect(canViewAuditLogs("ADMIN")).toBe(true); });
  it("prevents viewers from using admin permissions", () => { expect(canManageUsers("VIEWER")).toBe(false); expect(canViewAuditLogs("VIEWER")).toBe(false); });
  it("prevents dashboard creators from managing data sources", () => expect(canManageDataSources("DASHBOARD_CREATOR")).toBe(false));
  it("prevents data source creators from managing users", () => expect(canManageUsers("DATA_SOURCE_CREATOR")).toBe(false));
  it("allows dashboard creators to create dashboards", () => expect(canCreateDashboard("DASHBOARD_CREATOR")).toBe(true));
  it("gives all roles dashboard view access", () => { for (const role of ["ADMIN", "DATA_SOURCE_CREATOR", "DASHBOARD_CREATOR", "VIEWER"] as const) expect(hasPermission(role, "VIEW_DASHBOARD")).toBe(true); });
  it("lets every authenticated role view maintenance and report a notification", () => { for (const role of ["ADMIN", "DATA_SOURCE_CREATOR", "DASHBOARD_CREATOR", "VIEWER"] as const) { expect(hasPermission(role, "VIEW_MAINTENANCE")).toBe(true); expect(hasPermission(role, "CREATE_MAINTENANCE_NOTIFICATION")).toBe(true); } });
  it("reserves review and verification for supervisor-capable roles", () => { expect(canReviewMaintenance("ADMIN")).toBe(true); expect(canVerifyWorkOrders("DATA_SOURCE_CREATOR")).toBe(true); expect(canReviewMaintenance("DASHBOARD_CREATOR")).toBe(false); expect(canVerifyWorkOrders("VIEWER")).toBe(false); });
  it("allows technicians to execute but not verify work", () => { expect(canExecuteWorkOrders("DASHBOARD_CREATOR")).toBe(true); expect(canVerifyWorkOrders("DASHBOARD_CREATOR")).toBe(false); });
  it("reserves foundation configuration mutations for administrators", () => { expect(hasPermission("ADMIN", "MANAGE_ORGANIZATION")).toBe(true); expect(hasPermission("ADMIN", "MANAGE_MASTER_DATA")).toBe(true); expect(hasPermission("VIEWER", "MANAGE_ORGANIZATION")).toBe(false); expect(hasPermission("VIEWER", "MANAGE_MASTER_DATA")).toBe(false); });
  it("lets every authenticated role read shared foundation data", () => { for (const role of ["ADMIN", "DATA_SOURCE_CREATOR", "DASHBOARD_CREATOR", "VIEWER"] as const) { expect(hasPermission(role, "VIEW_ORGANIZATION")).toBe(true); expect(hasPermission(role, "VIEW_MASTER_DATA")).toBe(true); expect(hasPermission(role, "VIEW_NOTIFICATIONS")).toBe(true); } });
});
