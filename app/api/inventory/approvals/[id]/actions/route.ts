import type { NextRequest } from "next/server";
import { getRequestMeta, isSameOrigin } from "@/lib/auth/request";
import { requirePermission } from "@/lib/auth/session";
import { apiError, HttpError } from "@/lib/http";
import { reviewInventoryApproval } from "@/lib/inventory/service";
import { inventoryApprovalActionSchema } from "@/lib/inventory/validation";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { const meta = getRequestMeta(request); try { if (!isSameOrigin(request)) throw new HttpError(403, "Invalid request origin", "CSRF_REJECTED"); const session = await requirePermission(request, "VIEW_APPROVAL_CENTER"); return Response.json(await reviewInventoryApproval((await params).id, inventoryApprovalActionSchema.parse(await request.json()), session.user, meta)); } catch (error) { return apiError(error, meta.requestId); } }
