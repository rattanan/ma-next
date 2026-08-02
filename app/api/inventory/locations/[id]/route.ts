import type { NextRequest } from "next/server";
import { getRequestMeta, isSameOrigin } from "@/lib/auth/request";
import { requirePermission } from "@/lib/auth/session";
import { apiError, HttpError } from "@/lib/http";
import { updateLocation } from "@/lib/inventory/service";
import { inventoryLocationMutationSchema } from "@/lib/inventory/validation";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { const meta = getRequestMeta(request); try { if (!isSameOrigin(request)) throw new HttpError(403, "Invalid request origin", "CSRF_REJECTED"); const session = await requirePermission(request, "INVENTORY_LOCATION_MANAGE"); return Response.json(await updateLocation((await params).id, inventoryLocationMutationSchema.parse(await request.json()), session.user, meta)); } catch (error) { return apiError(error, meta.requestId); } }
