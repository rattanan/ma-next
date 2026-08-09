"use client";

import Link from "next/link";
import { Activity, AlertTriangle, ArrowRight, BellRing, Boxes, ClipboardCheck, ClipboardList, PackageSearch, RefreshCw, ShieldAlert, ShoppingCart, Wrench } from "lucide-react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageContainer, PageHeader } from "@/components/shared/page-header";
import { StatusBadge, humanizeStatus } from "@/components/shared/status-badge";
import type { DashboardData } from "@/lib/dashboard/service";
import { cn } from "@/lib/utils";

const toneClasses = {
  neutral: "border-slate-200 bg-white",
  info: "border-blue-200 bg-blue-50/40",
  warning: "border-amber-200 bg-amber-50/50",
  danger: "border-red-200 bg-red-50/50",
  success: "border-emerald-200 bg-emerald-50/40",
};

const roleTitles: Record<string, string> = {
  OPERATOR: "Operator workspace",
  MAINTENANCE_MANAGER: "Maintenance control center",
  TECHNICIAN: "My maintenance work",
  MAINTENANCE: "My maintenance work",
  WAREHOUSE_MANAGER: "Warehouse operations",
  PLANT_MANAGER: "Plant control center",
  PURCHASE: "Purchase operations",
  DEPARTMENT_MANAGER: "Department approvals",
  APPROVER: "My approval queue",
  ADMIN: "System operations",
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat("th-TH", { day: "2-digit", month: "short" }).format(new Date(`${value}T00:00:00`));
}

export default function OperationsDashboard({ data }: { data: DashboardData }) {
  const maxStatus = Math.max(1, ...data.workOrderStatuses.map((item) => item.count));
  const hasTrend = data.trend.some((item) => item.reported || item.closed);

  return <PageContainer className="max-w-[100rem] space-y-6 pb-12">
    <PageHeader eyebrow={roleTitles[data.role] ?? "Enterprise maintenance"} title="Dashboard" description="ภาพรวมงานซ่อม การอนุมัติ จัดซื้อ และ Inventory ตามสิทธิ์ที่คุณรับผิดชอบ" icon={<Activity className="size-5" />} metadata={<span>อัปเดตล่าสุด {formatDateTime(data.generatedAt)}</span>} actions={<Button asChild variant="outline"><Link href="/dashboard"><RefreshCw className="size-4" />รีเฟรช</Link></Button>} />

    <Card aria-label="Dashboard filters">
      <CardContent className="p-4">
        <form action="/dashboard" method="get" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[repeat(5,minmax(0,1fr))_auto]">
          <FilterField label="ตั้งแต่"><input name="from" type="date" defaultValue={data.filters.from} max={data.filters.to} className="dashboard-filter" /></FilterField>
          <FilterField label="ถึง"><input name="to" type="date" defaultValue={data.filters.to} min={data.filters.from} className="dashboard-filter" /></FilterField>
          <FilterField label="Department"><select name="departmentId" defaultValue={data.filters.departmentId} className="dashboard-filter"><option value="">ทุก Department</option>{data.filters.departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></FilterField>
          <FilterField label="Location / Site"><select name="siteId" defaultValue={data.filters.siteId} className="dashboard-filter"><option value="">ทุก Location</option>{data.filters.sites.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></FilterField>
          <FilterField label="Work status"><select name="status" defaultValue={data.filters.status} className="dashboard-filter"><option value="">ทุกสถานะ</option>{data.workOrderStatuses.map((item) => <option key={item.status} value={item.status}>{humanizeStatus(item.status)}</option>)}</select></FilterField>
          <div className="flex items-end gap-2"><Button type="submit" className="min-h-11 flex-1">ใช้ตัวกรอง</Button><Button asChild type="button" variant="ghost" className="min-h-11"><Link href="/dashboard">ล้าง</Link></Button></div>
        </form>
      </CardContent>
    </Card>

    <section aria-label="Key performance indicators" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
      {data.kpis.map((kpi) => <Link key={kpi.key} href={kpi.href} className={cn("group rounded-xl border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600", toneClasses[kpi.tone])}>
        <div className="flex items-start justify-between gap-3"><p className="text-sm font-semibold text-slate-600">{kpi.label}</p><ArrowRight className="size-4 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-blue-700" /></div>
        <p className="mt-3 text-3xl font-bold tracking-tight text-slate-950">{kpi.value ?? "—"}</p>
        <p className="mt-2 min-h-10 text-xs leading-5 text-slate-600">{kpi.detail}</p>
      </Link>)}
    </section>

    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,.85fr)]">
      <Card>
        <CardHeader><CardTitle>สถานะ Work Order</CardTitle><CardDescription>คลิกแต่ละสถานะเพื่อเปิดรายการที่กรองแล้ว</CardDescription></CardHeader>
        <CardContent>
          {data.workOrderStatuses.length ? <div className="space-y-3">{data.workOrderStatuses.map((item) => <Link key={item.status} href={item.href} className="group grid grid-cols-[minmax(8rem,13rem)_1fr_2.5rem] items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
            <span className="truncate text-sm font-semibold text-slate-700">{humanizeStatus(item.status)}</span>
            <span className="h-3 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-blue-600 transition-all group-hover:bg-blue-700" style={{ width: `${Math.max(4, (item.count / maxStatus) * 100)}%` }} /></span>
            <strong className="text-right text-sm tabular-nums">{item.count}</strong>
          </Link>)}</div> : <EmptyPanel title="ยังไม่มี Work Order ในช่วงที่เลือก" />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>รายการที่ต้องดำเนินการ</CardTitle><CardDescription>จัดลำดับจากวันครบกำหนดและการอัปเดตล่าสุด</CardDescription></CardHeader>
        <CardContent className="space-y-2">
          {data.actions.length ? data.actions.map((item) => <Link key={item.id} href={item.href} className="flex min-h-16 items-center gap-3 rounded-lg border p-3 transition hover:border-blue-300 hover:bg-blue-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-700"><ActionIcon kind={item.kind} /></span>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-blue-800">{item.reference}</span><span className="block truncate text-sm text-slate-700">{item.title}</span></span>
            <span className="shrink-0 text-right"><StatusBadge status={item.status} />{item.dueAt && <time className="mt-1 block text-[11px] text-slate-500">{formatDateTime(item.dueAt)}</time>}</span>
          </Link>) : <EmptyPanel title="ไม่มีรายการที่ต้องดำเนินการ" />}
        </CardContent>
      </Card>
    </div>

    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(20rem,.7fr)]">
      <Card>
        <CardHeader><CardTitle>แนวโน้มงานแจ้งซ่อม</CardTitle><CardDescription>งานแจ้งใหม่เทียบกับงานที่ปิดในช่วงเวลาที่เลือก</CardDescription></CardHeader>
        <CardContent>
          {hasTrend ? <Link href="/notifications" aria-label="Open maintenance notifications" className="block h-72 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
            <ResponsiveContainer width="100%" height="100%"><LineChart data={data.trend} margin={{ top: 8, right: 12, left: -24, bottom: 4 }}><CartesianGrid strokeDasharray="3 3" stroke="#d7e0e8" /><XAxis dataKey="date" tickFormatter={shortDate} minTickGap={24} fontSize={11} /><YAxis allowDecimals={false} fontSize={11} /><Tooltip labelFormatter={(label) => shortDate(String(label))} /><Legend /><Line type="monotone" dataKey="reported" name="แจ้งใหม่" stroke="#1464d2" strokeWidth={2.5} dot={false} /><Line type="monotone" dataKey="closed" name="ปิดงาน" stroke="#16835b" strokeWidth={2.5} dot={false} /></LineChart></ResponsiveContainer>
          </Link> : <EmptyPanel title="ยังไม่มีข้อมูลแนวโน้มในช่วงที่เลือก" />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recent activities</CardTitle><CardDescription>เหตุการณ์ล่าสุดในขอบเขตที่คุณมีสิทธิ์เห็น</CardDescription></CardHeader>
        <CardContent className="space-y-1">
          {data.recentActivities.length ? data.recentActivities.map((item) => <Link key={item.id} href={item.href} className="flex gap-3 rounded-lg px-2 py-3 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"><span className="mt-1 size-2 shrink-0 rounded-full bg-blue-600" /><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><strong className="text-sm">{item.title}</strong>{item.status && <StatusBadge status={item.status} />}</span><span className="mt-1 block truncate text-xs text-slate-600">{item.detail}</span><time className="mt-1 block text-[11px] text-slate-500">{formatDateTime(item.at)}</time></span></Link>) : <EmptyPanel title="ยังไม่มีกิจกรรมล่าสุด" />}
        </CardContent>
      </Card>
    </div>

    {data.lowStock.length > 0 && <Card>
      <CardHeader className="flex-row items-start justify-between gap-4"><div><CardTitle>Stock ต่ำกว่า Reorder Point</CardTitle><CardDescription>รายการจริงจากยอด On-hand ปัจจุบัน</CardDescription></div><Button asChild variant="outline"><Link href="/inventory/on-hand?stockStatus=LOW">ดูทั้งหมด<ArrowRight className="size-4" /></Link></Button></CardHeader>
      <CardContent><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{data.lowStock.slice(0, 6).map((item) => <Link key={item.id} href={`/inventory/items/${item.id}`} className="flex items-center gap-3 rounded-lg border p-3 hover:border-red-300 hover:bg-red-50/30"><PackageSearch className="size-5 shrink-0 text-red-700" /><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{item.code} · {item.name}</strong><span className="mt-1 block text-xs text-slate-600">On-hand {item.quantityOnHand} / Reorder {item.reorderPoint}</span></span><AlertTriangle className="size-4 shrink-0 text-red-600" /></Link>)}</div></CardContent>
    </Card>}
  </PageContainer>;
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) { return <label className="space-y-1.5"><span className="block text-xs font-bold text-slate-600">{label}</span>{children}</label>; }
function EmptyPanel({ title }: { title: string }) { return <div className="grid min-h-32 place-items-center rounded-lg border border-dashed bg-slate-50 p-6 text-center"><div><ClipboardList className="mx-auto size-7 text-slate-400" /><p className="mt-2 text-sm font-semibold text-slate-600">{title}</p></div></div>; }
function ActionIcon({ kind }: { kind: string }) {
  const Icon = kind === "APPROVAL" ? ClipboardCheck
    : kind === "INVENTORY_DOCUMENT" || kind === "STOCK_COUNT" ? Boxes
      : kind === "PURCHASE_ORDER" ? ShoppingCart
        : kind === "NOTIFICATION" ? BellRing
          : kind === "SYSTEM" ? ShieldAlert
            : Wrench;
  return <Icon className="size-4" aria-hidden="true" />;
}
