import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import type { NextRequest } from "next/server";
import { getRequestMeta, isSameOrigin } from "@/lib/auth/request";
import { requirePermission } from "@/lib/auth/session";
import { registerAttachment } from "@/lib/attachments/service";
import { apiError, HttpError } from "@/lib/http";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maximumBytes = 5 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const meta = getRequestMeta(request);
  try {
    if (!isSameOrigin(request)) throw new HttpError(403, "Invalid request origin", "CSRF_REJECTED");
    const session = await requirePermission(request, "MANAGE_ATTACHMENTS");
    const form = await request.formData();
    const file = form.get("file");
    const entityType = String(form.get("entityType") ?? "");
    const entityId = String(form.get("entityId") ?? "");
    if (!(file instanceof File) || !allowedTypes.has(file.type)) throw new HttpError(400, "A JPEG, PNG, or WebP image is required", "INVALID_PHOTO");
    if (!entityType.match(/^[A-Z0-9_]{2,80}$/) || !entityId || file.size > maximumBytes) throw new HttpError(400, "Invalid attachment metadata or file exceeds 5 MB", "INVALID_ATTACHMENT");
    const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const filename = `${randomUUID()}.${extension}`;
    const directory = path.join(process.cwd(), "storage", "uploads", "maintenance");
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, filename), Buffer.from(await file.arrayBuffer()), { flag: "wx" });
    const attachment = await registerAttachment({ entityType, entityId, originalName: file.name, contentType: file.type, byteSize: file.size, storageKey: `maintenance/${filename}` }, session.user, meta);
    return Response.json({ attachment }, { status: 201 });
  } catch (error) { return apiError(error, meta.requestId); }
}
