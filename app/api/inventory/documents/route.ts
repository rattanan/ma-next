import type { NextRequest } from "next/server";
import { getRequestMeta, isSameOrigin } from "@/lib/auth/request";
import { requirePermission } from "@/lib/auth/session";
import { apiError, HttpError } from "@/lib/http";
import { createInventoryDocument, listInventoryDocuments } from "@/lib/inventory/service";
import { inventoryDocumentMutationSchema, inventoryListQuerySchema } from "@/lib/inventory/validation";

export async function GET(request: NextRequest) { const meta = getRequestMeta(request); try { const session = await requirePermission(request, "INVENTORY_REQUEST_VIEW"); const params = Object.fromEntries(request.nextUrl.searchParams); return Response.json(await listInventoryDocuments({ ...inventoryListQuerySchema.parse(params), type: params.type as "ISSUE" | "RECEIPT" | "TRANSFER" | undefined, status: params.status }, session.user)); } catch (error) { return apiError(error, meta.requestId); } }
export async function POST(request: NextRequest) { const meta = getRequestMeta(request); try { if (!isSameOrigin(request)) throw new HttpError(403, "Invalid request origin", "CSRF_REJECTED"); const session = await requirePermission(request, "INVENTORY_REQUEST_CREATE"); return Response.json(await createInventoryDocument(inventoryDocumentMutationSchema.parse(await request.json()), session.user, meta), { status: 201 }); } catch (error) { return apiError(error, meta.requestId); } }
