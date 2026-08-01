import type { Role } from "@/lib/db/schema";

export type Permission =
  | "MANAGE_USERS"
  | "VIEW_LOGIN_HISTORY"
  | "VIEW_AUDIT_LOGS"
  | "VIEW_MAINTENANCE"
  | "CREATE_MAINTENANCE_NOTIFICATION"
  | "REVIEW_MAINTENANCE_NOTIFICATION"
  | "MANAGE_WORK_ORDERS"
  | "EXECUTE_WORK_ORDERS"
  | "VERIFY_WORK_ORDERS"
  | "CLOSE_WORK_ORDERS"
  | "MANAGE_DATA_SOURCES"
  | "CREATE_DASHBOARD"
  | "VIEW_DASHBOARD"
  | "EXPORT_DATA"
  | "USE_COPILOT";

export const rolePermissions: Record<Role, ReadonlySet<Permission>> = {
  ADMIN: new Set(["MANAGE_USERS", "VIEW_LOGIN_HISTORY", "VIEW_AUDIT_LOGS", "VIEW_MAINTENANCE", "CREATE_MAINTENANCE_NOTIFICATION", "REVIEW_MAINTENANCE_NOTIFICATION", "MANAGE_WORK_ORDERS", "EXECUTE_WORK_ORDERS", "VERIFY_WORK_ORDERS", "CLOSE_WORK_ORDERS", "MANAGE_DATA_SOURCES", "CREATE_DASHBOARD", "VIEW_DASHBOARD", "EXPORT_DATA", "USE_COPILOT"]),
  DATA_SOURCE_CREATOR: new Set(["VIEW_MAINTENANCE", "CREATE_MAINTENANCE_NOTIFICATION", "REVIEW_MAINTENANCE_NOTIFICATION", "MANAGE_WORK_ORDERS", "EXECUTE_WORK_ORDERS", "VERIFY_WORK_ORDERS", "CLOSE_WORK_ORDERS", "MANAGE_DATA_SOURCES", "VIEW_DASHBOARD", "USE_COPILOT"]),
  DASHBOARD_CREATOR: new Set(["VIEW_MAINTENANCE", "CREATE_MAINTENANCE_NOTIFICATION", "MANAGE_WORK_ORDERS", "EXECUTE_WORK_ORDERS", "CREATE_DASHBOARD", "VIEW_DASHBOARD", "USE_COPILOT"]),
  VIEWER: new Set(["VIEW_MAINTENANCE", "CREATE_MAINTENANCE_NOTIFICATION", "VIEW_DASHBOARD", "USE_COPILOT"]),
};

export function hasPermission(role: Role, permission: Permission) {
  return rolePermissions[role].has(permission);
}
export const canManageUsers = (role: Role) => hasPermission(role, "MANAGE_USERS");
export const canManageDataSources = (role: Role) => hasPermission(role, "MANAGE_DATA_SOURCES");
export const canCreateDashboard = (role: Role) => hasPermission(role, "CREATE_DASHBOARD");
export const canViewAuditLogs = (role: Role) => hasPermission(role, "VIEW_AUDIT_LOGS");
export const canUseCopilot = (role: Role) => hasPermission(role, "USE_COPILOT");
export const canReviewMaintenance = (role: Role) => hasPermission(role, "REVIEW_MAINTENANCE_NOTIFICATION");
export const canExecuteWorkOrders = (role: Role) => hasPermission(role, "EXECUTE_WORK_ORDERS");
export const canVerifyWorkOrders = (role: Role) => hasPermission(role, "VERIFY_WORK_ORDERS");
