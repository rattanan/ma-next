import type { NextRequest } from "next/server";
import { getRequestMeta } from "@/lib/auth/request";
import { requirePermission } from "@/lib/auth/session";
import { apiError } from "@/lib/http";
import { stockCard } from "@/lib/inventory/service";
import { inventoryReportQuerySchema } from "@/lib/inventory/validation";

const escapeHtml = (value: unknown) => String(value ?? "—").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
const csv = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
const readable = (value: unknown) => value ? new Date(String(value)).toLocaleString("en-GB") : "—";

export async function GET(request: NextRequest) {
  const meta = getRequestMeta(request);
  try {
    const session = await requirePermission(request, "INVENTORY_REPORT_VIEW");
    const format = request.nextUrl.searchParams.get("format");
    const report = await stockCard(inventoryReportQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams)), session.user);
    if (format === "csv" || format === "xlsx") {
      const lines = [["Posted", "Movement", "Document", "Source Receipt", "Quantity In", "Quantity Out", "Running Quantity", "Running Value"], ...report.rows.map((row) => [readable(row.postedAt), row.movementType, row.documentNumber, row.sourceReceiptDocumentNumber, row.quantityIn, row.quantityOut, row.runningQuantity, row.runningValue])];
      return new Response(`\uFEFF${lines.map((line) => line.map(csv).join(",")).join("\n")}`, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="stock-card-${report.stockItem?.code ?? "report"}.csv"` } });
    }
    const rows = report.rows.map((row) => `<tr><td>${escapeHtml(readable(row.postedAt))}</td><td>${escapeHtml(row.movementType)}</td><td>${escapeHtml(row.documentNumber)}</td><td>${escapeHtml(row.sourceReceiptDocumentNumber)}</td><td>${escapeHtml(row.quantityIn)}</td><td>${escapeHtml(row.quantityOut)}</td><td>${escapeHtml(row.runningQuantity)}</td><td>${escapeHtml(row.runningValue)}</td></tr>`).join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Stock Card</title><style>@page{size:A4 landscape;margin:12mm}*{box-sizing:border-box}body{font:11px Arial,sans-serif;color:#172033;margin:0}header{border-bottom:3px solid #175cd3;padding-bottom:12px;margin-bottom:16px}h1{font-size:22px;margin:4px 0}.actions{margin-bottom:14px}.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.summary div{border:1px solid #d7deea;padding:8px}.summary b{display:block;font-size:10px;color:#56637a;text-transform:uppercase;margin-bottom:3px}table{width:100%;border-collapse:collapse;margin-top:18px}th,td{border:1px solid #b9c3d3;padding:6px;text-align:left}th{background:#eef4ff}@media print{.actions{display:none}}</style></head><body><div class="actions"><button onclick="window.print()">Print / Save PDF</button></div><header><div>MA Next Maintenance Intelligence</div><h1>Stock Card</h1><div>${escapeHtml(report.stockItem?.code)} — ${escapeHtml(report.stockItem?.name)} · ${escapeHtml(report.location?.code)}</div></header><section class="summary"><div><b>From</b>${escapeHtml(readable(report.from))}</div><div><b>To</b>${escapeHtml(readable(report.to))}</div><div><b>Opening quantity</b>${escapeHtml(report.openingQuantity)}</div><div><b>Opening value</b>${escapeHtml(report.openingValue)}</div><div><b>Closing quantity</b>${escapeHtml(report.closingQuantity)}</div><div><b>Closing value</b>${escapeHtml(report.closingValue)}</div></section><table><thead><tr><th>Posted</th><th>Movement</th><th>Document</th><th>Source Receipt</th><th>Quantity In</th><th>Quantity Out</th><th>Running Quantity</th><th>Running Value</th></tr></thead><tbody>${rows || `<tr><td colspan="8">No posted movement in period</td></tr>`}</tbody></table></body></html>`;
    return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "content-disposition": "inline; filename=stock-card.html" } });
  } catch (error) { return apiError(error, meta.requestId); }
}
