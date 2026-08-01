import type { NextRequest } from "next/server";
import { getRequestMeta } from "@/lib/auth/request";
import { requirePermission } from "@/lib/auth/session";
import { apiError } from "@/lib/http";
import { getWorkOrderCreateReferences } from "@/lib/work-orders/service";

export async function GET(request: NextRequest) {
  const meta = getRequestMeta(request);
  try { await requirePermission(request, "MANAGE_WORK_ORDERS"); return Response.json(await getWorkOrderCreateReferences()); }
  catch (error) { return apiError(error, meta.requestId); }
}
