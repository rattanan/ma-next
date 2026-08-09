import WorkOrderList from "@/components/work-orders/work-order-list";
import { getCurrentSession } from "@/lib/auth/session";
const allowed = {
  status: new Set(["OPEN", "BACKLOG", "COMPLETION_PENDING", "VERIFIED", "CREATED", "ASSIGNED", "TECHNICIAN_ACCEPTED", "IN_PROGRESS", "WAITING_FOR_PARTS", "WAITING_FOR_VENDOR", "WAITING_FOR_ACCESS", "ON_HOLD", "TECHNICIAN_COMPLETED", "UNDER_MANAGER_REVIEW", "RETURNED_TO_TECHNICIAN", "MANAGER_APPROVED", "WAITING_FOR_OPERATOR_ACCEPTANCE", "OPERATOR_REJECTED", "OPERATOR_ACCEPTED", "CLOSED", "CANCELLED"]),
  priority: new Set(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  type: new Set(["PREVENTIVE", "CORRECTIVE", "SHUTDOWN", "OTHER_ASSIGNMENT"]),
};
export default async function WorkOrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [session, query] = await Promise.all([getCurrentSession(), searchParams]);
  const value = (name: keyof typeof allowed) => typeof query[name] === "string" && allowed[name].has(query[name]) ? query[name] : "";
  return <WorkOrderList permissions={session?.user.permissions ?? []} initialFilters={{ status: value("status"), priority: value("priority"), type: value("type"), overdue: query.overdue === "true" ? "true" : "" }} />;
}
