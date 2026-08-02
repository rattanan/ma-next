import type { NextRequest } from "next/server";
import { getRequestMeta } from "@/lib/auth/request";
import { requireSession } from "@/lib/auth/session";
import { getStockCount } from "@/lib/inventory/service";
import { apiError } from "@/lib/http";

const escapeHtml = (value: unknown) => String(value ?? "—").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
const readable = (value: unknown) => value ? new Date(String(value)).toLocaleString("en-GB") : "—";
const money = (value: unknown) => value === null || value === undefined ? "—" : Number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const meta = getRequestMeta(request);
  try {
    const session = await requireSession(request);
    const count = await getStockCount((await params).id, session.user);
    const rows = count.lines.map((line) => `<tr><td>${escapeHtml(line.stockItem.code)} — ${escapeHtml(line.stockItem.name)}</td><td>${escapeHtml(line.location.code)}</td><td>${escapeHtml(line.systemQuantity)}</td><td>${escapeHtml(line.countedQuantity)}</td><td>${escapeHtml(line.varianceQuantity)}</td><td>${escapeHtml(money(line.unitCost))}</td><td>${escapeHtml(money(line.varianceAmount))}</td></tr>`).join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(count.countNumber)}</title><style>@page{size:A4;margin:14mm}*{box-sizing:border-box}body{font:12px Arial,sans-serif;color:#172033;margin:0}header{border-bottom:3px solid #175cd3;padding-bottom:12px;margin-bottom:16px}h1{font-size:22px;margin:4px 0}.actions{margin-bottom:14px}.meta{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.meta div{border:1px solid #d7deea;padding:8px}.meta b{display:block;font-size:10px;color:#56637a;text-transform:uppercase;margin-bottom:3px}table{width:100%;border-collapse:collapse;margin-top:18px}th,td{border:1px solid #b9c3d3;padding:6px;text-align:left}th{background:#eef4ff}.signatures{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;margin-top:50px}.signature{border-top:1px solid #172033;padding-top:6px;text-align:center}@media print{.actions{display:none}}</style></head><body><div class="actions"><button onclick="window.print()">Print / Save PDF</button></div><header><div>MA Next Maintenance Intelligence</div><h1>Stock Count · ${escapeHtml(count.countNumber)}</h1><div>Status: ${escapeHtml(count.status)}</div></header><section class="meta"><div><b>Count date</b>${escapeHtml(readable(count.countDate))}</div><div><b>Cut-off</b>${escapeHtml(readable(count.cutoffAt))}</div><div><b>Type</b>${escapeHtml(count.countType)}</div><div><b>Plant / site</b>${escapeHtml(count.siteId)}</div><div><b>Location</b>${escapeHtml(count.locationId)}</div><div><b>Remark</b>${escapeHtml(count.remark)}</div></section><table><thead><tr><th>Stock item</th><th>Location</th><th>System quantity</th><th>Counted</th><th>Variance</th><th>Unit cost</th><th>Variance amount</th></tr></thead><tbody>${rows || `<tr><td colspan="7">No lines</td></tr>`}</tbody></table><div class="signatures"><div class="signature">Counter / Date</div><div class="signature">Warehouse Manager / Date</div><div class="signature">Plant Manager / Date</div></div></body></html>`;
    return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "content-disposition": `inline; filename="${count.countNumber}.html"` } });
  } catch (error) { return apiError(error, meta.requestId); }
}
