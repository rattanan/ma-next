import type { NextRequest } from "next/server";
import { getRequestMeta, isSameOrigin } from "@/lib/auth/request";
import { requirePermission } from "@/lib/auth/session";
import { apiError, HttpError } from "@/lib/http";
import { getInventoryDocument, updateInventoryDocument } from "@/lib/inventory/service";
import { inventoryDocumentMutationSchema } from "@/lib/inventory/validation";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { const meta = getRequestMeta(request); try { const session = await requirePermission(request, "INVENTORY_REQUEST_VIEW"); return Response.json(await getInventoryDocument((await params).id, session.user)); } catch (error) { return apiError(error, meta.requestId); } }
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { const meta = getRequestMeta(request); try { if (!isSameOrigin(request)) throw new HttpError(403, "Invalid request origin", "CSRF_REJECTED"); const session = await requirePermission(request, "INVENTORY_REQUEST_CREATE"); return Response.json(await updateInventoryDocument((await params).id, inventoryDocumentMutationSchema.parse(await request.json()), session.user, meta)); } catch (error) { return apiError(error, meta.requestId); } }
