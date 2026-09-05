"use client";

import { useState } from "react";
import { Eye, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

type RequestDetail = {
  requestNumber: string; status: string; currencyCode: string; exchangeRateToThb: string; estimatedTotalAmount: string; estimatedTotalAmountThb: string; revisionNumber: number; remark: string | null; createdAt: string;
  lines: Array<{ id: string; stockCodeSnapshot: string; description: string; quantity: string; estimatedUnitPrice: string; discountAmount: string; lineTotal: string }>;
  candidateVendors: Array<{ id: string; vendorNameSnapshot: string; rank: number }>;
};

type OrderDetail = {
  orderNumber: string; status: string; vendorNameSnapshot: string; purchaseMethod: string | null; currencyCode: string; exchangeRateToThb: string; subtotalAmount: string; itemDiscountAmount: string; headerDiscountAmount: string; vatAmount: string; grandTotalAmount: string; grandTotalAmountThb: string; revisionNumber: number; remark: string | null; createdAt: string;
  lines: Array<{ id: string; stockCodeSnapshot: string; description: string; quantity: string; unitPrice: string; itemDiscountAmount: string; lineTotal: string }>;
};

const amount = (value: string | number | null | undefined) => value === null || value === undefined ? "—" : Number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 });
const created = (value: string) => new Date(value).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="min-w-0 rounded-xl border bg-slate-50 px-3 py-2"><p className="text-[11px] font-semibold text-slate-500">{label}</p><div className="mt-1 whitespace-pre-wrap break-words text-sm font-semibold text-slate-900">{value ?? "—"}</div></div>;
}

export function PurchaseDocumentDialog({ kind, id }: { kind: "request" | "order"; id: string }) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<RequestDetail | OrderDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/purchase-${kind === "request" ? "requests" : "orders"}/${id}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to load document");
      setDetail(kind === "request" ? body.request : body.order);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load document"); }
    finally { setLoading(false); }
  }

  const request = kind === "request" ? detail as RequestDetail | null : null;
  const order = kind === "order" ? detail as OrderDetail | null : null;
  const title = request?.requestNumber ?? order?.orderNumber ?? (kind === "request" ? "Purchase Request" : "Purchase Order");

  return <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (next && !loading) void load(); }}>
    <DialogTrigger asChild><Button type="button" size="sm" variant="outline"><Eye className="size-4" />ดูเอกสาร</Button></DialogTrigger>
    <DialogContent closeLabel="ปิดรายละเอียดเอกสาร" className="inset-y-auto left-1/2 top-1/2 max-h-[90vh] w-[min(62rem,calc(100vw-2rem))] max-w-none -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white p-0 text-slate-950 shadow-2xl">
      <div className="border-b bg-slate-50 px-6 py-5 pr-16">
        <div className="flex flex-wrap items-center gap-3"><DialogTitle className="font-mono text-xl font-bold text-blue-700">{title}</DialogTitle>{detail && <Badge className="border-blue-200 bg-blue-50 text-blue-800">{detail.status}</Badge>}</div>
        <DialogDescription className="mt-1 text-sm text-slate-500">รายละเอียดเอกสาร {kind === "request" ? "Purchase Request" : "Purchase Order"} ที่บันทึกไว้</DialogDescription>
      </div>
      <div className="space-y-5 p-6">
        {loading && <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-slate-500"><Loader2 className="size-5 animate-spin" />กำลังโหลดรายละเอียด…</div>}
        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}<Button type="button" size="sm" variant="outline" className="ml-3" onClick={() => void load()}>ลองใหม่</Button></div>}
        {request && !loading && !error && <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Info label="วันที่สร้าง" value={created(request.createdAt)} /><Info label="สกุลเงิน / อัตราแลกเปลี่ยน" value={`${request.currencyCode} · อัตรา ${request.exchangeRateToThb}`} /><Info label="ฉบับแก้ไข" value={request.revisionNumber} /><Info label="ยอดรวม (บาท)" value={amount(request.estimatedTotalAmountThb)} /></div>
          {request.candidateVendors.length > 0 && <Info label="ผู้ขายที่เสนอ" value={[...request.candidateVendors].sort((a, b) => a.rank - b.rank).map((vendor) => vendor.vendorNameSnapshot).join(" · ")} />}
          <LineTable headers={["สินค้า", "รายละเอียด", "จำนวน", "ราคาประมาณ", "ส่วนลด", "รวม"]} rows={request.lines.map((line) => [line.stockCodeSnapshot, line.description, amount(line.quantity), amount(line.estimatedUnitPrice), amount(line.discountAmount), amount(line.lineTotal)])} />
          <div className="grid gap-3 sm:grid-cols-2"><Info label="ยอดรวมตามสกุลเงิน" value={`${request.currencyCode} ${amount(request.estimatedTotalAmount)}`} /><Info label="หมายเหตุ" value={request.remark ?? "—"} /></div>
        </>}
        {order && !loading && !error && <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Info label="วันที่สร้าง" value={created(order.createdAt)} /><Info label="ผู้ขาย" value={order.vendorNameSnapshot} /><Info label="วิธีจัดซื้อ" value={order.purchaseMethod ?? "—"} /><Info label="ฉบับแก้ไข" value={order.revisionNumber} /></div>
          <LineTable headers={["สินค้า", "รายละเอียด", "จำนวน", "ราคาต่อหน่วย", "ส่วนลด", "รวม"]} rows={order.lines.map((line) => [line.stockCodeSnapshot, line.description, amount(line.quantity), amount(line.unitPrice), amount(line.itemDiscountAmount), amount(line.lineTotal)])} />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Info label="ยอดก่อนส่วนลด" value={`${order.currencyCode} ${amount(order.subtotalAmount)}`} /><Info label="ส่วนลดรวม" value={amount(Number(order.itemDiscountAmount) + Number(order.headerDiscountAmount))} /><Info label="ภาษีมูลค่าเพิ่ม" value={amount(order.vatAmount)} /><Info label="ยอดสุทธิ (บาท)" value={amount(order.grandTotalAmountThb)} /></div>
          <Info label="ยอดสุทธิตามสกุลเงิน" value={`${order.currencyCode} ${amount(order.grandTotalAmount)}`} /><Info label="หมายเหตุ" value={order.remark ?? "—"} />
        </>}
      </div>
    </DialogContent>
  </Dialog>;
}

function LineTable({ headers, rows }: { headers: string[]; rows: Array<Array<string>> }) {
  return <div className="overflow-x-auto rounded-xl border"><table className="w-full min-w-[42rem] text-left text-sm"><thead className="border-b bg-slate-50 text-xs text-slate-500"><tr>{headers.map((header) => <th key={header} className="px-3 py-2 font-semibold">{header}</th>)}</tr></thead><tbody className="divide-y">{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex} className={`px-3 py-3 ${cellIndex >= 2 ? "text-right tabular-nums" : ""}`}>{cell}</td>)}</tr>)}</tbody></table></div>;
}
