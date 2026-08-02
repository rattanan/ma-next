import { VendorDetail } from "@/components/inventory/inventory-detail";

export default async function VendorDetailPage({ params }: { params: Promise<{ id: string }> }) { return <VendorDetail id={(await params).id} />; }
