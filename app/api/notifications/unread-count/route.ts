import type { NextRequest } from "next/server";
import { getRequestMeta } from "@/lib/auth/request";
import { requirePermission } from "@/lib/auth/session";
import { apiError } from "@/lib/http";
import { countUnreadNotifications } from "@/lib/notifications/service";

export async function GET(request: NextRequest) {
  const meta = getRequestMeta(request);
  try {
    const session = await requirePermission(request, "VIEW_NOTIFICATIONS");
    return Response.json({ count: await countUnreadNotifications(session.user.id) });
  } catch (error) { return apiError(error, meta.requestId); }
}
