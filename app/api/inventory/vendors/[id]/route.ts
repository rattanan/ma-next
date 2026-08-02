import type { NextRequest } from "next/server";
import { getRequestMeta, isSameOrigin } from "@/lib/auth/request";
import { requirePermission } from "@/lib/auth/session";
import { apiError, HttpError } from "@/lib/http";
import { getVendor, updateVendor } from "@/lib/inventory/service";
import { vendorMutationSchema } from "@/lib/inventory/validation";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { const meta = getRequestMeta(request); try { const session = await requirePermission(request, "VIEW_INVENTORY"); return Response.json(await getVendor((await params).id, session.user)); } catch (error) { return apiError(error, meta.requestId); } }
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { const meta = getRequestMeta(request); try { if (!isSameOrigin(request)) throw new HttpError(403, "Invalid request origin", "CSRF_REJECTED"); const session = await requirePermission(request, "INVENTORY_VENDOR_MANAGE"); return Response.json(await updateVendor((await params).id, vendorMutationSchema.parse(await request.json()), session.user, meta)); } catch (error) { return apiError(error, meta.requestId); } }
