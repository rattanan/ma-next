"use client";

import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AssetError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="grid min-h-[70vh] place-items-center p-6 text-center"><div className="max-w-md"><AlertCircle className="mx-auto mb-4 size-10 text-rose-600" /><h1 className="text-xl font-bold">Asset Management could not open</h1><p className="mt-2 text-sm text-slate-600">The workspace hit an unexpected error before asset data could be displayed.</p><Button className="mt-5" onClick={reset}><RefreshCw className="size-4" /> Try again</Button></div></main>;
}
