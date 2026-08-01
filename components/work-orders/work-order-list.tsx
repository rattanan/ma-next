"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Columns3, List, Plus, Search, TriangleAlert } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Order = { id: string; code: string; sourceType: string; workType: string; title: string; priority: string; severity: string; status: string; assetCode: string; assetName: string; departmentId: string | null; crewName: string | null; assignedTo: string | null; dueAt: string | null; updatedAt: string };
type Result = { items: Order[]; total: number; page: number; pageSize: number };
type Reference = { users: Array<{ id: string; fullName: string }>; departments: Array<{ id: string; name: string }> };
const statuses = ["OPEN", "BACKLOG", "IN_PROGRESS", "COMPLETION_PENDING", "VERIFIED", "CLOSED"];
const types = ["PREVENTIVE", "CORRECTIVE", "SHUTDOWN", "OTHER_ASSIGNMENT"];
const priorities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const title = (value: string) => value.toLowerCase().replaceAll("_", " ").replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
const date = (value: string | null) => value ? new Date(value).toLocaleDateString([], { dateStyle: "medium" }) : "Unscheduled";
const isOverdue = (item: Order) => Boolean(item.dueAt && new Date(item.dueAt) < new Date() && !["VERIFIED", "CLOSED"].includes(item.status));

function Pill({ value }: { value: string }) { return <Badge className={cn("border", value === "CRITICAL" || value === "BACKLOG" ? "border-red-200 bg-red-50 text-red-800" : value === "CLOSED" || value === "VERIFIED" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : value === "IN_PROGRESS" ? "border-blue-200 bg-blue-50 text-blue-800" : "border-slate-200 bg-slate-50 text-slate-700")}>{title(value)}</Badge>; }

export default function WorkOrderList({ permissions }: { permissions: string[] }) {
  const [data, setData] = useState<Result>({ items: [], total: 0, page: 1, pageSize: 20 });
  const [refs, setRefs] = useState<Reference>({ users: [], departments: [] });
  const [view, setView] = useState<"list" | "board" | "calendar">("list");
  const [filters, setFilters] = useState({ q: "", type: "", status: "", priority: "", departmentId: "", assignedTo: "", overdue: "", sort: "updatedAt", order: "desc", page: "1", pageSize: "20" });
  const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
      const [orders, reference] = await Promise.all([fetch(`/api/work-orders?${query}`).then(async (r) => { const b = await r.json(); if (!r.ok) throw new Error(b.error || "Unable to load work orders"); return b; }), fetch("/api/maintenance/overview").then((r) => r.json())]);
      setData(orders); setRefs({ users: reference.users ?? [], departments: reference.departments ?? [] });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load work orders"); }
    finally { setLoading(false); }
  }, [filters]);
  useEffect(() => { const timer = setTimeout(load, filters.q ? 250 : 0); return () => clearTimeout(timer); }, [load, filters.q]);
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const board = useMemo(() => statuses.map((status) => ({ status, items: data.items.filter((item) => item.status === status) })), [data.items]);
  const calendar = useMemo(() => Object.entries(data.items.reduce<Record<string, Order[]>>((groups, item) => {
    const key = item.dueAt?.slice(0, 10) || "Unscheduled";
    (groups[key] ??= []).push(item);
    return groups;
  }, {})).sort(([a], [b]) => a.localeCompare(b)), [data.items]);
  const setFilter = (name: keyof typeof filters, value: string) => setFilters((current) => ({ ...current, [name]: value, page: name === "page" ? value : "1" }));

  return <main className="mx-auto max-w-[96rem] space-y-5 p-4 md:p-6">
    <header className="flex flex-col gap-4 rounded-2xl border bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
      <div><p className="text-xs font-bold uppercase tracking-[.16em] text-blue-700">Maintenance operations</p><h1 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">Work Orders</h1><p className="mt-1 text-sm text-slate-600">Plan, execute and verify every job in one auditable workspace.</p></div>
      {permissions.includes("MANAGE_WORK_ORDERS") && <Button asChild className="min-h-11"><Link href="/work-orders/new"><Plus className="size-4" />Create Work Order</Link></Button>}
    </header>
    <Card><CardContent className="space-y-4 p-4">
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-7">
        <label className="relative md:col-span-2"><span className="sr-only">Search work orders</span><Search className="absolute left-3 top-3 size-4 text-slate-400" /><Input className="min-h-11 pl-9" value={filters.q} onChange={(e) => setFilter("q", e.target.value)} placeholder="WO number, title or asset" /></label>
        <Filter label="Type" value={filters.type} set={(v) => setFilter("type", v)} values={types} />
        <Filter label="Status" value={filters.status} set={(v) => setFilter("status", v)} values={statuses} />
        <Filter label="Priority" value={filters.priority} set={(v) => setFilter("priority", v)} values={priorities} />
        <select aria-label="Department" className="min-h-11 rounded-md border bg-white px-3 text-sm" value={filters.departmentId} onChange={(e) => setFilter("departmentId", e.target.value)}><option value="">All departments</option>{refs.departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        <select aria-label="Assignee" className="min-h-11 rounded-md border bg-white px-3 text-sm" value={filters.assignedTo} onChange={(e) => setFilter("assignedTo", e.target.value)}><option value="">All assignees</option>{refs.users.map((item) => <option key={item.id} value={item.id}>{item.fullName}</option>)}</select>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3"><div className="flex flex-wrap items-center gap-3"><label className="flex min-h-11 items-center gap-2 text-sm font-medium"><input type="checkbox" checked={filters.overdue === "true"} onChange={(e) => setFilter("overdue", e.target.checked ? "true" : "")} />Overdue only</label><select aria-label="Sort work orders" className="min-h-10 rounded-md border bg-white px-3 text-sm" value={filters.sort} onChange={(e) => setFilter("sort", e.target.value)}><option value="updatedAt">Recently updated</option><option value="dueAt">Due date</option><option value="code">Work order number</option><option value="priority">Priority</option><option value="status">Status</option></select><select aria-label="Sort direction" className="min-h-10 rounded-md border bg-white px-3 text-sm" value={filters.order} onChange={(e) => setFilter("order", e.target.value)}><option value="desc">Descending</option><option value="asc">Ascending</option></select></div><div className="flex gap-1 rounded-lg bg-slate-100 p-1" aria-label="View mode">{([['list', List], ['board', Columns3], ['calendar', CalendarDays]] as const).map(([mode, Icon]) => <button key={mode} aria-pressed={view === mode} onClick={() => setView(mode)} className={cn("flex min-h-10 items-center gap-2 rounded-md px-3 text-sm font-semibold", view === mode && "bg-white text-blue-700 shadow-sm")}><Icon className="size-4" />{title(mode)}</button>)}</div></div>
    </CardContent></Card>
    {error && <Alert variant="destructive" className="flex items-center justify-between gap-3"><span>{error}</span><Button variant="outline" onClick={load}>Retry</Button></Alert>}
    {loading ? <div className="space-y-3" aria-label="Loading work orders"><Skeleton className="h-20 rounded-xl" /><Skeleton className="h-20 rounded-xl" /><Skeleton className="h-20 rounded-xl" /></div> : data.items.length === 0 ? <Empty canCreate={permissions.includes("MANAGE_WORK_ORDERS")} /> : view === "list" ? <ListView items={data.items} /> : view === "board" ? <div className="grid gap-4 overflow-x-auto lg:grid-cols-3 2xl:grid-cols-6">{board.map((column) => <section key={column.status} className="min-w-64 rounded-xl border bg-slate-100/70 p-3"><div className="mb-3 flex items-center justify-between"><Pill value={column.status} /><span className="text-sm font-bold">{column.items.length}</span></div><div className="space-y-2">{column.items.map((item) => <OrderCard key={item.id} item={item} />)}{column.items.length === 0 && <p className="rounded-lg border border-dashed p-4 text-center text-xs text-slate-500">No work</p>}</div></section>)}</div> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{calendar.map(([day, items]) => <section key={day} className="rounded-xl border bg-white p-4"><h2 className="font-bold">{day === "Unscheduled" ? day : new Date(`${day}T00:00:00`).toLocaleDateString([], { dateStyle: "full" })}</h2><div className="mt-3 space-y-2">{items?.map((item) => <OrderCard key={item.id} item={item} />)}</div></section>)}</div>}
    {!loading && data.total > 0 && <footer className="flex flex-col gap-3 rounded-xl border bg-white p-3 text-sm sm:flex-row sm:items-center sm:justify-between"><span>Showing {(data.page - 1) * data.pageSize + 1}–{Math.min(data.total, data.page * data.pageSize)} of {data.total}</span><div className="flex items-center gap-2"><Button size="icon" variant="outline" aria-label="Previous page" disabled={data.page <= 1} onClick={() => setFilter("page", String(data.page - 1))}><ChevronLeft className="size-4" /></Button><span>Page {data.page} of {pages}</span><Button size="icon" variant="outline" aria-label="Next page" disabled={data.page >= pages} onClick={() => setFilter("page", String(data.page + 1))}><ChevronRight className="size-4" /></Button></div></footer>}
  </main>;
}

function Filter({ label, value, set, values }: { label: string; value: string; set: (value: string) => void; values: readonly string[] }) { return <select aria-label={label} className="min-h-11 rounded-md border bg-white px-3 text-sm" value={value} onChange={(e) => set(e.target.value)}><option value="">All {label.toLowerCase()}s</option>{values.map((item) => <option key={item} value={item}>{title(item)}</option>)}</select>; }
function OrderCard({ item }: { item: Order }) { return <Link href={`/work-orders/${item.id}`} className="block rounded-lg border bg-white p-3 shadow-sm transition hover:border-blue-300 hover:shadow"><div className="flex items-start justify-between gap-2"><strong className="text-sm text-blue-800">{item.code}</strong><Pill value={item.priority} /></div><h3 className="mt-2 line-clamp-2 font-semibold">{item.title}</h3><p className="mt-1 text-xs text-slate-500">{item.assetCode} · {item.assetName}</p><div className="mt-3 flex items-center justify-between gap-2"><Pill value={item.status} /><time className={cn("text-xs", isOverdue(item) && "font-bold text-red-700")}>{date(item.dueAt)}</time></div></Link>; }
function ListView({ items }: { items: Order[] }) { return <><div className="hidden overflow-hidden rounded-xl border bg-white md:block"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="p-3">Work Order</th><th className="p-3">Asset</th><th className="p-3">Type</th><th className="p-3">Priority</th><th className="p-3">Due</th><th className="p-3">Status</th></tr></thead><tbody>{items.map((item) => <tr key={item.id} className="border-t hover:bg-blue-50/40"><td className="p-3"><Link className="font-bold text-blue-700 hover:underline" href={`/work-orders/${item.id}`}>{item.code}</Link><span className="block max-w-md truncate text-slate-600">{item.title}</span></td><td className="p-3"><strong>{item.assetCode}</strong><span className="block text-xs text-slate-500">{item.assetName}</span></td><td className="p-3">{title(item.workType)}</td><td className="p-3"><Pill value={item.priority} /></td><td className={cn("p-3", isOverdue(item) && "font-bold text-red-700")}>{isOverdue(item) && <TriangleAlert className="mr-1 inline size-4" />}{date(item.dueAt)}</td><td className="p-3"><Pill value={item.status} /></td></tr>)}</tbody></table></div><div className="grid gap-3 md:hidden">{items.map((item) => <OrderCard key={item.id} item={item} />)}</div></>; }
function Empty({ canCreate }: { canCreate: boolean }) { return <section className="grid min-h-72 place-items-center rounded-xl border border-dashed bg-white p-8 text-center"><div><List className="mx-auto size-10 text-slate-400" /><h2 className="mt-3 text-lg font-bold">No matching work orders</h2><p className="mt-1 text-sm text-slate-600">Clear filters or create the first manual work order.</p>{canCreate && <Button asChild className="mt-5"><Link href="/work-orders/new"><Plus className="size-4" />Create Work Order</Link></Button>}</div></section>; }
