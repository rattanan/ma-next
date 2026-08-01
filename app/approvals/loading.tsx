import { Skeleton } from "@/components/ui/skeleton";

export default function ApprovalLoading() { return <div className="mx-auto max-w-[96rem] space-y-4 p-5 md:p-8"><Skeleton className="h-24 w-full" /><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-28" />)}</div><Skeleton className="h-96 w-full" /></div>; }
