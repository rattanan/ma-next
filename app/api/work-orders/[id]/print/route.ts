import type { NextRequest } from "next/server";
import { getRequestMeta } from "@/lib/auth/request";
import { requirePermission } from "@/lib/auth/session";
import { apiError } from "@/lib/http";
import { getWorkOrderDetail } from "@/lib/maintenance/service";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const meta = getRequestMeta(request);
  try {
    await requirePermission(request, "VIEW_MAINTENANCE");
    const detail = await getWorkOrderDetail((await params).id);
    if (request.nextUrl.searchParams.get("format") === "json") return Response.json(detail);
    const report = request.nextUrl.searchParams.get("report") ?? "detail";
    const title = report === "tool" ? "Equipment / Tool Loan Form" : report === "material" ? "Material Transaction Form" : "Work Order Detail";
    const rows = report === "tool"
      ? detail.toolLoans.map((item) => [item.toolCode, item.toolName, item.quantity, item.status, item.usageCondition, item.issuedAt, item.returnedAt])
      : report === "material"
        ? detail.usedSpareParts.map((item) => [item.code, item.name, item.transactionType, item.quantity, item.unit, item.warehouse, item.storageLocation, item.referenceDocument])
        : detail.tasks.map((item) => [item.sequence, item.kind, item.title, item.required ? "Required" : "Optional", item.status, item.result]);
    const headings = report === "tool"
      ? ["Code", "Tool", "Quantity", "Status", "Condition", "Issued", "Returned"]
      : report === "material"
        ? ["Code", "Material", "Transaction", "Quantity", "Unit", "Warehouse", "Location", "Reference"]
        : ["#", "Kind", "Job step / checklist", "Requirement", "Status", "Result"];
    return new Response(printHtml(title, detail.order, headings, rows), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "private, no-store" } });
  }
  catch (error) { return apiError(error, meta.requestId); }
}

const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]!);
const readableDate = (value: unknown) => value ? new Date(String(value)).toLocaleString("en-GB") : "";
function printHtml(title: string, order: Awaited<ReturnType<typeof getWorkOrderDetail>>["order"], headings: string[], rows: unknown[][]) {
  const cell = (value: unknown) => `<td>${escapeHtml(value)}</td>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(order.code)} — ${escapeHtml(title)}</title><style>@page{size:A4;margin:14mm}*{box-sizing:border-box}body{font:12px Arial,sans-serif;color:#172033;margin:0}header{border-bottom:3px solid #175cd3;padding-bottom:12px;margin-bottom:16px}h1{font-size:22px;margin:4px 0}h2{font-size:15px;margin:22px 0 8px}.meta{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.meta div{border:1px solid #d7deea;padding:8px}.meta b{display:block;font-size:10px;color:#56637a;text-transform:uppercase;margin-bottom:3px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #b9c3d3;padding:7px;text-align:left;vertical-align:top}th{background:#eef4ff}.signatures{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;margin-top:50px}.signature{border-top:1px solid #172033;padding-top:6px;text-align:center}.actions{margin-bottom:14px}@media print{.actions{display:none}}</style></head><body><div class="actions"><button onclick="window.print()">Print</button></div><header><div>MA Next — Intelligence Maintenance Management Platform</div><h1>${escapeHtml(title)}</h1><strong>${escapeHtml(order.code)} — ${escapeHtml(order.title)}</strong></header><section class="meta"><div><b>Status</b>${escapeHtml(order.status)}</div><div><b>Type</b>${escapeHtml(order.workType)}</div><div><b>Priority</b>${escapeHtml(order.priority)}</div><div><b>Asset</b>${escapeHtml(order.assetCode)} — ${escapeHtml(order.assetName)}</div><div><b>Department</b>${escapeHtml(order.departmentId)}</div><div><b>Crew</b>${escapeHtml(order.crewName)}</div><div><b>Planned start</b>${escapeHtml(readableDate(order.plannedStartAt))}</div><div><b>Due</b>${escapeHtml(readableDate(order.dueAt))}</div></section><h2>Description</h2><p>${escapeHtml(order.description)}</p><h2>${escapeHtml(title)} lines</h2><table><thead><tr>${headings.map((heading) => `<th>${escapeHtml(heading)}</th>`).join("")}</tr></thead><tbody>${rows.length ? rows.map((row) => `<tr>${row.map(cell).join("")}</tr>`).join("") : `<tr><td colspan="${headings.length}">No records</td></tr>`}</tbody></table><section class="signatures"><div class="signature">Prepared by / Date</div><div class="signature">Checked by / Date</div><div class="signature">Approved by / Date</div></section></body></html>`;
}
