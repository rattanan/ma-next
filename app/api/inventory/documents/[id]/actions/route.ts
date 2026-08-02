import type { NextRequest } from "next/server";
import { getRequestMeta, isSameOrigin } from "@/lib/auth/request";
import { requireSession } from "@/lib/auth/session";
import { apiError, HttpError } from "@/lib/http";
import { inventoryDocumentActionSchema } from "@/lib/inventory/validation";
import { cancelInventoryDocument, submitInventoryDocument } from "@/lib/inventory/service";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { const meta = getRequestMeta(request); try { if (!isSameOrigin(request)) throw new HttpError(403, "Invalid request origin", "CSRF_REJECTED"); const session = await requireSession(request); const input = inventoryDocumentActionSchema.parse(await request.json()); const id = (await params).id; if (input.action === "SUBMIT") return Response.json(await submitInventoryDocument(id, session.user, meta)); if (input.action === "CANCEL") return Response.json(await cancelInventoryDocument(id, session.user, meta)); throw new HttpError(501, "Use Approval Center for inventory review actions", "APPROVAL_ACTION_ROUTE_REQUIRED"); } catch (error) { return apiError(error, meta.requestId); } }
