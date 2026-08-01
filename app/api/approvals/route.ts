import type { NextRequest } from "next/server";
import { getRequestMeta } from "@/lib/auth/request";
import { requireSession } from "@/lib/auth/session";
import { listApprovals } from "@/lib/approvals/service";
import { approvalQuerySchema } from "@/lib/approvals/validation";
import { apiError } from "@/lib/http";

export async function GET(request: NextRequest) {
  const meta = getRequestMeta(request);
  try {
    const session = await requireSession(request);
    const query = approvalQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    return Response.json(await listApprovals(query, session.user));
  } catch (error) { return apiError(error, meta.requestId); }
}
