"use client";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
export default function ApprovalError({ reset }: { error: Error; reset: () => void }) { return <div className="mx-auto max-w-xl p-8 text-center"><AlertTriangle className="mx-auto size-10 text-red-600" /><h1 className="mt-4 text-xl font-bold">เปิด Approve Center ไม่สำเร็จ</h1><p className="mt-2 text-sm text-slate-600">ลองโหลดข้อมูลอีกครั้ง หรือติดต่อผู้ดูแลระบบหากปัญหายังคงอยู่</p><Button className="mt-5" onClick={reset}>ลองอีกครั้ง</Button></div>; }
