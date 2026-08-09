import { Prisma } from "@/generated/prisma/client";
import type { AuthenticatedUser } from "@/lib/auth/session";
import { listApprovals, pendingApprovalCount } from "@/lib/approvals/service";
import { inventoryDashboard } from "@/lib/inventory/service";
import { prisma } from "@/lib/prisma";
import { isGlobalDashboardActor as isGlobalActor, scopedNotificationWhere, scopedWorkOrderWhere } from "./scope";

export type DashboardFilters = {
  from: Date;
  to: Date;
  departmentId?: string;
  siteId?: string;
  status?: string;
};

export type DashboardData = {
  generatedAt: string;
  role: string;
  filters: {
    from: string;
    to: string;
    departmentId: string;
    siteId: string;
    status: string;
    departments: Array<{ id: string; name: string }>;
    sites: Array<{ id: string; name: string }>;
  };
  kpis: Array<{
    key: string;
    label: string;
    value: number | null;
    detail: string;
    href: string;
    tone: "neutral" | "info" | "warning" | "danger" | "success";
  }>;
  workOrderStatuses: Array<{ status: string; count: number; href: string }>;
  trend: Array<{ date: string; reported: number; closed: number }>;
  recentActivities: Array<{ id: string; title: string; detail: string; at: string; href: string; status: string | null }>;
  actions: Array<{ id: string; kind: string; reference: string; title: string; status: string; dueAt: string | null; href: string }>;
  lowStock: Array<{ id: string; code: string; name: string; quantityOnHand: string; reorderPoint: string }>;
};

const terminalWorkStatuses = ["CLOSED", "CANCELLED"] as const;

function dateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function eachDay(from: Date, to: Date) {
  const days: string[] = [];
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);
  while (cursor <= end && days.length < 367) {
    days.push(dateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

function friendlyEvent(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

function workOrderListHref(status?: string, extra?: string) {
  const query = new URLSearchParams();
  if (status) query.set("status", status);
  if (extra) query.set(extra, "true");
  return `/work-orders${query.size ? `?${query}` : ""}`;
}

function actionStatuses(actor: AuthenticatedUser) {
  const roles = new Set([actor.role, ...(actor.roleCodes ?? [])]);
  if (roles.has("TECHNICIAN") || roles.has("MAINTENANCE")) return ["ASSIGNED", "TECHNICIAN_ACCEPTED", "IN_PROGRESS", "WAITING_FOR_PARTS", "WAITING_FOR_VENDOR", "WAITING_FOR_ACCESS", "ON_HOLD", "RETURNED_TO_TECHNICIAN"];
  if (roles.has("MAINTENANCE_MANAGER")) return ["CREATED", "TECHNICIAN_COMPLETED", "UNDER_MANAGER_REVIEW", "OPERATOR_REJECTED"];
  if (roles.has("OPERATOR")) return ["WAITING_FOR_OPERATOR_ACCEPTANCE", "OPERATOR_REJECTED"];
  return ["CREATED", "ASSIGNED", "IN_PROGRESS", "TECHNICIAN_COMPLETED", "UNDER_MANAGER_REVIEW", "WAITING_FOR_OPERATOR_ACCEPTANCE"];
}

function actionNotificationStatuses(actor: AuthenticatedUser) {
  const roles = new Set([actor.role, ...(actor.roleCodes ?? [])]);
  if (roles.has("OPERATOR")) return ["NEEDS_INFORMATION", "WAITING_FOR_OPERATOR_ACCEPTANCE", "OPERATOR_REJECTED", "READY_TO_CLOSE"];
  if (roles.has("MAINTENANCE_MANAGER")) return ["SUBMITTED", "UNDER_REVIEW", "OPERATOR_REJECTED"];
  return [];
}

function dashboardRole(actor: AuthenticatedUser) {
  const preferred = ["ADMIN", "PLANT_MANAGER", "WAREHOUSE_MANAGER", "PURCHASE", "DEPARTMENT_MANAGER", "APPROVER", "MAINTENANCE_MANAGER", "TECHNICIAN", "MAINTENANCE", "OPERATOR"];
  return preferred.find((role) => actor.role === role || actor.roleCodes?.includes(role)) ?? actor.role;
}

function hasRole(actor: AuthenticatedUser, role: string) {
  return actor.role === role || actor.roleCodes?.includes(role) === true;
}

function filterScopeWhere(actor: AuthenticatedUser) {
  const scopes = actor.scopes ?? [];
  const departmentWhere: Prisma.DepartmentWhereInput[] = [];
  const siteWhere: Prisma.SiteWhereInput[] = [];
  for (const scope of scopes) {
    if (scope.scopeType === "ORGANIZATION" && scope.organizationId) {
      departmentWhere.push({ organizationId: scope.organizationId });
      siteWhere.push({ organizationId: scope.organizationId });
    } else if (scope.scopeType === "SITE" && scope.siteId) {
      departmentWhere.push({ siteId: scope.siteId });
      siteWhere.push({ id: scope.siteId });
    } else if (scope.scopeType === "DEPARTMENT" && scope.departmentId) {
      departmentWhere.push({ id: scope.departmentId });
      if (scope.siteId) siteWhere.push({ id: scope.siteId });
    }
  }
  return { departmentWhere, siteWhere };
}

export async function getDashboardData(actor: AuthenticatedUser, filters: DashboardFilters): Promise<DashboardData> {
  const workWhere = scopedWorkOrderWhere(actor, filters);
  const notificationWhere = scopedNotificationWhere(actor, filters);
  const now = new Date();
  const openWhere: Prisma.WorkOrderWhereInput = { ...workWhere, status: { notIn: [...terminalWorkStatuses] } };
  const urgentWhere: Prisma.WorkOrderWhereInput = { ...workWhere, status: { notIn: [...terminalWorkStatuses] }, priority: { in: ["HIGH", "CRITICAL"] } };
  const overdueWhere: Prisma.WorkOrderWhereInput = { ...workWhere, status: { notIn: [...terminalWorkStatuses] }, dueAt: { lt: now } };
  const { departmentWhere, siteWhere } = filterScopeWhere(actor);
  const [departments, sites] = await Promise.all([
    prisma.department.findMany({
      where: { active: true, ...(!isGlobalActor(actor) ? { OR: departmentWhere.length ? departmentWhere : [{ id: "__NO_AUTHORIZED_DEPARTMENT__" }] } : {}) },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.site.findMany({
      where: { active: true, ...(!isGlobalActor(actor) ? { OR: siteWhere.length ? siteWhere : [{ id: "__NO_AUTHORIZED_SITE__" }] } : {}) },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const departmentIds = departments.map((department) => department.id);
  const siteIds = sites.map((site) => site.id);
  const canInventory = actor.permissions.includes("VIEW_INVENTORY");
  const poScope: Prisma.PurchaseOrderWhereInput = {
    AND: [
      ...(filters.departmentId ? [{ departmentId: filters.departmentId }] : []),
      ...(filters.siteId ? [{ siteId: filters.siteId }] : []),
      ...(!isGlobalActor(actor) ? [{
        OR: [
          ...(departmentIds.length ? [{ departmentId: { in: departmentIds } }] : []),
          ...(siteIds.length ? [{ siteId: { in: siteIds } }] : []),
          ...(!departmentIds.length && !siteIds.length ? [{ id: "__NO_AUTHORIZED_SCOPE__" }] : []),
        ],
      }] : []),
    ],
  };

  const inventoryDocumentScope: Prisma.InventoryDocumentWhereInput = {
    ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
    ...(filters.siteId ? { siteId: filters.siteId } : {}),
    ...(!isGlobalActor(actor) ? {
      OR: [
        ...(departmentIds.length ? [{ departmentId: { in: departmentIds } }] : []),
        ...(siteIds.length ? [{ siteId: { in: siteIds } }] : []),
        { requesterId: actor.id },
      ],
    } : {}),
  };
  const stockCountScope: Prisma.StockCountWhereInput = {
    AND: [
      ...(filters.siteId ? [{ siteId: filters.siteId }] : []),
      ...(!isGlobalActor(actor) ? [siteIds.length ? { siteId: { in: siteIds } } : { id: "__NO_AUTHORIZED_SCOPE__" }] : []),
    ],
  };

  const showApprovalQueue = actor.permissions.includes("VIEW_APPROVAL_CENTER");
  const showWarehouseQueue = hasRole(actor, "WAREHOUSE_MANAGER") && canInventory;
  const showPlantQueue = hasRole(actor, "PLANT_MANAGER") && canInventory;
  const showPurchaseQueue = hasRole(actor, "PURCHASE") && canInventory;
  const showAdminQueue = hasRole(actor, "ADMIN");

  const notificationStatuses = actionNotificationStatuses(actor);
  const [pendingWork, urgentWork, overdueWork, statusGroups, notifications, recentWork, actionWork, actionNotifications, approvalCount, approvalQueue, inventory, poPending, inventoryDocumentQueue, stockCountQueue, purchaseOrderQueue, failedLoginCount] = await Promise.all([
    prisma.workOrder.count({ where: openWhere }),
    prisma.workOrder.count({ where: urgentWhere }),
    prisma.workOrder.count({ where: overdueWhere }),
    prisma.workOrder.groupBy({ by: ["status"], where: workWhere, _count: { _all: true }, orderBy: { status: "asc" } }),
    prisma.maintenanceNotification.findMany({ where: notificationWhere, select: { createdAt: true, closedAt: true }, orderBy: { createdAt: "asc" } }),
    prisma.workOrder.findMany({ where: workWhere, select: { id: true }, orderBy: { updatedAt: "desc" }, take: 250 }),
    prisma.workOrder.findMany({ where: { ...openWhere, status: { in: actionStatuses(actor) as Prisma.EnumWorkOrderStatusFilter["in"] } }, select: { id: true, code: true, title: true, status: true, dueAt: true }, orderBy: [{ dueAt: "asc" }, { updatedAt: "desc" }], take: 8 }),
    notificationStatuses.length ? prisma.maintenanceNotification.findMany({ where: { ...notificationWhere, status: { in: notificationStatuses as Prisma.EnumMaintenanceNotificationStatusFilter["in"] } }, select: { id: true, code: true, title: true, status: true, dueAt: true }, orderBy: [{ dueAt: "asc" }, { updatedAt: "desc" }], take: 6 }) : Promise.resolve([]),
    actor.permissions.includes("VIEW_APPROVAL_CENTER") ? pendingApprovalCount(actor) : Promise.resolve(0),
    showApprovalQueue ? listApprovals({ tab: "pending", search: "", sort: "waiting", page: 1, pageSize: 8 }, actor) : Promise.resolve(null),
    canInventory ? inventoryDashboard(actor) : Promise.resolve(null),
    canInventory ? prisma.purchaseOrder.count({ where: { ...poScope, status: { in: ["APPROVED", "PARTIAL_RECEIVED"] } } }) : Promise.resolve(0),
    showWarehouseQueue ? prisma.inventoryDocument.findMany({ where: { ...inventoryDocumentScope, status: "PENDING_WAREHOUSE_MANAGER" }, select: { id: true, documentNumber: true, documentType: true, status: true, documentDate: true }, orderBy: { updatedAt: "asc" }, take: 8 }) : Promise.resolve([]),
    showPlantQueue ? prisma.stockCount.findMany({ where: { ...stockCountScope, status: "PENDING_PLANT_MANAGER" }, select: { id: true, countNumber: true, countType: true, status: true, countDate: true }, orderBy: { updatedAt: "asc" }, take: 8 }) : Promise.resolve([]),
    showPurchaseQueue ? prisma.purchaseOrder.findMany({ where: { ...poScope, status: { in: ["PENDING_APPROVAL", "APPROVED", "PARTIAL_RECEIVED"] } }, select: { id: true, orderNumber: true, status: true, expectedDeliveryDate: true, vendor: { select: { name: true } } }, orderBy: [{ expectedDeliveryDate: "asc" }, { updatedAt: "asc" }], take: 8 }) : Promise.resolve([]),
    showAdminQueue ? prisma.loginHistory.count({ where: { status: { in: ["FAILED", "LOCKED"] }, createdAt: { gte: filters.from, lte: filters.to } } }) : Promise.resolve(0),
  ]);

  const workIds = recentWork.map((row) => row.id);
  const eventRows = workIds.length ? await prisma.workOrderEvent.findMany({ where: { workOrderId: { in: workIds } }, select: { id: true, workOrderId: true, eventType: true, toStatus: true, actorUserId: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 10 }) : [];
  const [eventOrders, eventActors] = await Promise.all([
    eventRows.length ? prisma.workOrder.findMany({ where: { id: { in: eventRows.map((row) => row.workOrderId) } }, select: { id: true, code: true, title: true } }) : [],
    eventRows.length ? prisma.user.findMany({ where: { id: { in: [...new Set(eventRows.map((row) => row.actorUserId))] } }, select: { id: true, fullName: true } }) : [],
  ]);
  const orderMap = new Map(eventOrders.map((row) => [row.id, row]));
  const actorMap = new Map(eventActors.map((row) => [row.id, row.fullName]));

  const trendMap = new Map(eachDay(filters.from, filters.to).map((date) => [date, { date, reported: 0, closed: 0 }]));
  for (const notification of notifications) {
    const created = trendMap.get(dateKey(notification.createdAt));
    if (created) created.reported += 1;
    if (notification.closedAt) {
      const closed = trendMap.get(dateKey(notification.closedAt));
      if (closed) closed.closed += 1;
    }
  }

  const lowStock = inventory?.lowStock ?? [];
  const stockCountPending = inventory?.metrics.pendingCounts ?? 0;
  const roleDetail = actor.role.replaceAll("_", " ").toLowerCase();
  const actionCandidates: DashboardData["actions"] = [
    ...(approvalQueue?.items ?? []).map((item) => ({ id: `approval-${item.id}`, kind: "APPROVAL", reference: item.referenceNumber, title: item.title, status: item.status, dueAt: null, href: "/approvals?tab=pending" })),
    ...inventoryDocumentQueue.map((item) => ({ id: `inventory-${item.id}`, kind: "INVENTORY_DOCUMENT", reference: item.documentNumber, title: `${friendlyEvent(item.documentType)} waiting for warehouse approval`, status: item.status, dueAt: item.documentDate.toISOString(), href: "/approvals?tab=pending&type=INVENTORY" })),
    ...stockCountQueue.map((item) => ({ id: `count-${item.id}`, kind: "STOCK_COUNT", reference: item.countNumber, title: `${friendlyEvent(item.countType)} waiting for plant approval`, status: item.status, dueAt: item.countDate.toISOString(), href: "/approvals?tab=pending&type=INVENTORY" })),
    ...purchaseOrderQueue.map((item) => ({ id: `po-${item.id}`, kind: "PURCHASE_ORDER", reference: item.orderNumber, title: item.vendor.name, status: item.status, dueAt: item.expectedDeliveryDate?.toISOString() ?? null, href: item.status === "PENDING_APPROVAL" ? "/approvals?tab=pending" : "/inventory/po-receipts" })),
    ...(failedLoginCount > 0 ? [{ id: "system-login-anomalies", kind: "SYSTEM", reference: "Security", title: `${failedLoginCount} failed or locked login events`, status: "ATTENTION", dueAt: null, href: "/admin/login-history" }] : []),
    ...actionNotifications.map((row) => ({ id: `notification-${row.id}`, kind: "NOTIFICATION", reference: row.code, title: row.title, status: row.status, dueAt: row.dueAt?.toISOString() ?? null, href: `/maintenance/workflow?notificationId=${row.id}` })),
    ...actionWork.map((row) => ({ id: `work-${row.id}`, kind: "WORK_ORDER", reference: row.code, title: row.title, status: row.status, dueAt: row.dueAt?.toISOString() ?? null, href: `/work-orders/${row.id}` })),
  ];
  return {
    generatedAt: new Date().toISOString(),
    role: dashboardRole(actor),
    filters: { from: dateKey(filters.from), to: dateKey(filters.to), departmentId: filters.departmentId ?? "", siteId: filters.siteId ?? "", status: filters.status ?? "", departments, sites },
    kpis: [
      { key: "pending-work", label: "งานค้าง", value: pendingWork, detail: `${overdueWork} งานเกินกำหนด`, href: workOrderListHref(), tone: overdueWork ? "warning" : "info" },
      { key: "urgent", label: "งานเร่งด่วน", value: urgentWork, detail: "Priority สูงและวิกฤต", href: "/work-orders?priority=HIGH", tone: urgentWork ? "danger" : "neutral" },
      { key: "approvals", label: "รออนุมัติ", value: approvalCount, detail: `คิวของ ${roleDetail}`, href: "/approvals?tab=pending", tone: approvalCount ? "warning" : "success" },
      { key: "pr", label: "PR ค้าง", value: null, detail: "ยังไม่มี PR model ในระบบปัจจุบัน", href: "/approvals?tab=pending", tone: "neutral" },
      { key: "po", label: "PO ค้างรับ", value: canInventory ? poPending : null, detail: "Approved / Partial Received", href: "/inventory/po-receipts", tone: poPending ? "warning" : "neutral" },
      { key: "low-stock", label: "Stock ต่ำ", value: canInventory ? (inventory?.metrics.lowStockCount ?? 0) : null, detail: canInventory ? `${stockCountPending} stock count รออนุมัติ` : "ไม่มีสิทธิ์ดู Inventory", href: "/inventory/on-hand?stockStatus=LOW", tone: lowStock.length ? "danger" : "neutral" },
    ],
    workOrderStatuses: statusGroups.map((row) => ({ status: row.status, count: row._count._all, href: workOrderListHref(row.status) })),
    trend: [...trendMap.values()],
    recentActivities: eventRows.map((event) => {
      const order = orderMap.get(event.workOrderId);
      return { id: event.id, title: friendlyEvent(event.eventType), detail: `${order?.code ?? "Work order"} · ${actorMap.get(event.actorUserId) ?? "System"}`, at: event.createdAt.toISOString(), href: `/work-orders/${event.workOrderId}`, status: event.toStatus };
    }),
    actions: actionCandidates.slice(0, 8),
    lowStock,
  };
}
