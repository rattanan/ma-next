import type { NextRequest } from "next/server";
import { getRequestMeta, isSameOrigin } from "@/lib/auth/request";
import { requirePermission } from "@/lib/auth/session";
import { apiError, HttpError } from "@/lib/http";
import { upsertVendorContact } from "@/lib/inventory/service";
import { vendorContactMutationSchema } from "@/lib/inventory/validation";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { const meta = getRequestMeta(request); try { if (!isSameOrigin(request)) throw new HttpError(403, "Invalid request origin", "CSRF_REJECTED"); const session = await requirePermission(request, "INVENTORY_VENDOR_MANAGE"); const body = await request.json(); return Response.json(await upsertVendorContact((await params).id, null, vendorContactMutationSchema.parse(body), session.user, meta), { status: 201 }); } catch (error) { return apiError(error, meta.requestId); } }
