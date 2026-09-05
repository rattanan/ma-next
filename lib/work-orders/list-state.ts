export const statuses = ["OPEN", "BACKLOG", "COMPLETION_PENDING", "VERIFIED", "CREATED", "ASSIGNED", "TECHNICIAN_ACCEPTED", "IN_PROGRESS", "WAITING_FOR_PARTS", "WAITING_FOR_VENDOR", "WAITING_FOR_ACCESS", "ON_HOLD", "TECHNICIAN_COMPLETED", "UNDER_MANAGER_REVIEW", "RETURNED_TO_TECHNICIAN", "MANAGER_APPROVED", "WAITING_FOR_OPERATOR_ACCEPTANCE", "OPERATOR_REJECTED", "OPERATOR_ACCEPTED", "CLOSED", "CANCELLED"];
export const types = ["PREVENTIVE", "CORRECTIVE", "SHUTDOWN", "OTHER_ASSIGNMENT"];
export const priorities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

export const defaults = { q: "", type: "", status: "", priority: "", departmentId: "", assignedTo: "", overdue: "", sort: "updatedAt", order: "desc", page: "1", pageSize: "20", dateFrom: "", dateTo: "" };
export type ListFilters = typeof defaults;
export function readListFilters(query: URLSearchParams): ListFilters {
  const filters = { ...defaults };
  const choices: Record<string, readonly string[]> = { type: types, status: statuses, priority: priorities, overdue: ["true"], sort: ["updatedAt", "code", "dueAt", "priority", "status"], order: ["asc", "desc"] };
  for (const key of Object.keys(defaults) as (keyof ListFilters)[]) {
    const value = query.get(key);
    if (!value) continue;
    if (choices[key] && !choices[key].includes(value)) continue;
    if (["departmentId", "assignedTo"].includes(key) && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) continue;
    if (["page", "pageSize"].includes(key) && (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < 1 || (key === "pageSize" && Number(value) > 100))) continue;
    if (["dateFrom", "dateTo"].includes(key) && (!/^\d{4}-\d{2}-\d{2}T.*Z$/.test(value) || Number.isNaN(Date.parse(value)))) continue;
    filters[key] = key === "q" ? value.slice(0, 190) : value;
  }
  return filters;
}
export function listHref(filters: ListFilters, view: string = "list") {
  const query = new URLSearchParams(Object.entries(filters).filter(([key, value]) => value && value !== defaults[key as keyof ListFilters]));
  if (["board", "calendar"].includes(view)) query.set("view", view);
  return `/work-orders${query.size ? `?${query}` : ""}`;
}
export function safeListReturn(value: string | null) {
  if (!value || (value !== "/work-orders" && !value.startsWith("/work-orders?"))) return "/work-orders";
  const query = new URLSearchParams(value.split("?")[1]);
  return listHref(readListFilters(query), query.get("view") ?? "list");
}
