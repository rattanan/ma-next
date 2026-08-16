import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestMeta } from "@/lib/auth/request";
import { requireSession } from "@/lib/auth/session";
import { apiError, HttpError } from "@/lib/http";

export async function GET(request: NextRequest) {
  const meta = getRequestMeta(request);
  try {
    const session = await requireSession(request);
    const actor = session.user;
    const allowed = actor.role === "ADMIN" || actor.roleCodes?.includes("ADMIN") || actor.permissions.includes("VIEW_INVENTORY") || actor.permissions.includes("PURCHASE_REQUEST_VIEW");
    if (!allowed) throw new HttpError(403, "Stock item search permission is required", "FORBIDDEN");
    const q = (request.nextUrl.searchParams.get("q")?.trim() ?? "").slice(0, 190);
    if (q.length < 2) return Response.json({ items: [] });
    const limit = Math.min(50, Math.max(5, Math.floor(Number(request.nextUrl.searchParams.get("limit")) || 20)));
    const items = await prisma.stockItem.findMany({
      where: { active: true, OR: [{ code: { contains: q } }, { name: { contains: q } }, { partNumber: { contains: q } }, { barcode: { contains: q } }] },
      select: { id: true, code: true, name: true, unit: true },
      orderBy: { code: "asc" },
      take: limit,
    });
    return Response.json({ items });
  } catch (error) {
    return apiError(error, meta.requestId);
  }
}
