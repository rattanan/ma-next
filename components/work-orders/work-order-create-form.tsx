"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Loader2, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { workOrderCreateSchema } from "@/lib/maintenance/validation";

type Values = z.input<typeof workOrderCreateSchema>;
type Reference = { assets: Array<{ id: string; code: string; name: string; status: string }>; users: Array<{ id: string; fullName: string }>; departments: Array<{ id: string; name: string }> };

export default function WorkOrderCreateForm({ permitted }: { permitted: boolean }) {
  const router = useRouter(); const [refs, setRefs] = useState<Reference>({ assets: [], users: [], departments: [] }); const [apiError, setApiError] = useState("");
  const form = useForm<Values>({ resolver: zodResolver(workOrderCreateSchema), defaultValues: { sourceType: "MANUAL", workType: "CORRECTIVE", title: "", description: "", priority: "MEDIUM", severity: "MODERATE", equipmentOperatingStatus: "UNKNOWN", notes: "" } });
  useEffect(() => { fetch("/api/maintenance/overview").then((r) => r.json()).then(setRefs).catch(() => setApiError("Reference data could not be loaded.")); }, []);
  useEffect(() => { const warn = (event: BeforeUnloadEvent) => { if (form.formState.isDirty && !form.formState.isSubmitSuccessful) event.preventDefault(); }; addEventListener("beforeunload", warn); return () => removeEventListener("beforeunload", warn); }, [form.formState.isDirty, form.formState.isSubmitSuccessful]);
  async function submit(values: Values) {
    setApiError("");
    const payload = { ...values, departmentId: values.departmentId || null, assignedTo: values.assignedTo || null, leadUserId: values.leadUserId || null, supervisorId: values.supervisorId || null, plannedStartAt: values.plannedStartAt ? new Date(values.plannedStartAt).toISOString() : null, plannedFinishAt: values.plannedFinishAt ? new Date(values.plannedFinishAt).toISOString() : null, dueAt: values.dueAt ? new Date(values.dueAt).toISOString() : null, reportedAt: values.reportedAt ? new Date(values.reportedAt).toISOString() : null, estimatedMinutes: values.estimatedMinutes ? Number(values.estimatedMinutes) : null };
    const response = await fetch("/api/work-orders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }); const body = await response.json().catch(() => ({}));
    if (!response.ok) { setApiError(body.error || "Unable to create work order"); return; }
    router.push(`/work-orders/${body.order.id}`); router.refresh();
  }
  if (!permitted) return <main className="grid min-h-[60vh] place-items-center p-6"><Alert className="max-w-lg"><ShieldAlert className="size-5" />You can view Work Orders, but your role cannot create one.</Alert></main>;
  return <main className="mx-auto max-w-5xl space-y-5 p-4 md:p-6">
    <header><Button variant="ghost" asChild className="-ml-3"><Link href="/work-orders"><ArrowLeft className="size-4" />Back to Work Orders</Link></Button><h1 className="mt-2 text-2xl font-bold md:text-3xl">Create Work Order</h1><p className="mt-1 text-sm text-slate-600">Manual, preventive, shutdown and other assignment work use the same controlled record.</p></header>
    {apiError && <Alert variant="destructive" aria-live="assertive">{apiError}</Alert>}
    <form onSubmit={form.handleSubmit(submit)} className="space-y-5">
      <Section title="Source & work" description="Status is assigned by the workflow and cannot be edited here."><div className="grid gap-4 md:grid-cols-2">
        <Field label="Source type" error={form.formState.errors.sourceType?.message}><select {...form.register("sourceType")} className="wo-input"><option>MANUAL</option><option>PREVENTIVE_EVENT</option><option>SHUTDOWN_TASK</option><option>IMPORT</option></select></Field>
        <Field label="Source record" error={form.formState.errors.sourceRecordId?.message}><Input {...form.register("sourceRecordId")} placeholder="Required for non-manual sources" /></Field>
        <Field label="Work type" error={form.formState.errors.workType?.message}><select {...form.register("workType")} className="wo-input"><option>PREVENTIVE</option><option>CORRECTIVE</option><option>SHUTDOWN</option><option>OTHER_ASSIGNMENT</option></select></Field>
        <Field label="Primary asset" error={form.formState.errors.assetId?.message}><select {...form.register("assetId")} className="wo-input"><option value="">Select asset</option>{refs.assets.filter((asset) => asset.status === "ACTIVE").map((asset) => <option key={asset.id} value={asset.id}>{asset.code} — {asset.name}</option>)}</select></Field>
        <Field label="Title" error={form.formState.errors.title?.message} wide><Input {...form.register("title")} /></Field>
        <Field label="Work description" error={form.formState.errors.description?.message} wide><Textarea rows={4} {...form.register("description")} /></Field>
      </div></Section>
      <Section title="Priority & operating condition"><div className="grid gap-4 sm:grid-cols-3">
        <Field label="Priority"><select {...form.register("priority")} className="wo-input"><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>CRITICAL</option></select></Field>
        <Field label="Severity"><select {...form.register("severity")} className="wo-input"><option>MINOR</option><option>MODERATE</option><option>MAJOR</option><option>CRITICAL</option></select></Field>
        <Field label="Equipment status"><select {...form.register("equipmentOperatingStatus")} className="wo-input"><option>RUNNING</option><option>STOPPED</option><option>DEGRADED</option><option>UNKNOWN</option></select></Field>
      </div></Section>
      <Section title="Responsibility"><div className="grid gap-4 md:grid-cols-2">
        <Field label="Department"><select {...form.register("departmentId")} className="wo-input"><option value="">Unassigned</option>{refs.departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
        <Field label="Crew / team"><Input {...form.register("crewName")} /></Field>
        <Field label="Assigned technician"><select {...form.register("assignedTo")} className="wo-input"><option value="">Assign during planning</option>{refs.users.map((item) => <option key={item.id} value={item.id}>{item.fullName}</option>)}</select></Field>
        <Field label="Lead"><select {...form.register("leadUserId")} className="wo-input"><option value="">None</option>{refs.users.map((item) => <option key={item.id} value={item.id}>{item.fullName}</option>)}</select></Field>
        <Field label="Supervisor"><select {...form.register("supervisorId")} className="wo-input"><option value="">None</option>{refs.users.map((item) => <option key={item.id} value={item.id}>{item.fullName}</option>)}</select></Field>
        <Field label="Vendor / manufacturer"><Input {...form.register("vendorName")} /></Field>
        <Field label="Customer"><Input {...form.register("customerName")} /></Field>
        <Field label="Reporter"><Input {...form.register("reporterName")} /></Field>
        <Field label="Reporter phone"><Input {...form.register("reporterPhone")} /></Field>
      </div></Section>
      <Section title="Schedule & notes"><div className="grid gap-4 md:grid-cols-2">
        <Field label="Reported date"><Input type="datetime-local" {...form.register("reportedAt")} /></Field><Field label="Planned start"><Input type="datetime-local" {...form.register("plannedStartAt")} /></Field><Field label="Planned finish" error={form.formState.errors.plannedFinishAt?.message}><Input type="datetime-local" {...form.register("plannedFinishAt")} /></Field><Field label="Required completion"><Input type="datetime-local" {...form.register("dueAt")} /></Field><Field label="Estimated duration (minutes)"><Input type="number" min={0} {...form.register("estimatedMinutes")} /></Field><Field label="Notes" wide><Textarea rows={3} {...form.register("notes")} /></Field>
      </div></Section>
      <div className="sticky bottom-3 flex justify-end gap-3 rounded-xl border bg-white/95 p-3 shadow-lg backdrop-blur"><Button variant="outline" asChild><Link href="/work-orders">Cancel</Link></Button><Button type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting && <Loader2 className="size-4 animate-spin" />}Create Work Order</Button></div>
    </form>
  </main>;
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) { return <Card><CardContent className="p-5"><h2 className="text-lg font-bold">{title}</h2>{description && <p className="mb-4 text-sm text-slate-600">{description}</p>}<div className={description ? "" : "mt-4"}>{children}</div></CardContent></Card>; }
function Field({ label, error, wide, children }: { label: string; error?: string; wide?: boolean; children: React.ReactNode }) { return <div className={wide ? "md:col-span-2" : ""}><Label className="mb-2 block">{label}</Label>{children}{error && <p className="mt-1 text-sm text-red-700" role="alert">{error}</p>}</div>; }
