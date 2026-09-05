"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

export function QuickForm({ children, submit, submitLabel, onPendingChange }: { children: ReactNode; submit: (data: FormData) => Promise<unknown>; submitLabel: string; onPendingChange?: (pending: boolean) => void }) {
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    inFlight.current = true;
    setSubmitting(true); onPendingChange?.(true); setError(""); setSaved(false);
    try {
      const ok = await submit(data);
      if (ok) { form.reset(); setDirty(false); setSaved(true); }
      else setError("บันทึกไม่สำเร็จ ข้อมูลที่กรอกยังอยู่ กรุณาตรวจข้อความแจ้งเตือนแล้วลองใหม่");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "บันทึกไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      inFlight.current = false; setSubmitting(false); onPendingChange?.(false);
    }
  }
  return <form onSubmit={onSubmit} onChange={() => { setDirty(true); setSaved(false); }} className="mb-5 rounded-xl border bg-slate-50 p-4" aria-busy={submitting}>
    <fieldset disabled={submitting} className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}
      <div className="flex items-end sm:col-span-2 lg:col-span-3"><Button type="submit" className="min-h-12 w-full sm:w-auto" disabled={submitting}>{submitting && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />}{submitting ? "กำลังบันทึกและอัปโหลด…" : submitLabel}</Button></div>
    </fieldset>
    {dirty && !submitting && <p className="mt-3 text-xs text-slate-600">มีข้อมูลที่ยังไม่ได้บันทึก</p>}
    {saved && <p role="status" className="mt-3 text-sm text-emerald-800">บันทึกเรียบร้อยแล้ว</p>}
    {error && <Alert variant="destructive" className="mt-3" role="alert">{error}</Alert>}
  </form>;
}
