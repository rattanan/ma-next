import type { NextRequest } from "next/server";
import { getRequestMeta, isSameOrigin } from "@/lib/auth/request";
import { requirePermission } from "@/lib/auth/session";
import { apiError, HttpError } from "@/lib/http";
import { getWorkOrderDetail } from "@/lib/maintenance/service";
import { workOrderUpdateSchema } from "@/lib/maintenance/validation";
import { updateWorkOrder } from "@/lib/work-orders/service";

type Context = { params: Promise<{ id: string }> };
export async function GET(request: NextRequest, context: Context) {
  const meta = getRequestMeta(request);
  try { await requirePermission(request, "VIEW_MAINTENANCE"); return Response.json(await getWorkOrderDetail((await context.params).id)); }
  catch (error) { return apiError(error, meta.requestId); }
}
export async function PATCH(request: NextRequest, context: Context) {
  const meta = getRequestMeta(request);
  try {
    if (!isSameOrigin(request)) throw new HttpError(403, "Invalid request origin", "CSRF_REJECTED");
    const session = await requirePermission(request, "MANAGE_WORK_ORDERS");
    return Response.json(await updateWorkOrder((await context.params).id, workOrderUpdateSchema.parse(await request.json()), session.user, meta));
  } catch (error) { return apiError(error, meta.requestId); }
}
