import type { NextRequest } from "next/server";
import { getRequestMeta, isSameOrigin } from "@/lib/auth/request";
import { requirePermission } from "@/lib/auth/session";
import { apiError, HttpError } from "@/lib/http";
import { inventoryListQuerySchema, vendorMutationSchema } from "@/lib/inventory/validation";
import { createVendor, listVendors } from "@/lib/inventory/service";

export async function GET(request: NextRequest) { const meta = getRequestMeta(request); try { const session = await requirePermission(request, "VIEW_INVENTORY"); return Response.json(await listVendors(inventoryListQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams)), session.user)); } catch (error) { return apiError(error, meta.requestId); } }
export async function POST(request: NextRequest) { const meta = getRequestMeta(request); try { if (!isSameOrigin(request)) throw new HttpError(403, "Invalid request origin", "CSRF_REJECTED"); const session = await requirePermission(request, "INVENTORY_VENDOR_MANAGE"); return Response.json(await createVendor(vendorMutationSchema.parse(await request.json()), session.user, meta), { status: 201 }); } catch (error) { return apiError(error, meta.requestId); } }
