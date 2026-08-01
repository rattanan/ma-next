import type { NextRequest } from "next/server";
import { getApprovalDetail } from "@/lib/approvals/service";
import { getRequestMeta } from "@/lib/auth/request";
import { requireSession } from "@/lib/auth/session";
import { apiError } from "@/lib/http";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const meta = getRequestMeta(request);
  try { const session = await requireSession(request); return Response.json(await getApprovalDetail((await params).id, session.user)); }
  catch (error) { return apiError(error, meta.requestId); }
}
