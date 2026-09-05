"use client";
import { useRef, useState, type FormEvent, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { purchaseEditPayload, type EditablePurchase } from "@/lib/purchasing/edit-payload";

export function PurchaseEditDialog({ kind, id, onSaved }: { kind: "request" | "order"; id: string; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [document, setDocument] = useState<EditablePurchase | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const endpoint = `/api/purchase-${kind === "request" ? "requests" : "orders"}/${id}`;
  async function load() {
    setLoading(true); setError(""); setDocument(null);
    try {
      const response = await fetch(endpoint); const body = await response.json();
      if (!response.ok) throw new Error(body.error || "โหลดเอกสารไม่สำเร็จ");
      const value = body[kind] as EditablePurchase;
      if (!["DRAFT", "RETURNED_FOR_REVISION"].includes(value.status)) throw new Error("สถานะเอกสารเปลี่ยนแล้ว กรุณารีเฟรชรายการก่อนแก้ไข");
      setDocument(value);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "โหลดเอกสารไม่สำเร็จ"); }
    finally { setLoading(false); }
  }
  function field(key: "remark" | "internalRemark" | "headerDiscountAmount" | "vatAmount" | "currencyCode" | "exchangeRateToThb", value: string) { setDocument((current) => current ? { ...current, [key]: value } : current); }
  function lineField(index: number, key: "quantity" | "estimatedUnitPrice" | "unitPrice" | "discountAmount" | "itemDiscountAmount" | "remark", value: string) {
    setDocument((current) => current ? { ...current, lines: current.lines.map((line, i) => i === index ? { ...line, [key]: value } : line) } : current);
  }
  async function save(event: FormEvent) {
    event.preventDefault(); if (!document || lock.current) return;
    lock.current = true; setSaving(true); setError("");
    try {
      const response = await fetch(endpoint, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(purchaseEditPayload(kind, document)) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error || "บันทึกไม่สำเร็จ");
      setOpen(false); onSaved();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "บันทึกไม่สำเร็จ ข้อมูลที่แก้ไขยังอยู่"); }
    finally { lock.current = false; setSaving(false); }
  }
  return <Dialog.Root open={open} onOpenChange={(next) => { if (saving) return; setOpen(next); if (next) void load(); }}>
    <Dialog.Trigger asChild><Button variant="outline" size="sm">แก้ไขรายการและราคา</Button></Dialog.Trigger>
    <Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/45" /><Dialog.Content onPointerDownOutside={(event) => event.preventDefault()} className="fixed left-1/2 top-1/2 z-50 max-h-[90dvh] w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border bg-white p-5 shadow-xl">
      <Dialog.Title className="text-xl font-bold">แก้ไข {document?.requestNumber ?? document?.orderNumber ?? "เอกสาร"}</Dialog.Title>
      <Dialog.Description className="mt-2 text-sm text-slate-600">แก้จำนวน ราคา ส่วนลด และหมายเหตุของรายการเดิม บันทึกเป็นร่างแล้วกดส่งขออนุมัติจากรายการอีกครั้ง ข้อมูลอ้างอิงและผู้ขายเดิมจะคงอยู่</Dialog.Description>
      {loading && <p role="status" className="py-8">กำลังโหลดข้อมูลล่าสุด…</p>}
      {error && !document && <Alert role="alert" variant="destructive" className="my-4">{error}</Alert>}
      {!loading && !document && <Button variant="outline" onClick={() => void load()}>ลองใหม่</Button>}
      {document && <form onSubmit={(event) => void save(event)}><fieldset disabled={saving} className="mt-5 min-w-0 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2"><Field label="สกุลเงิน"><input className="wo-input" required minLength={3} maxLength={10} value={document.currencyCode} onChange={(e) => field("currencyCode", e.target.value.toUpperCase())} /></Field><Field label="อัตราแลกเปลี่ยนเป็นบาท"><input className="wo-input" type="number" min="0.000001" step="0.000001" required value={document.exchangeRateToThb} onChange={(e) => field("exchangeRateToThb", e.target.value)} /></Field></div>
        {document.lines.map((line, index) => <section key={line.id} className="rounded-xl border p-3"><h3 className="font-semibold">{index + 1}. {line.stockCodeSnapshot} · {line.description}</h3><div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Field label={`จำนวน ${index + 1}`}><input className="wo-input" type="number" min="0.000001" step="0.000001" required value={line.quantity} onChange={(e) => lineField(index, "quantity", e.target.value)} /></Field>
          <Field label={`ราคาต่อหน่วย ${index + 1}`}><input className="wo-input" type="number" min="0" step="0.000001" required value={kind === "request" ? line.estimatedUnitPrice : line.unitPrice} onChange={(e) => lineField(index, kind === "request" ? "estimatedUnitPrice" : "unitPrice", e.target.value)} /></Field>
          <Field label={`ส่วนลด ${index + 1}`}><input className="wo-input" type="number" min="0" step="0.000001" required value={(kind === "request" ? line.discountAmount : line.itemDiscountAmount) ?? "0"} onChange={(e) => lineField(index, kind === "request" ? "discountAmount" : "itemDiscountAmount", e.target.value)} /></Field>
        </div><Field label={`หมายเหตุรายการ ${index + 1}`}><textarea className="wo-input mt-2" maxLength={4000} value={line.remark ?? ""} onChange={(e) => lineField(index, "remark", e.target.value)} /></Field></section>)}
        {kind === "order" && <div className="grid gap-3 sm:grid-cols-2">{(["headerDiscountAmount", "vatAmount"] as const).map((key) => <Field key={key} label={key === "vatAmount" ? "ภาษีมูลค่าเพิ่ม" : "ส่วนลดท้ายเอกสาร"}><input className="wo-input" type="number" min="0" step="0.000001" required value={document[key] ?? "0"} onChange={(e) => field(key, e.target.value)} /></Field>)}</div>}
        <Field label="หมายเหตุเอกสาร"><textarea className="wo-input" maxLength={10000} value={document.remark ?? ""} onChange={(e) => field("remark", e.target.value)} /></Field>
        {kind === "order" && <Field label="หมายเหตุภายใน"><textarea className="wo-input" maxLength={10000} value={document.internalRemark ?? ""} onChange={(e) => field("internalRemark", e.target.value)} /></Field>}
        {error && <Alert role="alert" variant="destructive">{error}</Alert>}
        <Button type="submit" className="min-h-12">{saving ? "กำลังบันทึก…" : "บันทึกการแก้ไขเป็นร่าง"}</Button>
      </fieldset></form>}
      <Dialog.Close asChild><Button variant="outline" disabled={saving} className="mt-3 min-h-11">ปิด</Button></Dialog.Close>
    </Dialog.Content></Dialog.Portal>
  </Dialog.Root>;
}
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="grid min-w-0 gap-1 text-sm font-medium"><span>{label}</span>{children}</label>; }
