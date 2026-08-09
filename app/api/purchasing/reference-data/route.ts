import type { NextRequest } from "next/server";
import { getRequestMeta } from "@/lib/auth/request";
import { requireSession } from "@/lib/auth/session";
import { apiError } from "@/lib/http";
import { getPurchasingReferenceData } from "@/lib/purchasing/service";

export async function GET(request: NextRequest) {
  const meta = getRequestMeta(request);
  try { const session = await requireSession(request); return Response.json(await getPurchasingReferenceData(session.user)); }
  catch (error) { return apiError(error, meta.requestId); }
}
