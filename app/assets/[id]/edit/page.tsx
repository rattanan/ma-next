import AssetForm from "@/components/assets/asset-form";
import { getCurrentSession } from "@/lib/auth/session";

export default async function EditAssetPage({ params }: { params: Promise<{ id: string }> }) {
  const [session, { id }] = await Promise.all([getCurrentSession(), params]);
  return <AssetForm mode="edit" assetId={id} permitted={session?.user.permissions.includes("ASSET_UPDATE") ?? false} />;
}
