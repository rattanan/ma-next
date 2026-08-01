import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import type { NextRequest } from "next/server";
import { getRequestMeta, isSameOrigin } from "@/lib/auth/request";
import { requireSession } from "@/lib/auth/session";
import { registerAttachment } from "@/lib/attachments/service";
import { apiError, HttpError } from "@/lib/http";

const allowedTypes = new Map([
  ["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"], ["application/pdf", "pdf"],
  ["text/plain", "txt"], ["text/csv", "csv"], ["application/zip", "zip"],
  ["application/msword", "doc"], ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx"],
  ["application/vnd.ms-excel", "xls"], ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx"],
]);
const maximumBytes = 5 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const meta = getRequestMeta(request);
  try {
    if (!isSameOrigin(request)) throw new HttpError(403, "Invalid request origin", "CSRF_REJECTED");
    const form = await request.formData();
    const file = form.get("file");
    const entityType = String(form.get("entityType") ?? "");
    const entityId = String(form.get("entityId") ?? "");
    const session = await requireSession(request);
    const requiredPermission = entityType === "MAINTENANCE_NOTIFICATION_DRAFT" ? "CREATE_MAINTENANCE_NOTIFICATION" : entityType === "WORK_ORDER_BEFORE" || entityType === "WORK_ORDER_AFTER" ? "EXECUTE_WORK_ORDERS" : entityType === "ASSET" ? "ASSET_UPDATE" : "MANAGE_ATTACHMENTS";
    if (!session.user.permissions.includes(requiredPermission) && !(entityType === "ASSET" && session.user.permissions.includes("MANAGE_ATTACHMENTS"))) throw new HttpError(403, "You do not have permission to upload this attachment", "FORBIDDEN");
    if (!(file instanceof File) || !allowedTypes.has(file.type)) throw new HttpError(400, "Unsupported file type. Upload an image, PDF, text, ZIP, Word, or Excel file", "INVALID_FILE_TYPE");
    if (!entityType.match(/^[A-Z0-9_]{2,80}$/) || !entityId || file.size > maximumBytes) throw new HttpError(400, "Invalid attachment metadata or file exceeds 5 MB", "INVALID_ATTACHMENT");
    const extension = allowedTypes.get(file.type)!;
    const filename = `${randomUUID()}.${extension}`;
    const directory = path.join(process.cwd(), "storage", "uploads", "maintenance");
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, filename), Buffer.from(await file.arrayBuffer()), { flag: "wx" });
    const attachment = await registerAttachment({ entityType, entityId, originalName: file.name, contentType: file.type, byteSize: file.size, storageKey: `maintenance/${filename}` }, session.user, meta);
    return Response.json({ attachment: { ...attachment, contentUrl: `/api/attachments/${attachment.id}/content` } }, { status: 201 });
  } catch (error) { return apiError(error, meta.requestId); }
}
