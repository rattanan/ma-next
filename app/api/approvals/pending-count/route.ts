import type { NextRequest } from "next/server";
import { pendingApprovalCount } from "@/lib/approvals/service";
import { getRequestMeta } from "@/lib/auth/request";
import { requireSession } from "@/lib/auth/session";
import { apiError } from "@/lib/http";

export async function GET(request: NextRequest) {
  const meta = getRequestMeta(request);
  try { const session = await requireSession(request); return Response.json({ count: await pendingApprovalCount(session.user) }); }
  catch (error) { return apiError(error, meta.requestId); }
}
