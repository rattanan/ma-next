import type { NextRequest } from "next/server";
import { getRequestMeta } from "@/lib/auth/request";
import { requirePermission } from "@/lib/auth/session";
import { apiError } from "@/lib/http";
import { inventoryDashboard } from "@/lib/inventory/service";

export async function GET(request: NextRequest) {
  const meta = getRequestMeta(request);
  try { const session = await requirePermission(request, "VIEW_INVENTORY"); return Response.json(await inventoryDashboard(session.user)); }
  catch (error) { return apiError(error, meta.requestId); }
}
