import AssetWorkspace from "@/components/assets/asset-workspace";
import { getCurrentSession } from "@/lib/auth/session";

export default async function AssetsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const [session, query] = await Promise.all([getCurrentSession(), searchParams]);
  return <AssetWorkspace initialTab={query.tab} permitted={session?.user.permissions.includes("ASSET_READ") ?? false} />;
}
