import type { NextRequest } from "next/server";
import { z } from "zod";
import { getRequestMeta, isSameOrigin } from "@/lib/auth/request";
import { requirePermission } from "@/lib/auth/session";
import { apiError, HttpError } from "@/lib/http";
import { linkInventoryAttachment } from "@/lib/inventory/service";

const schema = z.object({ attachmentId: z.string().uuid() });
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { const meta = getRequestMeta(request); try { if (!isSameOrigin(request)) throw new HttpError(403, "Invalid request origin", "CSRF_REJECTED"); const session = await requirePermission(request, "VIEW_INVENTORY"); return Response.json(await linkInventoryAttachment((await params).id, schema.parse(await request.json()).attachmentId, session.user, meta), { status: 201 }); } catch (error) { return apiError(error, meta.requestId); } }
