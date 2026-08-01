"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle, ChevronDown, ChevronRight, FileText, Filter, FolderTree,
  ImageIcon, MapPin, Menu, PackageSearch, RefreshCw, Search, ShieldX, Wrench,
} from "lucide-react";
import { AssetQrDialog } from "./asset-qr-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type AssetNode = {
  id: string; code: string; name: string; description: string | null; parentAssetId: string | null;
  structureLevel: "SYSTEM" | "EQUIPMENT" | "COMPONENT"; location: string; criticality: string; status: string;
  assetTypeId: string; assetCategoryId: string | null; typeCode: string; typeName: string;
  categoryCode: string | null; categoryName: string | null; primaryImagePath: string | null;
  serialNumber: string | null; inventoryLocationName: string | null;
};
type ListPayload = { assets: AssetNode[]; resultIds: string[]; visibleIds: string[]; assetTypes: Array<{ id: string; code: string; name: string }>; assetCategories: Array<{ id: string; code: string; name: string }> };
type DetailPayload = {
  asset: AssetNode & Record<string, unknown> & { unit: string | null; maintenanceInterval: number | null; runningHourCode: string | null; budgetId: string | null; gpsCoordinates: string | null; ownerName: string | null; createdByName: string | null; updatedByName: string | null; createdAt: string; updatedAt: string; legacySourceId: number | null; costCenterLegacyId: number | null; budgetReferenceLegacyId: number | null; inventoryLocationLegacyId: number | null };
  parent: AssetNode | null; children: AssetNode[];
  hierarchyLinks: Array<{ id: string; sequence: number; enabled: boolean; quantity: string; note: string | null; asset: AssetNode | null }>;
  spareParts: Array<{ id: string; sequence: number; enabled: boolean; requiredQuantity: string; note: string | null; code: string; name: string; description: string | null; unit: string | null; availableQuantity: string | null }>;
  customFields: Array<{ id: string | null; definitionId: string; value: string | null; label: string; description: string | null; fieldType: string; unit: string | null; defaultValue: string | null; groupId: string; groupName: string }>;
  documents: Array<{ id: string; originalName: string; contentType: string; byteSize: number; storageKey: string; driver: string; createdAt: string; note: string | null }>;
  history: Array<{ id: string; action: string; description: string | null; actorName: string | null; result: string; createdAt: string }>;
  workOrders: Array<{ id: string; code: string; title: string; description: string; priority: string; status: string; assignedToName: string | null; dueAt: string | null; updatedAt: string }>;
  contract: null | { code: string; name: string; contractNumber: string | null; description: string | null; vendorName: string | null; contactName: string | null; telephone: string | null; signedAt: string | null; startsAt: string | null; endsAt: string | null; amount: string | null; terms: string | null; legacySourceId: number | null };
};

const tabs = ["general", "hierarchy", "spare-parts", "documents", "history", "work-orders"] as const;
type Tab = (typeof tabs)[number];

function statusTone(status: string) { return status === "ACTIVE" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : status === "OFFLINE" ? "border-slate-300 bg-slate-100 text-slate-700" : status === "RESERVED" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-rose-200 bg-rose-50 text-rose-800"; }
function title(value: string) { return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function show(value: unknown) { if (value === null || value === undefined || value === "") return "—"; return String(value); }
function date(value: unknown) { if (!value) return "—"; return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(String(value))); }
function bytes(value: number) { if (value < 1024) return `${value} B`; if (value < 1048576) return `${(value / 1024).toFixed(1)} KB`; return `${(value / 1048576).toFixed(1)} MB`; }

function StatePanel({ kind, title: heading, message, retry }: { kind: "error" | "empty" | "permission"; title: string; message: string; retry?: () => void }) {
  const Icon = kind === "permission" ? ShieldX : kind === "empty" ? PackageSearch : AlertCircle;
  return <div className="grid min-h-72 place-items-center rounded-2xl border border-dashed bg-white p-6 text-center"><div className="max-w-md"><Icon className="mx-auto mb-4 size-10 text-slate-400" /><h2 className="text-lg font-bold">{heading}</h2><p className="mt-2 text-sm text-slate-600">{message}</p>{retry && <Button className="mt-5" onClick={retry}><RefreshCw className="size-4" /> Try again</Button>}</div></div>;
}

function TreeNode({ node, assets, visible, selectedId, resultIds, onSelect, depth = 0 }: { node: AssetNode; assets: AssetNode[]; visible: Set<string>; selectedId: string | null; resultIds: Set<string>; onSelect: (id: string) => void; depth?: number }) {
  const children = assets.filter((item) => item.parentAssetId === node.id && visible.has(item.id));
  const [open, setOpen] = useState(true);
  return <li>
    <div className={cn("group flex min-h-11 items-center rounded-xl", selectedId === node.id && "bg-blue-50") } style={{ paddingLeft: `${Math.min(depth, 5) * 14}px` }}>
      {children.length ? <button type="button" aria-label={`${open ? "Collapse" : "Expand"} ${node.name}`} aria-expanded={open} onClick={() => setOpen((value) => !value)} className="grid size-10 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">{open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}</button> : <span className="w-10 shrink-0" />}
      <button type="button" onClick={() => onSelect(node.id)} className="min-w-0 flex-1 rounded-lg py-2 pr-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
        <span className="flex items-center gap-2"><span className={cn("truncate text-sm font-semibold", !resultIds.has(node.id) && "text-slate-500")}>{node.code}</span><span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">{node.structureLevel[0]}</span></span>
        <span className="block truncate text-xs text-slate-500">{node.name}</span>
      </button>
    </div>
    {open && children.length > 0 && <ul>{children.map((child) => <TreeNode key={child.id} node={child} assets={assets} visible={visible} selectedId={selectedId} resultIds={resultIds} onSelect={onSelect} depth={depth + 1} />)}</ul>}
  </li>;
}

function AssetNavigator({ data, selectedId, onSelect, mode, onMode }: { data: ListPayload; selectedId: string | null; onSelect: (id: string) => void; mode: "tree" | "list"; onMode: (mode: "tree" | "list") => void }) {
  const visible = new Set(data.visibleIds); const results = new Set(data.resultIds);
  const roots = data.assets.filter((item) => (!item.parentAssetId || !data.assets.some((candidate) => candidate.id === item.parentAssetId)) && visible.has(item.id));
  return <div className="flex h-full min-h-0 flex-col">
    <div className="flex items-center justify-between border-b px-4 py-3"><div><h2 className="font-bold">Asset register</h2><p className="text-xs text-slate-500">{data.resultIds.length} matching · {data.assets.length} total</p></div><div className="flex rounded-lg bg-slate-100 p-1"><button type="button" aria-pressed={mode === "tree"} onClick={() => onMode("tree")} className={cn("min-h-9 rounded-md px-2 text-xs font-bold", mode === "tree" && "bg-white shadow-sm")}>Tree</button><button type="button" aria-pressed={mode === "list"} onClick={() => onMode("list")} className={cn("min-h-9 rounded-md px-2 text-xs font-bold", mode === "list" && "bg-white shadow-sm")}>List</button></div></div>
    <div className="min-h-0 flex-1 overflow-y-auto p-2">
      {data.resultIds.length === 0 ? <p className="p-6 text-center text-sm text-slate-500">No assets match these filters.</p> : mode === "tree" ? <ul>{roots.map((root) => <TreeNode key={root.id} node={root} assets={data.assets} visible={visible} selectedId={selectedId} resultIds={results} onSelect={onSelect} />)}</ul> : <div className="space-y-1">{data.assets.filter((item) => results.has(item.id)).map((item) => <button key={item.id} type="button" onClick={() => onSelect(item.id)} className={cn("flex min-h-14 w-full items-center justify-between rounded-xl px-3 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600", selectedId === item.id && "bg-blue-50")}><span className="min-w-0"><strong className="block truncate text-sm">{item.code}</strong><span className="block truncate text-xs text-slate-500">{item.name}</span></span><span className="ml-2 text-[10px] font-bold text-slate-400">{title(item.structureLevel)}</span></button>)}</div>}
    </div>
  </div>;
}

function Filters({ query, setQuery, filters, setFilter, data }: { query: string; setQuery: (value: string) => void; filters: Record<string, string>; setFilter: (key: string, value: string) => void; data: ListPayload | null }) {
  return <section aria-label="Asset search and filters" className="rounded-2xl border bg-white p-3 shadow-sm">
    <div className="grid gap-2 md:grid-cols-[minmax(15rem,1fr)_repeat(4,minmax(8rem,0.45fr))_auto]">
      <label className="relative"><span className="sr-only">Search assets</span><Search className="pointer-events-none absolute left-3 top-3 size-4 text-slate-400" /><Input value={query} onChange={(event) => setQuery(event.target.value)} className="min-h-11 pl-9" placeholder="Search KKS, name, serial, location…" /></label>
      <FilterSelect label="Status" value={filters.status} onChange={(value) => setFilter("status", value)} options={["ACTIVE", "OFFLINE", "RESERVED", "INACTIVE", "RETIRED"].map((value) => ({ value, label: title(value) }))} />
      <FilterSelect label="Structure" value={filters.level} onChange={(value) => setFilter("level", value)} options={["SYSTEM", "EQUIPMENT", "COMPONENT"].map((value) => ({ value, label: title(value) }))} />
      <FilterSelect label="Type" value={filters.type} onChange={(value) => setFilter("type", value)} options={(data?.assetTypes ?? []).map((value) => ({ value: value.id, label: value.name }))} />
      <FilterSelect label="Category" value={filters.category} onChange={(value) => setFilter("category", value)} options={(data?.assetCategories ?? []).map((value) => ({ value: value.id, label: value.name }))} />
      <Button variant="ghost" className="min-h-11" onClick={() => { setQuery(""); for (const key of Object.keys(filters)) setFilter(key, ""); }}><Filter className="size-4" /> Clear</Button>
    </div>
  </section>;
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  return <Select value={value || "ALL"} onValueChange={(next) => onChange(next === "ALL" ? "" : next)}><SelectTrigger className="min-h-11 w-full" aria-label={`Filter by ${label.toLowerCase()}`}><SelectValue placeholder={label} /></SelectTrigger><SelectContent><SelectItem value="ALL">All {label.toLowerCase()}s</SelectItem>{options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select>;
}

function DetailSkeleton() { return <div className="space-y-4" aria-label="Loading asset detail"><Skeleton className="h-40 rounded-2xl" /><Skeleton className="h-12 rounded-xl" /><Skeleton className="h-80 rounded-2xl" /></div>; }
function InfoGrid({ entries }: { entries: Array<[string, unknown]> }) { return <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">{entries.map(([label, value]) => <div key={label} className="min-w-0 border-b border-slate-100 pb-3"><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm font-medium text-slate-900">{show(value)}</dd></div>)}</dl>; }
function EmptyTab({ icon: Icon, title: heading, message }: { icon: typeof FileText; title: string; message: string }) { return <div className="grid min-h-56 place-items-center rounded-xl border border-dashed p-6 text-center"><div><Icon className="mx-auto mb-3 size-8 text-slate-350" /><h3 className="font-bold">{heading}</h3><p className="mt-1 text-sm text-slate-500">{message}</p></div></div>; }

function AssetImage({ detail }: { detail: DetailPayload }) {
  const imageDocument = detail.documents.find((document) => document.contentType.startsWith("image/") && (/^https?:/.test(document.storageKey) || document.storageKey.startsWith("/")));
  const src = detail.asset.primaryImagePath && (/^https?:/.test(detail.asset.primaryImagePath) || detail.asset.primaryImagePath.startsWith("/")) ? detail.asset.primaryImagePath : imageDocument?.storageKey;
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <div className="grid aspect-[4/3] w-full place-items-center rounded-2xl bg-slate-100 text-slate-400"><div className="text-center"><ImageIcon className="mx-auto size-9" /><span className="mt-2 block text-xs">No image preview</span></div></div>;
  // Legacy and managed attachment drivers provide runtime URLs that cannot be known to Next Image at build time.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} onError={() => setFailed(true)} alt={`${detail.asset.name} asset`} className="aspect-[4/3] w-full rounded-2xl bg-slate-100 object-cover" />;
}

function GeneralTab({ detail }: { detail: DetailPayload }) {
  const groups = [...new Map(detail.customFields.map((field) => [field.groupId, field.groupName])).entries()];
  return <div className="space-y-4">
    <Card><CardHeader><CardTitle>Identity and classification</CardTitle></CardHeader><CardContent><InfoGrid entries={[["KKS / asset code", detail.asset.code], ["Name", detail.asset.name], ["Description", detail.asset.description], ["Structure", title(detail.asset.structureLevel)], ["Type", detail.asset.typeName], ["Category", detail.asset.categoryName], ["Status", title(detail.asset.status)], ["Criticality", title(detail.asset.criticality)], ["Unit", detail.asset.unit], ["Serial number", detail.asset.serialNumber]]} /></CardContent></Card>
    <Card><CardHeader><CardTitle>Location, ownership, and maintenance</CardTitle></CardHeader><CardContent><InfoGrid entries={[["Location", detail.asset.location], ["Inventory location", detail.asset.inventoryLocationName], ["Legacy location ID", detail.asset.inventoryLocationLegacyId], ["GPS coordinates", detail.asset.gpsCoordinates], ["Assigned to", detail.asset.ownerName], ["Maintenance interval", detail.asset.maintenanceInterval], ["Runtime-hour KKS", detail.asset.runningHourCode], ["Budget ID", detail.asset.budgetId], ["Cost center legacy ID", detail.asset.costCenterLegacyId], ["Budget reference legacy ID", detail.asset.budgetReferenceLegacyId]]} /></CardContent></Card>
    {detail.contract && <Card><CardHeader><CardTitle>Linked contract</CardTitle></CardHeader><CardContent><InfoGrid entries={[["Contract", `${detail.contract.code} · ${detail.contract.name}`], ["Contract number", detail.contract.contractNumber], ["Vendor", detail.contract.vendorName], ["Contact", detail.contract.contactName], ["Telephone", detail.contract.telephone], ["Signed", date(detail.contract.signedAt)], ["Starts", date(detail.contract.startsAt)], ["Ends", date(detail.contract.endsAt)], ["Amount", detail.contract.amount], ["Description", detail.contract.description], ["Terms", detail.contract.terms], ["Legacy contract ID", detail.contract.legacySourceId]]} /></CardContent></Card>}
    {groups.map(([groupId, groupName]) => <Card key={groupId}><CardHeader><CardTitle>{groupName}</CardTitle></CardHeader><CardContent><InfoGrid entries={detail.customFields.filter((field) => field.groupId === groupId).map((field) => [field.label, `${show(field.value ?? field.defaultValue)}${field.unit ? ` ${field.unit}` : ""} · ${title(field.fieldType)}`])} /></CardContent></Card>)}
    <Card><CardHeader><CardTitle>Record metadata</CardTitle></CardHeader><CardContent><InfoGrid entries={[["Legacy asset ID", detail.asset.legacySourceId], ["Created", date(detail.asset.createdAt)], ["Created by", detail.asset.createdByName], ["Updated", date(detail.asset.updatedAt)], ["Updated by", detail.asset.updatedByName], ["Primary image path", detail.asset.primaryImagePath]]} /></CardContent></Card>
  </div>;
}

function HierarchyTab({ detail, assets }: { detail: DetailPayload; assets: AssetNode[] }) {
  const ancestors: AssetNode[] = []; let cursor = detail.asset.parentAssetId; const seen = new Set<string>();
  while (cursor && !seen.has(cursor)) { seen.add(cursor); const parent = assets.find((item) => item.id === cursor); if (!parent) break; ancestors.unshift(parent); cursor = parent.parentAssetId; }
  return <div className="space-y-4"><Card><CardHeader><CardTitle>Canonical System / Equipment / Component path</CardTitle></CardHeader><CardContent><ol className="flex flex-wrap items-center gap-2 text-sm">{[...ancestors, detail.asset].map((item, index) => <li key={item.id} className="flex items-center gap-2">{index > 0 && <ChevronRight className="size-4 text-slate-400" />}<Link href={`/assets/${item.id}?tab=hierarchy`} className={cn("rounded-lg border px-3 py-2 font-semibold hover:bg-slate-50", item.id === detail.asset.id && "border-blue-300 bg-blue-50 text-blue-900")}>{item.code}<span className="ml-2 text-xs font-normal text-slate-500">{title(item.structureLevel)}</span></Link></li>)}</ol></CardContent></Card>
    <Card><CardHeader><CardTitle>Direct children</CardTitle></CardHeader><CardContent>{detail.children.length ? <div className="grid gap-2 md:grid-cols-2">{detail.children.map((child) => <Link key={child.id} href={`/assets/${child.id}?tab=hierarchy`} className="rounded-xl border p-3 hover:border-blue-300 hover:bg-blue-50"><strong className="block text-sm">{child.code} · {child.name}</strong><span className="text-xs text-slate-500">{title(child.structureLevel)} · {title(child.status)}</span></Link>)}</div> : <EmptyTab icon={FolderTree} title="No direct children" message="This is a leaf in the canonical hierarchy." />}</CardContent></Card>
    <Card><CardHeader><CardTitle>Preserved asset BOM links</CardTitle></CardHeader><CardContent>{detail.hierarchyLinks.length ? <div className="overflow-x-auto"><table className="w-full min-w-[42rem] text-left text-sm"><thead className="border-b text-xs uppercase text-slate-500"><tr><th className="p-3">Sequence</th><th className="p-3">Asset</th><th className="p-3">Quantity</th><th className="p-3">Enabled</th><th className="p-3">Note</th></tr></thead><tbody>{detail.hierarchyLinks.map((link) => <tr key={link.id} className="border-b last:border-0"><td className="p-3">{link.sequence}</td><td className="p-3 font-semibold">{link.asset ? `${link.asset.code} · ${link.asset.name}` : "Missing migrated asset"}</td><td className="p-3">{link.quantity}</td><td className="p-3">{link.enabled ? "Yes" : "No"}</td><td className="p-3">{show(link.note)}</td></tr>)}</tbody></table></div> : <EmptyTab icon={FolderTree} title="No asset BOM links" message="Canonical parent-child relationships are still shown above." />}</CardContent></Card></div>;
}

function SparePartsTab({ detail }: { detail: DetailPayload }) { return detail.spareParts.length ? <Card><CardContent className="pt-6"><div className="overflow-x-auto"><table className="w-full min-w-[48rem] text-left text-sm"><thead className="border-b text-xs uppercase text-slate-500"><tr><th className="p-3">Seq.</th><th className="p-3">Part</th><th className="p-3">Required</th><th className="p-3">Available</th><th className="p-3">Enabled</th><th className="p-3">Note</th></tr></thead><tbody>{detail.spareParts.map((part) => <tr key={part.id} className="border-b last:border-0"><td className="p-3">{part.sequence}</td><td className="p-3"><strong>{part.code}</strong><span className="block text-xs text-slate-500">{part.name}</span></td><td className="p-3">{part.requiredQuantity} {part.unit}</td><td className="p-3">{show(part.availableQuantity)}</td><td className="p-3">{part.enabled ? "Yes" : "No"}</td><td className="p-3">{show(part.note)}</td></tr>)}</tbody></table></div></CardContent></Card> : <EmptyTab icon={PackageSearch} title="No linked spare parts" message="No stock BOM entries are linked to this asset." />; }

function DocumentsTab({ detail }: { detail: DetailPayload }) { return <div className="grid gap-4 lg:grid-cols-[20rem_1fr]"><Card><CardHeader><CardTitle>Primary image</CardTitle></CardHeader><CardContent><AssetImage detail={detail} /><p className="mt-3 break-all text-xs text-slate-500">{show(detail.asset.primaryImagePath)}</p></CardContent></Card><Card><CardHeader><CardTitle>Attachments</CardTitle></CardHeader><CardContent>{detail.documents.length ? <ul className="divide-y">{detail.documents.map((document) => { const canOpen = /^https?:/.test(document.storageKey) || document.storageKey.startsWith("/"); return <li key={document.id} className="flex min-h-16 items-center gap-3 py-3"><FileText className="size-5 shrink-0 text-blue-700" /><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{document.originalName}</strong><span className="block text-xs text-slate-500">{document.contentType} · {bytes(document.byteSize)} · {date(document.createdAt)}</span><span className="block text-xs text-slate-500">{show(document.note)}</span></span>{canOpen && <Button asChild variant="outline" size="sm"><a href={document.storageKey} target="_blank" rel="noreferrer">Open</a></Button>}</li>; })}</ul> : <EmptyTab icon={FileText} title="No documents" message="No managed attachments are linked to this asset." />}</CardContent></Card></div>; }

function HistoryTab({ detail }: { detail: DetailPayload }) { const entries = detail.history.length ? detail.history : [{ id: "created", action: "ASSET_CREATED", description: "Legacy asset record created", actorName: detail.asset.createdByName, result: "SUCCESS", createdAt: detail.asset.createdAt }, { id: "updated", action: "ASSET_UPDATED", description: "Legacy asset record last updated", actorName: detail.asset.updatedByName, result: "SUCCESS", createdAt: detail.asset.updatedAt }]; return <Card><CardContent className="pt-6"><ol className="space-y-0">{entries.map((entry, index) => <li key={entry.id} className="grid grid-cols-[1.5rem_1fr] gap-3"><div className="flex flex-col items-center"><span className="mt-1 size-2.5 rounded-full bg-blue-600" />{index < entries.length - 1 && <span className="w-px flex-1 bg-slate-200" />}</div><div className="pb-6"><div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm">{title(entry.action)}</strong><time className="text-xs text-slate-500">{date(entry.createdAt)}</time></div><p className="mt-1 text-sm text-slate-600">{entry.description ?? "Asset record changed"}</p><p className="mt-1 text-xs text-slate-500">{entry.actorName ?? "Legacy system"} · {title(entry.result)}</p></div></li>)}</ol></CardContent></Card>; }

function WorkOrdersTab({ detail }: { detail: DetailPayload }) { return detail.workOrders.length ? <div className="grid gap-3">{detail.workOrders.map((order) => <Card key={order.id}><CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><Link href={`/maintenance?workOrder=${order.id}`} className="font-bold text-blue-800 hover:underline">{order.code} · {order.title}</Link><p className="mt-1 line-clamp-2 text-sm text-slate-600">{order.description}</p><p className="mt-2 text-xs text-slate-500">Assigned: {show(order.assignedToName)} · Due: {date(order.dueAt)} · Updated: {date(order.updatedAt)}</p></div><div className="flex gap-2"><Badge>{title(order.priority)}</Badge><Badge className={statusTone(order.status)}>{title(order.status)}</Badge></div></CardContent></Card>)}</div> : <EmptyTab icon={Wrench} title="No related work orders" message="No migrated work-order header or job detail references this asset." />; }

function AssetDetail({ detail, allAssets, tab, onTab }: { detail: DetailPayload; allAssets: AssetNode[]; tab: Tab; onTab: (tab: Tab) => void }) {
  return <div className="space-y-4">
    <section className="overflow-hidden rounded-2xl border bg-gradient-to-br from-[#0b2a4a] to-[#155aa0] text-white shadow-lg"><div className="grid gap-4 p-5 md:grid-cols-[9rem_1fr_auto] md:items-center md:p-6"><div className="hidden md:block"><AssetImage detail={detail} /></div><div className="min-w-0"><div className="mb-3 flex flex-wrap gap-2"><Badge className="border-white/20 bg-white/10 text-white">{title(detail.asset.structureLevel)}</Badge><Badge className={cn("border-white/30", statusTone(detail.asset.status))}>{title(detail.asset.status)}</Badge></div><p className="text-sm font-bold tracking-wide text-blue-100">{detail.asset.code}</p><h1 className="mt-1 text-2xl font-bold md:text-3xl">{detail.asset.name}</h1><p className="mt-2 flex items-center gap-2 text-sm text-blue-100"><MapPin className="size-4" /> {detail.asset.location} · {detail.asset.typeName}{detail.asset.categoryName ? ` · ${detail.asset.categoryName}` : ""}</p></div><AssetQrDialog assetId={detail.asset.id} assetCode={detail.asset.code} /></div></section>
    <Tabs value={tab} onValueChange={(value) => onTab(value as Tab)}><div className="overflow-x-auto rounded-xl border bg-white p-1"><TabsList className="h-auto min-w-max justify-start bg-transparent"><TabsTrigger className="min-h-10" value="general">General</TabsTrigger><TabsTrigger className="min-h-10" value="hierarchy">Hierarchy</TabsTrigger><TabsTrigger className="min-h-10" value="spare-parts">Spare Parts</TabsTrigger><TabsTrigger className="min-h-10" value="documents">Documents</TabsTrigger><TabsTrigger className="min-h-10" value="history">History</TabsTrigger><TabsTrigger className="min-h-10" value="work-orders">Work Orders</TabsTrigger></TabsList></div>
      <TabsContent value="general"><GeneralTab detail={detail} /></TabsContent><TabsContent value="hierarchy"><HierarchyTab detail={detail} assets={allAssets} /></TabsContent><TabsContent value="spare-parts"><SparePartsTab detail={detail} /></TabsContent><TabsContent value="documents"><DocumentsTab detail={detail} /></TabsContent><TabsContent value="history"><HistoryTab detail={detail} /></TabsContent><TabsContent value="work-orders"><WorkOrdersTab detail={detail} /></TabsContent>
    </Tabs>
  </div>;
}

export default function AssetWorkspace({ initialAssetId, initialTab = "general", permitted = true }: { initialAssetId?: string; initialTab?: string; permitted?: boolean }) {
  const [query, setQuery] = useState(""); const [debouncedQuery, setDebouncedQuery] = useState("");
  const [filters, setFilters] = useState({ status: "", level: "", type: "", category: "" });
  const [data, setData] = useState<ListPayload | null>(null); const [listError, setListError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(initialAssetId ?? null); const [detail, setDetail] = useState<DetailPayload | null>(null); const [detailError, setDetailError] = useState("");
  const [tab, setTab] = useState<Tab>(tabs.includes(initialTab as Tab) ? initialTab as Tab : "general"); const [mode, setMode] = useState<"tree" | "list">("tree");
  useEffect(() => { const timer = window.setTimeout(() => setDebouncedQuery(query), 250); return () => window.clearTimeout(timer); }, [query]);
  const queryString = useMemo(() => new URLSearchParams({ q: debouncedQuery, ...filters }).toString(), [debouncedQuery, filters]);

  useEffect(() => { if (!permitted) return; const controller = new AbortController(); fetch(`/api/assets?${queryString}`, { signal: controller.signal }).then(async (response) => { if (!response.ok) { const body = await response.json(); throw new Error(response.status === 403 ? "PERMISSION" : body.error || "Unable to load assets"); } return response.json(); }).then((payload: ListPayload) => { setListError(""); setData(payload); setSelectedId((current) => current ?? payload.resultIds[0] ?? null); }).catch((error) => { if (error.name !== "AbortError") setListError(error instanceof Error ? error.message : "Unable to load assets"); }); return () => controller.abort(); }, [queryString, permitted]);
  useEffect(() => { if (!selectedId || !permitted) return; const controller = new AbortController(); fetch(`/api/assets/${selectedId}`, { signal: controller.signal }).then(async (response) => { if (!response.ok) { const body = await response.json(); throw new Error(response.status === 403 ? "PERMISSION" : body.error || "Unable to load asset"); } return response.json(); }).then((payload: DetailPayload) => { setDetailError(""); setDetail(payload); }).catch((error) => { if (error.name !== "AbortError") setDetailError(error.message); }); return () => controller.abort(); }, [selectedId, permitted]);

  function select(id: string) { setDetail(null); setDetailError(""); setSelectedId(id); const next = `/assets/${id}?tab=${tab}`; window.history.pushState({}, "", next); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function changeTab(next: Tab) { setTab(next); if (selectedId) window.history.replaceState({}, "", `/assets/${selectedId}?tab=${next}`); }
  async function retryList() { setListError(""); try { const response = await fetch(`/api/assets?${queryString}`); if (!response.ok) { const body = await response.json(); throw new Error(response.status === 403 ? "PERMISSION" : body.error || "Unable to load assets"); } const payload = await response.json() as ListPayload; setData(payload); setSelectedId((current) => current ?? payload.resultIds[0] ?? null); } catch (error) { setListError(error instanceof Error ? error.message : "Unable to load assets"); } }
  if (!permitted) return <main className="p-4 md:p-6"><StatePanel kind="permission" title="Asset access required" message="You are signed in, but your role does not include ASSET_READ. Ask an administrator to grant the Asset read permission." /></main>;

  return <main className="mx-auto w-full max-w-[112rem] space-y-4 p-3 sm:p-4 md:p-6">
    <header className="flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">Asset Management</p><h1 className="mt-1 text-2xl font-bold text-slate-950 md:text-3xl">Asset register</h1><p className="mt-1 text-sm text-slate-600">Systems, equipment, components, and their maintenance context.</p></div>{data && <Sheet><SheetTrigger asChild><Button variant="outline" className="min-h-11 lg:hidden"><Menu className="size-4" /> Browse assets</Button></SheetTrigger><SheetContent side="left" className="w-[92vw] max-w-md p-0"><SheetHeader className="sr-only"><SheetTitle>Asset register</SheetTitle><SheetDescription>Choose an asset from the hierarchy or list.</SheetDescription></SheetHeader><AssetNavigator data={data} selectedId={selectedId} onSelect={select} mode={mode} onMode={setMode} /></SheetContent></Sheet>}</header>
    <Filters query={query} setQuery={setQuery} filters={filters} setFilter={(key, value) => setFilters((current) => ({ ...current, [key]: value }))} data={data} />
    {listError ? <StatePanel kind={listError === "PERMISSION" ? "permission" : "error"} title={listError === "PERMISSION" ? "Asset access required" : "Assets could not be loaded"} message={listError === "PERMISSION" ? "Your session does not include ASSET_READ." : listError} retry={() => void retryList()} /> : !data ? <div className="grid gap-4 lg:grid-cols-[22rem_1fr]"><Skeleton className="hidden h-[70vh] rounded-2xl lg:block" /><DetailSkeleton /></div> : data.assets.length === 0 ? <StatePanel kind="empty" title="No assets registered" message="The asset register is ready, but it does not contain any migrated or newly created records yet." /> : <div className="grid min-h-[70vh] gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]"><aside className="sticky top-20 hidden h-[calc(100vh-6rem)] overflow-hidden rounded-2xl border bg-white shadow-sm lg:block"><AssetNavigator data={data} selectedId={selectedId} onSelect={select} mode={mode} onMode={setMode} /></aside><section className="min-w-0">{detailError ? <StatePanel kind={detailError === "PERMISSION" ? "permission" : "error"} title={detailError === "PERMISSION" ? "Asset access required" : "Asset could not be loaded"} message={detailError} retry={() => { if (selectedId) { setDetailError(""); setSelectedId(null); window.setTimeout(() => setSelectedId(selectedId), 0); } }} /> : detail ? <AssetDetail detail={detail} allAssets={data.assets} tab={tab} onTab={changeTab} /> : <DetailSkeleton />}</section></div>}
  </main>;
}
