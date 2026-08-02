import { StockItemDetail } from "@/components/inventory/inventory-detail";

export default async function StockItemDetailPage({ params }: { params: Promise<{ id: string }> }) { return <StockItemDetail id={(await params).id} />; }
