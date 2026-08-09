import type { NextRequest } from "next/server";
import { getRequestMeta } from "@/lib/auth/request";
import { requireSession } from "@/lib/auth/session";
import { apiError } from "@/lib/http";
import { getPurchaseOrderPrint } from "@/lib/purchasing/service";

function escapeHtml(value: unknown) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const meta = getRequestMeta(request);
  try {
    const session = await requireSession(request);
    const order = await getPurchaseOrderPrint((await params).id, session.user);
    const draft = order.status !== "ISSUED" && order.status !== "APPROVED";
    const rows = (order.lines ?? []).map((line) => `<tr><td>${escapeHtml(line.stockCodeSnapshot)}</td><td>${escapeHtml(line.description)}</td><td>${escapeHtml(line.quantity)}</td><td>${escapeHtml(line.unitPrice)}</td><td>${escapeHtml(line.lineTotal)}</td></tr>`).join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(order.orderNumber)}</title><style>@page{size:A4;margin:16mm}body{font:13px Arial;color:#152238}header{border-bottom:3px solid #175cd3;margin-bottom:20px;padding-bottom:12px}.meta{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.meta div{border:1px solid #ccd5e3;padding:8px}b{display:block;font-size:10px;color:#5d6b82;text-transform:uppercase;margin-bottom:4px}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border:1px solid #b9c3d3;padding:7px;text-align:left}th{background:#eef4ff}.draft{position:fixed;inset:45% 0;text-align:center;font-size:72px;color:#d22;opacity:.16;transform:rotate(-25deg);font-weight:800;pointer-events:none}@media print{.actions{display:none}}</style></head><body>${draft ? '<div class="draft">DRAFT</div>' : ""}<div class="actions"><button onclick="window.print()">Print / Save PDF</button></div><header><div>MA Next Procurement</div><h1>Purchase Order · ${escapeHtml(order.orderNumber)}</h1><div>Status: ${escapeHtml(order.status)}</div></header><section class="meta"><div><b>Vendor</b>${escapeHtml(order.vendorNameSnapshot)}</div><div><b>Currency</b>${escapeHtml(order.currencyCode)}</div><div><b>THB total</b>${escapeHtml(order.grandTotalAmountThb)}</div><div><b>Purchase method</b>${escapeHtml(order.purchaseMethod)}</div><div><b>Revision</b>${escapeHtml(order.revisionNumber)}</div><div><b>Reference PR</b>${escapeHtml(order.purchaseRequestId)}</div></section><table><thead><tr><th>Stockcode</th><th>Description</th><th>Qty</th><th>Unit price</th><th>Line total</th></tr></thead><tbody>${rows}</tbody></table><p>Subtotal: ${escapeHtml(order.subtotalAmount)} · Discount: ${escapeHtml(order.itemDiscountAmount)} + ${escapeHtml(order.headerDiscountAmount)} · VAT: ${escapeHtml(order.vatAmount)} · Grand total: ${escapeHtml(order.grandTotalAmount)}</p></body></html>`;
    return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "content-disposition": `inline; filename="${order.orderNumber}.html"` } });
  } catch (error) { return apiError(error, meta.requestId); }
}
