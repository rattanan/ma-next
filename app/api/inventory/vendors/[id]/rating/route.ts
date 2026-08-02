import type { NextRequest } from "next/server";
import { getRequestMeta, isSameOrigin } from "@/lib/auth/request";
import { requirePermission } from "@/lib/auth/session";
import { apiError, HttpError } from "@/lib/http";
import { recalculateVendorRating, updateVendorRating } from "@/lib/inventory/service";
import { vendorRatingMutationSchema } from "@/lib/inventory/validation";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { const meta = getRequestMeta(request); try { if (!isSameOrigin(request)) throw new HttpError(403, "Invalid request origin", "CSRF_REJECTED"); const session = await requirePermission(request, "INVENTORY_VENDOR_MANAGE"); const body = await request.json().catch(() => ({})); return Response.json(Object.keys(body).length ? await updateVendorRating((await params).id, vendorRatingMutationSchema.parse(body), session.user, meta) : await recalculateVendorRating((await params).id, session.user, meta)); } catch (error) { return apiError(error, meta.requestId); } }
