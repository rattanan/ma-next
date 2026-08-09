import { redirect } from "next/navigation";
import OperationsDashboard from "@/components/dashboard/operations-dashboard";
import { WorkOrderStatus } from "@/generated/prisma/client";
import { getCurrentSession } from "@/lib/auth/session";
import { getDashboardData } from "@/lib/dashboard/service";

function safeDate(value: string | undefined, fallback: Date) {
  if (!value) return fallback;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (!session.user.permissions.includes("VIEW_DASHBOARD")) redirect("/profile?error=forbidden");
  const query = await searchParams;
  const now = new Date();
  const defaultFrom = new Date(now);
  defaultFrom.setDate(defaultFrom.getDate() - 29);
  const from = safeDate(typeof query.from === "string" ? query.from : undefined, defaultFrom);
  const to = safeDate(typeof query.to === "string" ? query.to : undefined, now);
  to.setHours(23, 59, 59, 999);
  const earliest = new Date(to);
  earliest.setDate(earliest.getDate() - 365);
  const boundedFrom = from > to ? defaultFrom : from < earliest ? earliest : from;
  const status = typeof query.status === "string" && Object.values(WorkOrderStatus).includes(query.status as WorkOrderStatus) ? query.status : undefined;
  const data = await getDashboardData(session.user, {
    from: boundedFrom,
    to,
    departmentId: typeof query.departmentId === "string" ? query.departmentId : undefined,
    siteId: typeof query.siteId === "string" ? query.siteId : undefined,
    status,
  });
  return <OperationsDashboard data={data} />;
}
