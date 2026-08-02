import type { NextRequest } from "next/server";
import { getRequestMeta } from "@/lib/auth/request";
import { requirePermission } from "@/lib/auth/session";
import { apiError } from "@/lib/http";
import { listMovements } from "@/lib/inventory/service";
import { inventoryReportQuerySchema } from "@/lib/inventory/validation";

export async function GET(request: NextRequest) { const meta = getRequestMeta(request); try { const session = await requirePermission(request, "INVENTORY_REPORT_VIEW"); return Response.json(await listMovements(inventoryReportQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams)), session.user)); } catch (error) { return apiError(error, meta.requestId); } }
