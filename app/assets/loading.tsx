import { Skeleton } from "@/components/ui/skeleton";

export default function AssetLoading() {
  return <main className="space-y-4 p-4 md:p-6" aria-label="Loading Asset Management"><Skeleton className="h-16 max-w-lg" /><Skeleton className="h-16 rounded-2xl" /><div className="grid gap-4 lg:grid-cols-[22rem_1fr]"><Skeleton className="hidden h-[70vh] rounded-2xl lg:block" /><div className="space-y-4"><Skeleton className="h-40 rounded-2xl" /><Skeleton className="h-12 rounded-xl" /><Skeleton className="h-80 rounded-2xl" /></div></div></main>;
}
