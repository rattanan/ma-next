"use client";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) { return <main className="grid min-h-[60vh] place-items-center p-6"><section className="max-w-lg rounded-xl border border-red-200 bg-white p-8 text-center shadow-sm"><AlertTriangle className="mx-auto size-10 text-red-600" /><h1 className="mt-4 text-xl font-bold">ไม่สามารถโหลด Dashboard ได้</h1><p className="mt-2 text-sm text-slate-600">ข้อมูลยังไม่ถูกแก้ไข กรุณาลองโหลดใหม่อีกครั้ง</p><Button className="mt-5" onClick={reset}><RefreshCw className="size-4" />ลองใหม่</Button></section></main>; }
