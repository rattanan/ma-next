import type { NextRequest } from "next/server";
import { getRequestMeta } from "@/lib/auth/request";
import { requirePermission } from "@/lib/auth/session";
import { apiError } from "@/lib/http";
import { listAvailableReceiptSources } from "@/lib/inventory/service";
import { inventoryReceiptSourceQuerySchema } from "@/lib/inventory/validation";

export async function GET(request: NextRequest) {
  const meta = getRequestMeta(request);
  try {
    const session = await requirePermission(request, "INVENTORY_REQUEST_CREATE");
    return Response.json(await listAvailableReceiptSources(inventoryReceiptSourceQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams)), session.user));
  } catch (error) {
    return apiError(error, meta.requestId);
  }
}
