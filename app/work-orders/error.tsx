"use client";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
export default function ErrorState({ reset }: { error: Error & { digest?: string }; reset: () => void }) { return <main className="grid min-h-[60vh] place-items-center p-6 text-center"><div><AlertCircle className="mx-auto size-10 text-red-600" /><h1 className="mt-3 text-xl font-bold">Work Orders could not load</h1><p className="mt-2 text-sm text-slate-600">Check the connection and try again.</p><Button className="mt-5" onClick={reset}><RefreshCw className="size-4" />Try again</Button></div></main>; }
