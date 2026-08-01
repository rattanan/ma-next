import AssetForm from "@/components/assets/asset-form";
import { getCurrentSession } from "@/lib/auth/session";

export default async function NewAssetPage() {
  const session = await getCurrentSession();
  return <AssetForm mode="create" permitted={session?.user.permissions.includes("ASSET_CREATE") ?? false} />;
}
