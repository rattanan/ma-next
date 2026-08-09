"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { ClipboardCheck, Printer, RefreshCw, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { PageContainer, PageHeader } from "@/components/shared/page-header";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { statusToneClass } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Location = { id: string; code: string; name: string };
type PurchaseOrderLine = {
  id: string; lineNumber: number; unit: string; orderedQuantity: string; receivedQuantity: string;
  outstandingQuantity: string; availableToReceive: string; unitPrice: string | null;
  stockItem: { id: string; code: string; name: string; mainLocation: Location | null };
};
type PurchaseOrder = {
  id: string; orderNumber: string; orderDate: string; status: string; expectedDeliveryDate: string | null;
  vendor: { code: string; name: string }; lines: PurchaseOrderLine[];
};
type Receipt = {
  id: string; documentNumber: string; documentDate: string; status: string; requesterName: string;
  purchaseOrder: { orderNumber: string; status: string } | null;
  lines: Array<{ id: string; requestedQuantity: string; rejectedQuantity: string; destinationLocation: Location | null }>;
};
type DraftLine = { enabled: boolean; quantity: string; rejectedQuantity: string; destinationLocationId: string; remark: string };

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? "Request failed");
  return body as T;
}

function jsonBody(body: unknown): RequestInit {
  return { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
}

function displayDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString("th-TH") : "—";
}

const statusClass = statusToneClass;

export default function PoReceiptWorkspace({ permissions }: { permissions: string[] }) {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [draftLines, setDraftLines] = useState<Record<string, DraftLine>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionPending, setActionPending] = useState(false);
  const [cancelReceiptId, setCancelReceiptId] = useState<string | null>(null);
  const canCreate = permissions.includes("INVENTORY_REQUEST_CREATE");
  const canPost = permissions.includes("INVENTORY_POST");
  const selected = useMemo(() => orders.find((order) => order.id === selectedId) ?? null, [orders, selectedId]);

  const load = useCallback(async () => {
    try {
      const [poResult, locationResult, receiptResult] = await Promise.all([
        requestJson<{ purchaseOrders: PurchaseOrder[] }>("/api/inventory/purchase-orders"),
        requestJson<{ locations: Location[] }>("/api/inventory/locations?pageSize=100&active=true"),
        requestJson<{ documents: Receipt[] }>("/api/inventory/po-receipts?pageSize=100"),
      ]);
      setOrders(poResult.purchaseOrders);
      setLocations(locationResult.locations);
      setReceipts(receiptResult.documents);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load PO Receipts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.all([
      requestJson<{ purchaseOrders: PurchaseOrder[] }>("/api/inventory/purchase-orders"),
      requestJson<{ locations: Location[] }>("/api/inventory/locations?pageSize=100&active=true"),
      requestJson<{ documents: Receipt[] }>("/api/inventory/po-receipts?pageSize=100"),
    ]).then(([poResult, locationResult, receiptResult]) => {
      if (!active) return;
      setOrders(poResult.purchaseOrders); setLocations(locationResult.locations); setReceipts(receiptResult.documents); setLoading(false);
    }).catch((error) => {
      if (!active) return;
      toast.error(error instanceof Error ? error.message : "Unable to load PO Receipts"); setLoading(false);
    });
    return () => { active = false; };
  }, []);

  function selectOrder(id: string) {
    setSelectedId(id);
    const order = orders.find((candidate) => candidate.id === id);
    setDraftLines(Object.fromEntries((order?.lines ?? []).map((line) => [line.id, {
      enabled: Number(line.availableToReceive) > 0,
      quantity: line.availableToReceive,
      rejectedQuantity: "0",
      destinationLocationId: line.stockItem.mainLocation?.id ?? "",
      remark: "",
    }])));
  }

  function updateLine(id: string, patch: Partial<DraftLine>) {
    setDraftLines((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
  }

  async function uploadFiles(documentId: string, files: File[]) {
    for (const file of files) {
      const data = new FormData(); data.set("file", file); data.set("entityType", "INVENTORY_DOCUMENT"); data.set("entityId", documentId);
      await requestJson("/api/attachments/upload", { method: "POST", body: data });
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    try {
      setSaving(true);
      const lines = selected.lines.flatMap((line) => {
        const draft = draftLines[line.id];
        if (!draft?.enabled || Number(draft.quantity) <= 0) return [];
        if (!draft.destinationLocationId) throw new Error(`เลือก Location สำหรับ PO line ${line.lineNumber}`);
        if (Number(draft.quantity) > Number(line.availableToReceive)) throw new Error(`PO line ${line.lineNumber} รับได้ไม่เกิน ${line.availableToReceive}`);
        if (Number(draft.rejectedQuantity) > Number(draft.quantity)) throw new Error(`Reject ของ PO line ${line.lineNumber} มากกว่าจำนวนที่ส่งมา`);
        return [{ purchaseOrderLineId: line.id, destinationLocationId: draft.destinationLocationId, receivedQuantity: draft.quantity, rejectedQuantity: draft.rejectedQuantity, actualDeliveryDate: String(form.get("documentDate")), remark: draft.remark || null }];
      });
      if (!lines.length) throw new Error("เลือกอย่างน้อย 1 รายการเพื่อรับสินค้า");
      const created = await requestJson<{ id: string; documentNumber: string }>("/api/inventory/po-receipts", jsonBody({
        purchaseOrderId: selected.id,
        documentDate: String(form.get("documentDate")),
        deliveryNoteNumber: String(form.get("deliveryNoteNumber") ?? "").trim() || null,
        remark: String(form.get("remark") ?? "").trim() || null,
        lines,
      }));
      const files = form.getAll("attachments").filter((file): file is File => file instanceof File && file.size > 0);
      await uploadFiles(created.id, files);
      if (canPost) {
        await requestJson(`/api/inventory/po-receipts/${created.id}/actions`, jsonBody({ action: "CONFIRM" }));
        toast.success(`${created.documentNumber} confirmed; stock and PO status updated`);
      } else {
        toast.success(`${created.documentNumber} saved as draft; Warehouse Manager must confirm it`);
      }
      setSelectedId(""); setDraftLines({}); await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to receive purchase order");
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function act(id: string, action: "CONFIRM" | "CANCEL") {
    if (action === "CANCEL" && cancelReceiptId !== id) { setCancelReceiptId(id); return; }
    try {
      setActionPending(true);
      await requestJson(`/api/inventory/po-receipts/${id}/actions`, jsonBody({ action }));
      toast.success(action === "CONFIRM" ? "Receipt confirmed" : "Receipt returned/reversed");
      setCancelReceiptId(null);
      await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Action failed"); }
    finally { setActionPending(false); }
  }

  return <PageContainer className="max-w-[112rem]">
    <PageHeader eyebrow="Purchase → Inventory" title="รับสินค้าจาก Purchase Order" description="รับหลายครั้ง/หลายรายการ ระบุ Location และ Reject ได้ ระบบจะกันยอดรับเกินและอัปเดต On-hand, Stock Card และสถานะ PO ใน transaction เดียว" icon={<ClipboardCheck className="size-5" />} actions={<Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw />Refresh</Button>} />

    <Card>
      <CardHeader><CardTitle>1. เลือก PO ที่อนุมัติแล้ว</CardTitle><CardDescription>แสดงเฉพาะ PO สถานะ Approved หรือ Partial Received ที่ยังมียอดค้างรับ</CardDescription></CardHeader>
      <CardContent>
        {loading ? <p className="text-sm text-slate-500">Loading…</p> : orders.length === 0 ? <p className="rounded-lg border border-dashed p-5 text-sm text-slate-600">ไม่มี PO ที่พร้อมรับสินค้า ข้อมูลเก่าใน `nexif` ไม่มี PR/PO records; ให้สร้างและอนุมัติ PO ใหม่ก่อนรับสินค้า</p> : <select className="wo-input max-w-3xl" value={selectedId} onChange={(event) => selectOrder(event.target.value)} disabled={!canCreate}><option value="">Select approved PO…</option>{orders.map((order) => <option key={order.id} value={order.id}>{order.orderNumber} · {order.vendor.code} — {order.vendor.name} · {order.status} · due {displayDate(order.expectedDeliveryDate)}</option>)}</select>}
      </CardContent>
    </Card>

    {selected && <Card>
      <CardHeader><CardTitle>2. บันทึกรับสินค้า — {selected.orderNumber}</CardTitle><CardDescription>{selected.vendor.code} — {selected.vendor.name}; เลือกเฉพาะรายการที่มาถึงในครั้งนี้</CardDescription></CardHeader>
      <CardContent><form className="space-y-5" onSubmit={submit}>
        <div className="grid gap-3 md:grid-cols-3"><div><Label htmlFor="documentDate">วันที่รับ</Label><Input id="documentDate" name="documentDate" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} /></div><div><Label htmlFor="deliveryNoteNumber">เลขที่ใบส่งของ</Label><Input id="deliveryNoteNumber" name="deliveryNoteNumber" maxLength={120} /></div><div><Label htmlFor="attachments">เอกสารแนบ</Label><Input id="attachments" name="attachments" type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf,.doc,.docx,.xls,.xlsx" /></div></div>
        <div className="overflow-x-auto rounded-xl border"><table className="w-full min-w-[980px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-600"><tr>{["รับ", "PO line / Stockcode", "Ordered", "Received", "Available", "Delivered now", "Reject", "Location", "Remark"].map((head) => <th key={head} className="px-3 py-3">{head}</th>)}</tr></thead><tbody className="divide-y">{selected.lines.map((line) => { const draft = draftLines[line.id]; return <tr key={line.id}><td className="px-3 py-3"><input type="checkbox" checked={draft?.enabled ?? false} onChange={(event) => updateLine(line.id, { enabled: event.target.checked })} /></td><td className="px-3 py-3"><strong>{line.lineNumber}. {line.stockItem.code}</strong><span className="block text-xs text-slate-500">{line.stockItem.name}</span></td><td className="px-3 py-3">{line.orderedQuantity} {line.unit}</td><td className="px-3 py-3">{line.receivedQuantity}</td><td className="px-3 py-3 font-semibold text-blue-700">{line.availableToReceive}</td><td className="px-3 py-3"><Input type="number" min="0.000001" step="0.000001" value={draft?.quantity ?? ""} disabled={!draft?.enabled} onChange={(event) => updateLine(line.id, { quantity: event.target.value })} /></td><td className="px-3 py-3"><Input type="number" min="0" step="0.000001" value={draft?.rejectedQuantity ?? "0"} disabled={!draft?.enabled} onChange={(event) => updateLine(line.id, { rejectedQuantity: event.target.value })} /></td><td className="px-3 py-3"><select className="wo-input min-w-48" value={draft?.destinationLocationId ?? ""} disabled={!draft?.enabled} onChange={(event) => updateLine(line.id, { destinationLocationId: event.target.value })}><option value="">Select Location…</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.code} — {location.name}</option>)}</select></td><td className="px-3 py-3"><Input value={draft?.remark ?? ""} disabled={!draft?.enabled} onChange={(event) => updateLine(line.id, { remark: event.target.value })} /></td></tr>; })}</tbody></table></div>
        <div><Label htmlFor="remark">หมายเหตุการรับ</Label><Input id="remark" name="remark" maxLength={10000} /></div>
        <Button type="submit" disabled={saving || !canCreate}>{saving ? "Saving…" : canPost ? "Confirm Receipt & Post Stock" : "Save Receipt Draft"}</Button>
      </form></CardContent>
    </Card>}

    <Card>
      <CardHeader><CardTitle>ประวัติ PO Receipts</CardTitle><CardDescription>พิมพ์ใบรับสินค้า หรือ Return/Reverse เมื่อสินค้าที่รับไว้ไม่ถูกต้อง (ห้าม reverse หากเบิกใช้ออกไปแล้ว)</CardDescription></CardHeader>
      <CardContent>{receipts.length === 0 ? <p className="text-sm text-slate-500">No PO Receipts yet.</p> : <div className="overflow-x-auto rounded-xl border"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-600"><tr>{["Receipt", "PO", "Date", "Receiver", "Lines", "Status", "Actions"].map((head) => <th key={head} className="px-3 py-3">{head}</th>)}</tr></thead><tbody className="divide-y">{receipts.map((receipt) => <tr key={receipt.id}><td className="px-3 py-3 font-mono font-bold text-blue-700">{receipt.documentNumber}</td><td className="px-3 py-3">{receipt.purchaseOrder?.orderNumber ?? "—"}</td><td className="px-3 py-3">{displayDate(receipt.documentDate)}</td><td className="px-3 py-3">{receipt.requesterName}</td><td className="px-3 py-3">{receipt.lines.length}</td><td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs font-bold ${statusClass(receipt.status)}`}>{receipt.status}</span></td><td className="px-3 py-3"><div className="flex gap-2"><Button asChild size="sm" variant="outline"><a href={`/api/inventory/documents/${receipt.id}/print`} target="_blank" rel="noreferrer"><Printer />Print</a></Button>{receipt.status === "DRAFT" && canPost && <Button size="sm" onClick={() => void act(receipt.id, "CONFIRM")}><ClipboardCheck />Confirm</Button>}{receipt.status === "POSTED" && canPost && <Button size="sm" variant="destructive" onClick={() => void act(receipt.id, "CANCEL")}><RotateCcw />Return</Button>}</div></td></tr>)}</tbody></table></div>}</CardContent>
    </Card>
    <ConfirmDialog open={Boolean(cancelReceiptId)} onOpenChange={(open) => { if (!open && !actionPending) setCancelReceiptId(null); }} title="Return and reverse this receipt?" description="Stock on-hand, stock card movements, and the PO received quantities will be adjusted. This action is recorded in the audit log." confirmLabel="Return receipt" pending={actionPending} onConfirm={() => cancelReceiptId ? act(cancelReceiptId, "CANCEL") : undefined} />
  </PageContainer>;
}
