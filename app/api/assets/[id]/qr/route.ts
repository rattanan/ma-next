import QRCode from "qrcode";
import type { NextRequest } from "next/server";
import { getRequestMeta } from "@/lib/auth/request";
import { requirePermission } from "@/lib/auth/session";
import { getAssetDetail } from "@/lib/assets/service";
import { apiError } from "@/lib/http";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const meta = getRequestMeta(request);
  try {
    await requirePermission(request, "ASSET_READ");
    const { id } = await context.params;
    await getAssetDetail(id);
    const target = `${request.nextUrl.origin}/assets/${encodeURIComponent(id)}`;
    const svg = await QRCode.toString(target, { type: "svg", errorCorrectionLevel: "M", margin: 2, width: 320, color: { dark: "#0b2a4a", light: "#ffffff" } });
    return new Response(svg, { headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": "private, max-age=300", "Content-Disposition": `inline; filename="asset-${id}.svg"` } });
  } catch (error) { return apiError(error, meta.requestId); }
}
