import type { NextRequest } from "next/server";
import { getRequestMeta, isSameOrigin } from "@/lib/auth/request";
import { requirePermission } from "@/lib/auth/session";
import { apiError, HttpError } from "@/lib/http";
import { inventoryListQuerySchema, inventoryLocationMutationSchema } from "@/lib/inventory/validation";
import { createLocation, listLocations } from "@/lib/inventory/service";

export async function GET(request: NextRequest) { const meta = getRequestMeta(request); try { const session = await requirePermission(request, "VIEW_INVENTORY"); return Response.json(await listLocations(inventoryListQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams)), session.user)); } catch (error) { return apiError(error, meta.requestId); } }
export async function POST(request: NextRequest) { const meta = getRequestMeta(request); try { if (!isSameOrigin(request)) throw new HttpError(403, "Invalid request origin", "CSRF_REJECTED"); const session = await requirePermission(request, "INVENTORY_LOCATION_MANAGE"); return Response.json(await createLocation(inventoryLocationMutationSchema.parse(await request.json()), session.user, meta), { status: 201 }); } catch (error) { return apiError(error, meta.requestId); } }
