import { readFile } from "node:fs/promises";
import path from "node:path";
import type { NextRequest } from "next/server";
import { getRequestMeta } from "@/lib/auth/request";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { apiError, HttpError } from "@/lib/http";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const meta = getRequestMeta(request);
  try {
    await requirePermission(request, "VIEW_ATTACHMENTS");
    const { id } = await params;
    const attachment = await prisma.attachment.findFirst({ where: { id, deletedAt: null } });
    if (!attachment || attachment.driver !== "LOCAL" || !attachment.storageKey.startsWith("maintenance/")) throw new HttpError(404, "Attachment not found", "ATTACHMENT_NOT_FOUND");
    const root = path.join(process.cwd(), "storage", "uploads");
    const resolved = path.resolve(root, attachment.storageKey);
    if (!resolved.startsWith(`${path.resolve(root)}${path.sep}`)) throw new HttpError(400, "Invalid storage key", "INVALID_STORAGE_KEY");
    const disposition = request.nextUrl.searchParams.get("download") === "1" ? "attachment" : "inline";
    return new Response(await readFile(resolved), { headers: { "content-type": attachment.contentType, "cache-control": "private, max-age=300", "content-disposition": `${disposition}; filename="${attachment.originalName.replaceAll('"', '')}"` } });
  } catch (error) { return apiError(error, meta.requestId); }
}
