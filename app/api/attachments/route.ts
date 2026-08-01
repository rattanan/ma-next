import type { NextRequest } from "next/server";
import { z } from "zod";
import { getRequestMeta, isSameOrigin } from "@/lib/auth/request";
import { requirePermission } from "@/lib/auth/session";
import { apiError, HttpError } from "@/lib/http";
import { attachmentMetadataSchema } from "@/lib/attachments/validation";
import { listAttachments, registerAttachment } from "@/lib/attachments/service";

const querySchema = z.object({ entityType: z.string().min(2).max(80), entityId: z.string().min(1).max(80) });
export async function GET(request: NextRequest) { const meta = getRequestMeta(request); try { await requirePermission(request, "VIEW_ATTACHMENTS"); const query = querySchema.parse(Object.fromEntries(request.nextUrl.searchParams)); return Response.json({ attachments: await listAttachments(query.entityType, query.entityId) }); } catch (error) { return apiError(error, meta.requestId); } }
export async function POST(request: NextRequest) { const meta = getRequestMeta(request); try { if (!isSameOrigin(request)) throw new HttpError(403, "Invalid request origin", "CSRF_REJECTED"); const session = await requirePermission(request, "MANAGE_ATTACHMENTS"); const attachment = await registerAttachment(attachmentMetadataSchema.parse(await request.json()), session.user, meta); return Response.json({ attachment }, { status: 201 }); } catch (error) { return apiError(error, meta.requestId); } }
