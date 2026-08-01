import AssetWorkspace from "@/components/assets/asset-workspace";
import { getCurrentSession } from "@/lib/auth/session";

export default async function AssetDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const [session, { id }, query] = await Promise.all([getCurrentSession(), params, searchParams]);
  return <AssetWorkspace initialAssetId={id} initialTab={query.tab} permitted={session?.user.permissions.includes("ASSET_READ") ?? false} />;
}
