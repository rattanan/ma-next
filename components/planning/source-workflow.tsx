"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

export function SourceWorkflow({ id, status, permissions, tasks, reload }: { id: string; status: string; permissions: string[]; tasks: { id: string; title: string; status: string }[]; reload: () => Promise<void> }) {
  const [note, setNote] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const can = (p: string) => permissions.includes(p);
  if (["CLOSED", "CANCELLED"].includes(status)) return <section className="rounded-xl border border-blue-200 bg-blue-50 p-4"><h2 className="font-semibold">Project / PM work execution</h2><p className="mt-2 text-sm">{status === "CLOSED" ? "WO ปิดแล้ว — ดูผลอัปเดตได้จากลิงก์ต้นทางด้านล่าง" : "WO ถูกยกเลิก — งานต้นทางยังต้องให้ผู้วางแผนพิจารณา"}</p></section>;
  async function run(command: string, body: unknown, task = false) {
    setBusy(true); setError("");
    try { const r = await fetch(task ? `/api/work-orders/${id}/commands/task-status` : `/api/maintenance/workflow/work-orders/${id}/commands/${command}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const data = await r.json(); if (!r.ok) throw new Error(data.error || "Command failed"); await reload(); } catch (e) { setError(e instanceof Error ? e.message : "Command failed"); } finally { setBusy(false); }
  }
  return <section className="space-y-4 rounded-xl border border-blue-200 bg-blue-50 p-5"><h2 className="font-semibold">Project / PM work execution</h2><p className="text-sm">เมื่อปิด WO สำเร็จ ระบบจะอัปเดตงานต้นทางอัตโนมัติ</p><label className="block text-sm">บันทึก / เหตุผล<Textarea value={note} onChange={e => setNote(e.target.value)} /></label>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    <div className="flex flex-wrap gap-2">
      {status === "OPERATOR_REJECTED" && can("WORK_ORDER_RETURN_FOR_RECHECK") && <Button disabled={busy || note.length < 3} onClick={() => run("return-operator-rejection", { decision: "RETURN", comment: note, requiredActions: [note] })}>ส่งให้ช่างแก้ไขตามผลตรวจรับ</Button>}
      {status === "ASSIGNED" && can("WORK_ORDER_ACCEPT_ASSIGNMENT") && <Button disabled={busy || note.length < 3} onClick={() => run("accept-assignment", { note })}>รับมอบหมาย</Button>}
      {["TECHNICIAN_ACCEPTED", "RETURNED_TO_TECHNICIAN"].includes(status) && can("WORK_ORDER_START") && <Button disabled={busy || note.length < 3} onClick={() => run("start", { note })}>เริ่มงาน</Button>}
      {["TECHNICIAN_COMPLETED", "UNDER_MANAGER_REVIEW"].includes(status) && can("WORK_ORDER_APPROVE_COMPLETION") && <><Button disabled={busy || note.length < 3} onClick={() => run("manager-decision", { decision: "APPROVE", comment: note })}>อนุมัติผล</Button><Button variant="outline" disabled={busy || note.length < 3} onClick={() => run("manager-decision", { decision: "RETURN", comment: note, requiredActions: [note] })}>ส่งกลับแก้ไข</Button></>}
      {status === "WAITING_FOR_OPERATOR_ACCEPTANCE" && can("NOTIFICATION_ACCEPT_WORK") && <><Button disabled={busy || note.length < 3} onClick={() => run("operator-decision", { decision: "ACCEPT", comment: note })}>ตรวจรับงาน</Button><Button variant="outline" disabled={busy || note.length < 3} onClick={() => run("operator-decision", { decision: "REJECT", reason: note, remainingProblem: note })}>ไม่ผ่านการตรวจรับ</Button></>}
      {status === "OPERATOR_ACCEPTED" && can("WORK_ORDER_CLOSE") && <Button disabled={busy || note.length < 3} onClick={() => run("close", { note })}>ปิด WO และอัปเดตต้นทาง</Button>}
    </div>
    {status === "IN_PROGRESS" && can("WORK_ORDER_UPDATE_PROGRESS") && <div className="space-y-2">{tasks.map(t => <div key={t.id} className="flex items-center justify-between gap-3 rounded bg-white p-3"><span>{t.title} · {t.status}</span>{t.status !== "COMPLETED" && <Button disabled={busy} variant="outline" onClick={() => run("task-status", { taskId: t.id, status: "COMPLETED" }, true)}>ขั้นตอนเสร็จแล้ว</Button>}</div>)}</div>}
    {status === "IN_PROGRESS" && can("WORK_ORDER_SUBMIT_COMPLETION") && <details><summary className="cursor-pointer font-semibold">บันทึกผลและส่งตรวจ</summary><form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={e => { e.preventDefault(); const values = Object.fromEntries(new FormData(e.currentTarget)); void run("submit-completion", { ...values, laborMinutes: Number(values.laborMinutes), partsFinalized: values.partsFinalized === "on" }); }}>{[{ key: "diagnosis", label: "สภาพที่ตรวจพบ" }, { key: "rootCause", label: "สาเหตุ / ลักษณะงานตามแผน" }, { key: "correctiveAction", label: "การดำเนินงาน" }, { key: "workSummary", label: "สรุปผลงาน" }, { key: "testProcedure", label: "วิธีทดสอบ" }, { key: "testResult", label: "ผลทดสอบ" }].map(f => <label key={f.key} className="text-sm">{f.label}<Textarea required minLength={3} name={f.key} /></label>)}<label className="text-sm">เวลาทำงาน (นาที)<Input type="number" name="laborMinutes" required min={1} /></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="partsFinalized" required />ยืนยันบันทึกการใช้อะไหล่ครบแล้ว</label><Button disabled={busy}>ส่งตรวจ</Button></form></details>}
  </section>;
}
