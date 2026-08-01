import type { NextRequest } from "next/server";
import { getRequestMeta, isSameOrigin } from "@/lib/auth/request";
import { requirePermission } from "@/lib/auth/session";
import { apiError, HttpError } from "@/lib/http";
import { workOrderCreateSchema, workOrderListSchema } from "@/lib/maintenance/validation";
import { createWorkOrder, listWorkOrders } from "@/lib/work-orders/service";

export async function GET(request: NextRequest) {
  const meta = getRequestMeta(request);
  try {
    await requirePermission(request, "VIEW_MAINTENANCE");
    return Response.json(await listWorkOrders(workOrderListSchema.parse(Object.fromEntries(request.nextUrl.searchParams))));
  } catch (error) { return apiError(error, meta.requestId); }
}

export async function POST(request: NextRequest) {
  const meta = getRequestMeta(request);
  try {
    if (!isSameOrigin(request)) throw new HttpError(403, "Invalid request origin", "CSRF_REJECTED");
    const session = await requirePermission(request, "MANAGE_WORK_ORDERS");
    const order = await createWorkOrder(workOrderCreateSchema.parse(await request.json()), session.user, meta);
    return Response.json({ order }, { status: 201 });
  } catch (error) { return apiError(error, meta.requestId); }
}
