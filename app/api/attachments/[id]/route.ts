import type { NextRequest } from "next/server";
import { getRequestMeta, isSameOrigin } from "@/lib/auth/request";
import { requireSession } from "@/lib/auth/session";
import { deleteAttachment, updateAssetAttachmentNote } from "@/lib/attachments/service";
import { attachmentUpdateSchema } from "@/lib/attachments/validation";
import { apiError, HttpError } from "@/lib/http";

type Context = { params: Promise<{ id: string }> };
async function authorize(request: NextRequest) {
  if (!isSameOrigin(request)) throw new HttpError(403, "Invalid request origin", "CSRF_REJECTED");
  const session = await requireSession(request);
  if (!session.user.permissions.includes("MANAGE_ATTACHMENTS") && !session.user.permissions.includes("ASSET_UPDATE")) throw new HttpError(403, "You do not have permission to manage this attachment", "FORBIDDEN");
  return session;
}
export async function PATCH(request: NextRequest, { params }: Context) { const meta = getRequestMeta(request); try { const session = await authorize(request); const { id } = await params; const { note } = attachmentUpdateSchema.parse(await request.json()); return Response.json(await updateAssetAttachmentNote(id, note, session.user, meta)); } catch (error) { return apiError(error, meta.requestId); } }
export async function DELETE(request: NextRequest, { params }: Context) { const meta = getRequestMeta(request); try { const session = await authorize(request); const { id } = await params; return Response.json(await deleteAttachment(id, session.user, meta)); } catch (error) { return apiError(error, meta.requestId); } }
