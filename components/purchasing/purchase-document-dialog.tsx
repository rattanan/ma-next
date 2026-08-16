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
const created = (value: string) => new Date(value).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="min-w-0 rounded-xl border bg-slate-50 px-3 py-2"><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p><div className="mt-1 truncate text-sm font-semibold text-slate-900">{value || "—"}</div></div>;
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

  return <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (next && !detail && !loading) void load(); }}>
    <DialogTrigger asChild><Button type="button" size="sm" variant="outline"><Eye className="size-4" />View</Button></DialogTrigger>
    <DialogContent className="inset-y-auto left-1/2 top-1/2 max-h-[90vh] w-[min(62rem,calc(100vw-2rem))] max-w-none -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white p-0 text-slate-950 shadow-2xl">
      <div className="border-b bg-slate-50 px-6 py-5 pr-16">
        <div className="flex flex-wrap items-center gap-3"><DialogTitle className="font-mono text-xl font-bold text-blue-700">{title}</DialogTitle>{detail && <Badge className="border-blue-200 bg-blue-50 text-blue-800">{detail.status}</Badge>}</div>
        <DialogDescription className="mt-1 text-sm text-slate-500">รายละเอียดเอกสาร {kind === "request" ? "Purchase Request" : "Purchase Order"} ที่บันทึกไว้</DialogDescription>
      </div>
      <div className="space-y-5 p-6">
        {loading && <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-slate-500"><Loader2 className="size-5 animate-spin" />กำลังโหลดรายละเอียด…</div>}
        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}<Button type="button" size="sm" variant="outline" className="ml-3" onClick={() => void load()}>ลองใหม่</Button></div>}
        {request && <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Info label="Created" value={created(request.createdAt)} /><Info label="Currency" value={`${request.currencyCode} · rate ${request.exchangeRateToThb}`} /><Info label="Revision" value={request.revisionNumber} /><Info label="Total THB" value={amount(request.estimatedTotalAmountThb)} /></div>
          {request.candidateVendors.length > 0 && <Info label="Candidate vendors" value={[...request.candidateVendors].sort((a, b) => a.rank - b.rank).map((vendor) => vendor.vendorNameSnapshot).join(" · ")} />}
          <LineTable headers={["Item", "Description", "Qty", "Estimated price", "Discount", "Total"]} rows={request.lines.map((line) => [line.stockCodeSnapshot, line.description, amount(line.quantity), amount(line.estimatedUnitPrice), amount(line.discountAmount), amount(line.lineTotal)])} />
          <div className="grid gap-3 sm:grid-cols-2"><Info label="Document total" value={`${request.currencyCode} ${amount(request.estimatedTotalAmount)}`} /><Info label="Remark" value={request.remark ?? "—"} /></div>
        </>}
        {order && <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Info label="Created" value={created(order.createdAt)} /><Info label="Vendor" value={order.vendorNameSnapshot} /><Info label="Purchase method" value={order.purchaseMethod ?? "—"} /><Info label="Revision" value={order.revisionNumber} /></div>
          <LineTable headers={["Item", "Description", "Qty", "Unit price", "Discount", "Total"]} rows={order.lines.map((line) => [line.stockCodeSnapshot, line.description, amount(line.quantity), amount(line.unitPrice), amount(line.itemDiscountAmount), amount(line.lineTotal)])} />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Info label="Subtotal" value={`${order.currencyCode} ${amount(order.subtotalAmount)}`} /><Info label="Discount" value={amount(Number(order.itemDiscountAmount) + Number(order.headerDiscountAmount))} /><Info label="VAT" value={amount(order.vatAmount)} /><Info label="Grand total THB" value={amount(order.grandTotalAmountThb)} /></div>
          <Info label="Remark" value={order.remark ?? "—"} />
        </>}
      </div>
    </DialogContent>
  </Dialog>;
}

function LineTable({ headers, rows }: { headers: string[]; rows: Array<Array<string>> }) {
  return <div className="overflow-x-auto rounded-xl border"><table className="w-full min-w-[42rem] text-left text-sm"><thead className="border-b bg-slate-50 text-xs text-slate-500"><tr>{headers.map((header) => <th key={header} className="px-3 py-2 font-semibold">{header}</th>)}</tr></thead><tbody className="divide-y">{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex} className={`px-3 py-3 ${cellIndex >= 2 ? "text-right tabular-nums" : ""}`}>{cell}</td>)}</tr>)}</tbody></table></div>;
}
