"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { defaults, listHref, readListFilters, statuses, types, priorities } from "@/lib/work-orders/list-state";
import { PageContainer, PageHeader } from "@/components/shared/page-header";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Columns3, List, Plus, Search, TriangleAlert } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PriorityBadge, StatusBadge } from "@/components/shared/status-badge";
import { cn } from "@/lib/utils";

type Order = { id: string; code: string; sourceType: string; workType: string; title: string; priority: string; severity: string; status: string; assetCode: string; assetName: string; departmentId: string | null; crewName: string | null; assignedTo: string | null; dueAt: string | null; updatedAt: string };
type Result = { items: Order[]; total: number; page: number; pageSize: number };
type Reference = { users: Array<{ id: string; fullName: string }>; departments: Array<{ id: string; name: string }> };
const title = (value: string) => value.toLowerCase().replaceAll("_", " ").replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
const date = (value: string | null) => value ? new Date(value).toLocaleDateString("th-TH", { dateStyle: "medium" }) : "ยังไม่กำหนด";
const isOverdue = (item: Order) => Boolean(item.dueAt && new Date(item.dueAt) < new Date() && !["VERIFIED", "CLOSED", "CANCELLED"].includes(item.status));

function Pill({ value }: { value: string }) { return priorities.includes(value) ? <PriorityBadge priority={value} /> : <StatusBadge status={value} />; }

export default function WorkOrderList({ permissions, currentUserId }: { permissions: string[]; currentUserId?: string }) {
  const search = useSearchParams();
  const queryString = search.toString();
  const filters = useMemo(() => readListFilters(new URLSearchParams(queryString)), [queryString]);
  const view = ["board", "calendar"].includes(search.get("view") ?? "") ? search.get("view")! : "list";
  const returnTo = listHref(filters, view);
  const [data, setData] = useState<Result>({ items: [], total: 0, page: 1, pageSize: 20 });
  const [refs, setRefs] = useState<Reference>({ users: [], departments: [] });
  const [referenceError, setReferenceError] = useState(false);
  const [retry, setลองใหม่] = useState(0);
  const [resolvedQuery, setResolvedQuery] = useState("");
  const [pending, setPending] = useState(true);
  const [error, setError] = useState("");
  const apiQuery = new URLSearchParams(Object.entries(filters).filter(([, value]) => value)).toString();
  const loading = pending || resolvedQuery !== apiQuery;
  const load = useCallback(() => setลองใหม่((value) => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setPending(true); setError("");
      try {
        const response = await fetch(`/api/work-orders?${apiQuery}`, { signal: controller.signal });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "โหลดรายการงานไม่สำเร็จ");
        if (!controller.signal.aborted) setData(body);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "โหลดรายการงานไม่สำเร็จ");
      } finally {
        if (!controller.signal.aborted) { setResolvedQuery(apiQuery); setPending(false); }
      }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [apiQuery, retry]);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/maintenance/overview", { signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error("Reference data unavailable");
      const body = await response.json();
      if (!controller.signal.aborted) { setRefs({ users: body.users ?? [], departments: body.departments ?? [] }); setReferenceError(false); }
    }).catch(() => { if (!controller.signal.aborted) setReferenceError(true); });
    return () => controller.abort();
  }, [retry]);
  useEffect(() => {
    if (loading || error) return;
    const frame = requestAnimationFrame(() => {
      try {
        const key = `wo-scroll:${returnTo}`;
        const stored = sessionStorage.getItem(key);
        if (stored !== null) { window.scrollTo(0, Number(stored) || 0); sessionStorage.removeItem(key); }
      } catch { /* Storage is optional; URL state still works. */ }
    });
    return () => cancelAnimationFrame(frame);
  }, [loading, error, returnTo]);
  const setView = (value: string) => window.history.replaceState(null, "", listHref(filters, value));
  const clearFilters = () => window.history.replaceState(null, "", listHref(defaults, view));
  const filtered = Object.entries(filters).some(([key, value]) => !["sort", "order", "page", "pageSize"].includes(key) && Boolean(value));
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const board = useMemo(() => statuses.map((status) => ({ status, items: data.items.filter((item) => item.status === status) })), [data.items]);
  const calendar = useMemo(() => Object.entries(data.items.reduce<Record<string, Order[]>>((groups, item) => {
    const key = item.dueAt?.slice(0, 10) || "ยังไม่กำหนด";
    (groups[key] ??= []).push(item);
    return groups;
  }, {})).sort(([a], [b]) => a.localeCompare(b)), [data.items]);
  const setFilter = (name: keyof typeof filters, value: string) => window.history.replaceState(null, "", listHref({ ...filters, [name]: value, page: name === "page" ? value : "1" }, view));

  return <PageContainer className="max-w-[96rem]">
    <PageHeader eyebrow="งานซ่อมบำรุง" title="ใบสั่งงานซ่อม" description="ค้นหางาน ติดตามกำหนดเสร็จ และเปิดงานเพื่อดำเนินการต่อ" icon={<List className="size-5" />} actions={permissions.includes("MANAGE_WORK_ORDERS") && <Button asChild><Link href="/work-orders/new"><Plus className="size-4" />สร้างใบสั่งงาน</Link></Button>} />
    <div className="flex flex-wrap gap-2 [&_button]:min-h-11" aria-label="มุมมองผู้รับผิดชอบ">
      <Button variant={!filters.assignedTo ? "default" : "outline"} aria-pressed={!filters.assignedTo} onClick={() => setFilter("assignedTo", "")}>ทุกผู้รับผิดชอบ</Button>
      {currentUserId && <Button variant={filters.assignedTo === currentUserId ? "default" : "outline"} aria-pressed={filters.assignedTo === currentUserId} onClick={() => setFilter("assignedTo", currentUserId)}>มอบหมายให้ฉัน</Button>}
    </div>
    <Card><CardContent className="space-y-4 p-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <label className="relative sm:col-span-2"><span className="sr-only">ค้นหาใบสั่งงาน</span><Search className="absolute left-3 top-3 size-4 text-slate-400" /><Input className="min-h-11 pl-9" value={filters.q} onChange={(e) => setFilter("q", e.target.value)} placeholder="ค้นหาเลขงาน ชื่องาน หรือเครื่องจักร" /></label>

        <Filter label="สถานะ" value={filters.status} set={(v) => setFilter("status", v)} values={statuses} />
        <Filter label="ความเร่งด่วน" value={filters.priority} set={(v) => setFilter("priority", v)} values={priorities} />

      </div>
      <details className="rounded-lg border bg-slate-50 p-3"><summary className="min-h-11 cursor-pointer text-sm font-semibold">ตัวกรองเพิ่มเติม{[filters.type, filters.departmentId, filters.assignedTo, filters.dateFrom, filters.dateTo].filter(Boolean).length ? " (มีเงื่อนไขที่ใช้อยู่)" : ""}</summary><div className="grid gap-3 sm:grid-cols-3">
        <Filter label="ประเภทงาน" value={filters.type} set={(v) => setFilter("type", v)} values={types} />
        <select aria-label="แผนก" className="min-h-11 rounded-md border bg-white px-3 text-sm" value={filters.departmentId} onChange={(e) => setFilter("departmentId", e.target.value)}><option value="">ทุกแผนก</option>{refs.departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        <select aria-label="ผู้รับผิดชอบ" className="min-h-11 rounded-md border bg-white px-3 text-sm" value={filters.assignedTo} onChange={(e) => setFilter("assignedTo", e.target.value)}><option value="">ทุกผู้รับผิดชอบ</option>{refs.users.map((item) => <option key={item.id} value={item.id}>{item.fullName}</option>)}</select>
      </div>{referenceError && <p role="status" className="mt-2 text-sm text-amber-800">โหลดตัวเลือกแผนกและผู้รับผิดชอบไม่สำเร็จ <button onClick={load} className="min-h-11 underline">ลองใหม่</button></p>}
      {(filters.dateFrom || filters.dateTo) && <p className="mt-2 text-sm">กำหนดเสร็จ: {date(filters.dateFrom || null)} – {date(filters.dateTo || null)} <button className="min-h-11 underline" onClick={() => window.history.replaceState(null, "", listHref({ ...filters, dateFrom: "", dateTo: "", page: "1" }, view))}>ล้างช่วงวันที่</button></p>}
      </details>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3"><div className="flex flex-wrap items-center gap-3"><label className="flex min-h-11 items-center gap-2 text-sm font-medium"><input type="checkbox" checked={filters.overdue === "true"} onChange={(e) => setFilter("overdue", e.target.checked ? "true" : "")} />เกินกำหนดเท่านั้น</label><select aria-label="เรียงรายการตาม" className="min-h-11 rounded-md border bg-white px-3 text-sm" value={filters.sort} onChange={(e) => setFilter("sort", e.target.value)}><option value="updatedAt">อัปเดตล่าสุด</option><option value="dueAt">กำหนดเสร็จ</option><option value="code">เลขใบสั่งงาน</option><option value="priority">ความเร่งด่วน</option><option value="status">สถานะ</option></select><select aria-label="ทิศทางการเรียง" className="min-h-11 rounded-md border bg-white px-3 text-sm" value={filters.order} onChange={(e) => setFilter("order", e.target.value)}><option value="desc">มากไปน้อย</option><option value="asc">น้อยไปมาก</option></select></div><div className="flex gap-1 rounded-lg bg-slate-100 p-1" aria-label="รูปแบบรายการ">{([['list', List], ['board', Columns3], ['calendar', CalendarDays]] as const).map(([mode, Icon]) => <button key={mode} aria-pressed={view === mode} onClick={() => setView(mode)} className={cn("flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-semibold", view === mode && "bg-white text-blue-700 shadow-sm")}><Icon className="size-4" />{{ list: "รายการ", board: "บอร์ด", calendar: "ปฏิทิน" }[mode]}</button>)}</div></div>
    </CardContent></Card>
    {filtered && <div className="flex flex-wrap items-center justify-between gap-2 text-sm"><p>กำลังแสดงรายการตามเงื่อนไขที่เลือก</p><Button variant="outline" onClick={clearFilters}>ล้างตัวกรองทั้งหมด</Button></div>}
    {view !== "list" && <p className="text-sm text-slate-600">บอร์ดและปฏิทินแสดงเฉพาะงานในหน้าปัจจุบัน ใช้ปุ่มเปลี่ยนหน้าเพื่อดูรายการเพิ่มเติม</p>}
    {error && <Alert variant="destructive" className="flex items-center justify-between gap-3"><span>{error}</span><Button variant="outline" onClick={load}>ลองใหม่</Button></Alert>}
    {loading ? <div className="space-y-3" aria-label="กำลังโหลดใบสั่งงาน"><Skeleton className="h-20 rounded-xl" /><Skeleton className="h-20 rounded-xl" /><Skeleton className="h-20 rounded-xl" /></div> : error ? null : data.items.length === 0 ? <Empty canCreate={permissions.includes("MANAGE_WORK_ORDERS")} filtered={filtered} clear={clearFilters} /> : view === "list" ? <ListView items={data.items} returnTo={returnTo} users={refs.users} /> : view === "board" ? <div className="flex snap-x gap-4 overflow-x-auto pb-3" aria-label="Work order status board">{board.map((column) => <section key={column.status} className="w-[17rem] shrink-0 snap-start rounded-xl border bg-slate-100/70 p-3 sm:w-72"><div className="mb-3 flex items-center justify-between gap-2"><Pill value={column.status} /><span className="shrink-0 text-sm font-bold">{column.items.length}</span></div><div className="space-y-2">{column.items.map((item) => <OrderCard key={item.id} item={item} returnTo={returnTo} users={refs.users} />)}{column.items.length === 0 && <p className="rounded-lg border border-dashed p-4 text-center text-xs text-slate-500">ไม่มีงานในหน้านี้</p>}</div></section>)}</div> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{calendar.map(([day, items]) => <section key={day} className="rounded-xl border bg-white p-4"><h2 className="font-bold">{day === "Unscheduled" ? "ยังไม่กำหนด" : new Date(`${day}T00:00:00`).toLocaleDateString("th-TH", { dateStyle: "full" })}</h2><div className="mt-3 space-y-2">{items?.map((item) => <OrderCard key={item.id} item={item} returnTo={returnTo} users={refs.users} />)}</div></section>)}</div>}
    {!loading && !error && data.total > 0 && <footer className="flex flex-col gap-3 rounded-xl border bg-white p-3 text-sm sm:flex-row sm:items-center sm:justify-between"><span>แสดง {(data.page - 1) * data.pageSize + 1}–{Math.min(data.total, data.page * data.pageSize)} จาก {data.total} รายการ</span><div className="flex items-center gap-2"><Button size="icon" variant="outline" aria-label="หน้าก่อนหน้า" disabled={data.page <= 1} onClick={() => setFilter("page", String(data.page - 1))}><ChevronLeft className="size-4" /></Button><span>หน้า {data.page} / {pages}</span><Button size="icon" variant="outline" aria-label="หน้าถัดไป" disabled={data.page >= pages} onClick={() => setFilter("page", String(data.page + 1))}><ChevronRight className="size-4" /></Button></div></footer>}
  </PageContainer>;
}

function Filter({ label, value, set, values }: { label: string; value: string; set: (value: string) => void; values: readonly string[] }) { return <select aria-label={label} className="min-h-11 rounded-md border bg-white px-3 text-sm" value={value} onChange={(e) => set(e.target.value)}><option value="">ทุก{label}</option>{values.map((item) => <option key={item} value={item}>{title(item)}</option>)}</select>; }
function OrderCard({ item, returnTo, users }: { item: Order; returnTo: string; users: Reference["users"] }) { return <Link href={`/work-orders/${item.id}?returnTo=${encodeURIComponent(returnTo)}`} onClick={() => rememberScroll(returnTo)} className="block min-w-0 overflow-hidden rounded-lg border bg-white p-3 shadow-sm transition hover:border-blue-300 hover:shadow"><div className="flex min-w-0 items-start justify-between gap-2"><strong className="min-w-0 truncate text-sm text-blue-800">{item.code}</strong><span className="shrink-0"><Pill value={item.priority} /></span></div><h3 className="mt-2 line-clamp-2 break-words font-semibold">{item.title}</h3><p className="mt-1 truncate text-xs text-slate-500" title={`${item.assetCode} · ${item.assetName}`}>{item.assetCode} · {item.assetName}</p><p className="mt-1 text-xs text-slate-500">ประเภท: {title(item.workType)}</p><p className="mt-2 text-xs text-slate-600">ผู้รับผิดชอบ: {assignee(item, users)}</p><div className="mt-3 flex flex-wrap items-center justify-between gap-2"><Pill value={item.status} /><time className={cn("shrink-0 text-xs", isOverdue(item) && "font-bold text-red-700")}>{date(item.dueAt)}</time></div></Link>; }
function ListView({ items, returnTo, users }: { items: Order[]; returnTo: string; users: Reference["users"] }) { return <><div className="hidden overflow-x-auto rounded-xl border bg-white lg:block"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="p-3">ใบสั่งงาน</th><th className="p-3">เครื่องจักร</th><th className="p-3">ผู้รับผิดชอบ</th><th className="p-3">ความเร่งด่วน</th><th className="p-3">กำหนดเสร็จ</th><th className="p-3">สถานะ</th></tr></thead><tbody>{items.map((item) => <tr key={item.id} className="border-t hover:bg-blue-50/40"><td className="p-3"><Link className="font-bold text-blue-700 hover:underline" href={`/work-orders/${item.id}?returnTo=${encodeURIComponent(returnTo)}`} onClick={() => rememberScroll(returnTo)}>{item.code}</Link><span className="block max-w-md truncate text-slate-600">{item.title}</span></td><td className="p-3"><strong>{item.assetCode}</strong><span className="block text-xs text-slate-500">{item.assetName}</span><span className="block text-xs text-slate-500">{title(item.workType)}</span></td><td className="p-3">{assignee(item, users)}</td><td className="p-3"><Pill value={item.priority} /></td><td className={cn("p-3", isOverdue(item) && "font-bold text-red-700")}>{isOverdue(item) && <TriangleAlert className="mr-1 inline size-4" />}{date(item.dueAt)}</td><td className="p-3"><Pill value={item.status} /></td></tr>)}</tbody></table></div><div className="grid gap-3 lg:hidden">{items.map((item) => <OrderCard key={item.id} item={item} returnTo={returnTo} users={users} />)}</div></>; }
function Empty({ canCreate, filtered, clear }: { canCreate: boolean; filtered: boolean; clear: () => void }) { return <section className="grid min-h-72 place-items-center rounded-xl border border-dashed bg-white p-8 text-center"><div><List className="mx-auto size-10 text-slate-400" /><h2 className="mt-3 text-lg font-bold">{filtered ? "ไม่พบงานตามเงื่อนไขที่เลือก" : "ยังไม่มีใบสั่งงานในขอบเขตนี้"}</h2><p className="mt-1 text-sm text-slate-600">{filtered ? "ลองเปลี่ยนคำค้นหาหรือล้างตัวกรอง" : "ใบสั่งงานที่คุณมีสิทธิ์ดูจะแสดงที่นี่"}</p>{filtered && <Button variant="outline" onClick={clear} className="mt-5">ล้างตัวกรอง</Button>}{canCreate && !filtered && <Button asChild className="mt-5"><Link href="/work-orders/new"><Plus className="size-4" />สร้างใบสั่งงาน</Link></Button>}</div></section>; }

function rememberScroll(href: string) { try { sessionStorage.setItem(`wo-scroll:${href}`, String(window.scrollY)); } catch { /* Optional browser storage. */ } }

function assignee(item: Order, users: Reference["users"]) { return users.find((user) => user.id === item.assignedTo)?.fullName ?? (item.assignedTo ? "มอบหมายแล้ว" : item.crewName || "ยังไม่มอบหมาย"); }
