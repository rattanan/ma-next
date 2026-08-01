"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ImagePlus, Loader2, Save, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import type { z } from "zod";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { assetMutationSchema } from "@/lib/assets/validation";

type Values = z.input<typeof assetMutationSchema>;
type Reference = {
  types: Array<{ id: string; code: string; name: string }>;
  categories: Array<{ id: string; code: string; name: string }>;
  assets: Array<{ id: string; code: string; name: string; structureLevel: string; status: string }>;
  users: Array<{ id: string; fullName: string }>;
  contracts: Array<{ id: string; code: string; name: string }>;
  customFields: Array<{ id: string; assetCategoryId: string | null; groupId: string; groupName: string; label: string; description: string | null; fieldType: "STRING" | "NUMBER" | "ARRAY" | "DATE"; placeholder: string | null; defaultValue: string | null; availableValues: string | null; unit: string | null; sortOrder: number; active: boolean }>;
};
type Detail = { asset: Record<string, unknown> & { id: string; code: string; name: string; description: string | null; assetTypeId: string; assetCategoryId: string | null; parentAssetId: string | null; structureLevel: "SYSTEM" | "EQUIPMENT" | "COMPONENT"; location: string; criticality: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"; status: "ACTIVE" | "OFFLINE" | "RESERVED" | "INACTIVE" | "RETIRED"; ownerUserId: string | null; contractId: string | null; primaryImagePath: string | null; unit: string | null; serialNumber: string | null; maintenanceInterval: number | null; runningHourCode: string | null; budgetId: string | null; gpsCoordinates: string | null; costCenterLegacyId: number | null; budgetReferenceLegacyId: number | null; inventoryLocationLegacyId: number | null; inventoryLocationName: string | null }; customFields: Array<{ definitionId: string; value: string | null }> };

const defaults: Values = { code: "", name: "", description: "", assetTypeId: "", assetCategoryId: null, parentAssetId: null, structureLevel: "EQUIPMENT", location: "", criticality: "MEDIUM", status: "ACTIVE", ownerUserId: null, contractId: null, primaryImagePath: null, unit: null, serialNumber: null, maintenanceInterval: null, runningHourCode: null, budgetId: null, gpsCoordinates: null, costCenterLegacyId: null, budgetReferenceLegacyId: null, inventoryLocationLegacyId: null, inventoryLocationName: null, customFields: {} };

export default function AssetForm({ mode, assetId, permitted }: { mode: "create" | "edit"; assetId?: string; permitted: boolean }) {
  const router = useRouter(); const [refs, setRefs] = useState<Reference | null>(null); const [detail, setDetail] = useState<Detail | null>(null); const [error, setError] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null); const [uploading, setUploading] = useState(false);
  const form = useForm<Values>({ resolver: zodResolver(assetMutationSchema), defaultValues: defaults });
  useEffect(() => {
    if (!permitted) return;
    const requests: Promise<unknown>[] = [fetch("/api/assets/reference-data").then(read)];
    if (mode === "edit" && assetId) requests.push(fetch(`/api/assets/${assetId}`).then(read));
    Promise.all(requests).then(([reference, record]) => {
      const nextRefs = reference as Reference; setRefs(nextRefs);
      if (record) {
        const nextDetail = record as Detail; setDetail(nextDetail);
        const asset = nextDetail.asset;
        form.reset({ code: asset.code, name: asset.name, description: asset.description ?? "", assetTypeId: asset.assetTypeId, assetCategoryId: asset.assetCategoryId, parentAssetId: asset.parentAssetId, structureLevel: asset.structureLevel, location: asset.location, criticality: asset.criticality, status: asset.status, ownerUserId: asset.ownerUserId, contractId: asset.contractId, primaryImagePath: asset.primaryImagePath, unit: asset.unit, serialNumber: asset.serialNumber, maintenanceInterval: asset.maintenanceInterval, runningHourCode: asset.runningHourCode, budgetId: asset.budgetId, gpsCoordinates: asset.gpsCoordinates, costCenterLegacyId: asset.costCenterLegacyId, budgetReferenceLegacyId: asset.budgetReferenceLegacyId, inventoryLocationLegacyId: asset.inventoryLocationLegacyId, inventoryLocationName: asset.inventoryLocationName, customFields: Object.fromEntries(nextDetail.customFields.map((field) => [field.definitionId, field.value ?? ""])) });
      }
    }).catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to load asset form"));
  }, [assetId, form, mode, permitted]);
  useEffect(() => { const warn = (event: BeforeUnloadEvent) => { if (form.formState.isDirty && !form.formState.isSubmitSuccessful) event.preventDefault(); }; addEventListener("beforeunload", warn); return () => removeEventListener("beforeunload", warn); }, [form.formState.isDirty, form.formState.isSubmitSuccessful]);
  const categoryId = useWatch({ control: form.control, name: "assetCategoryId" }); const currentValues = useWatch({ control: form.control, name: "customFields" });
  const definitions = refs?.customFields.filter((field) => (!field.assetCategoryId || field.assetCategoryId === categoryId) && (field.active || Boolean(currentValues?.[field.id]))) ?? [];
  async function submit(values: Values) {
    setError(""); setUploading(Boolean(imageFile));
    try {
      const nextValues = { ...values };
      if (imageFile) {
        if (!assetId) throw new Error("Create the asset first, then use Edit Asset to upload its primary image.");
        const upload = new FormData(); upload.set("file", imageFile); upload.set("entityType", "ASSET"); upload.set("entityId", assetId);
        const uploaded = await read(await fetch("/api/attachments/upload", { method: "POST", body: upload })) as { attachment: { contentUrl: string } };
        nextValues.primaryImagePath = uploaded.attachment.contentUrl;
      }
      const url = mode === "create" ? "/api/assets" : `/api/assets/${assetId}`;
      const response = await fetch(url, { method: mode === "create" ? "POST" : "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(nextValues) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Unable to save asset");
      router.push(`/assets/${body.id}?tab=${imageFile ? "documents" : "general"}`); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save asset"); }
    finally { setUploading(false); }
  }
  if (!permitted) return <main className="grid min-h-[60vh] place-items-center p-6"><Alert className="max-w-lg"><ShieldAlert className="size-5" />Your role does not have permission to {mode} assets.</Alert></main>;
  if (!refs && !error) return <main className="mx-auto max-w-6xl space-y-4 p-4 md:p-6"><Skeleton className="h-24 rounded-xl" /><Skeleton className="h-80 rounded-xl" /><Skeleton className="h-64 rounded-xl" /></main>;
  return <main className="mx-auto max-w-6xl space-y-5 p-4 md:p-6">
    <header><Button variant="ghost" asChild className="-ml-3"><Link href={assetId ? `/assets/${assetId}` : "/assets"}><ArrowLeft className="size-4" />Back to assets</Link></Button><p className="mt-3 text-xs font-bold uppercase tracking-[.16em] text-blue-700">Asset Management</p><h1 className="mt-1 text-2xl font-bold text-slate-950 md:text-3xl">{mode === "create" ? "Create asset" : `Edit ${detail?.asset.code ?? "asset"}`}</h1><p className="mt-2 text-sm text-slate-600">All migrated asset fields remain available; empty legacy references are retained as nullable values.</p></header>
    {error && <Alert variant="destructive" aria-live="assertive">{error}</Alert>}
    {refs && <form onSubmit={form.handleSubmit(submit)} className="space-y-5">
      <Section title="Identity and classification"><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Field id="code" label="KKS / asset code" error={form.formState.errors.code?.message}><Input id="code" autoComplete="off" {...form.register("code")} /></Field>
        <Field id="name" label="Asset name" error={form.formState.errors.name?.message} wide><Input id="name" {...form.register("name")} /></Field>
        <Field id="assetTypeId" label="Asset type" error={form.formState.errors.assetTypeId?.message}><Select id="assetTypeId" {...form.register("assetTypeId")}><option value="">Select type</option>{refs.types.map((item) => <option key={item.id} value={item.id}>{item.code} — {item.name}</option>)}</Select></Field>
        <Field id="assetCategoryId" label="Category"><Select id="assetCategoryId" {...form.register("assetCategoryId")}><option value="">Uncategorized</option>{refs.categories.map((item) => <option key={item.id} value={item.id}>{item.code} — {item.name}</option>)}</Select></Field>
        <Field id="structureLevel" label="Structure level"><Select id="structureLevel" {...form.register("structureLevel")}><option value="SYSTEM">System</option><option value="EQUIPMENT">Equipment</option><option value="COMPONENT">Component</option></Select></Field>
        <Field id="status" label="Status"><Select id="status" {...form.register("status")}><option value="ACTIVE">Active</option><option value="OFFLINE">Offline</option><option value="RESERVED">Reserved</option><option value="INACTIVE">Inactive</option><option value="RETIRED">Retired</option></Select></Field>
        <Field id="criticality" label="Criticality"><Select id="criticality" {...form.register("criticality")}><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="CRITICAL">Critical</option></Select></Field>
        <Field id="description" label="Description" error={form.formState.errors.description?.message} wide><Textarea id="description" rows={4} {...form.register("description")} /></Field>
      </div></Section>
      <Section title="Hierarchy, location and responsibility"><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Field id="parentAssetId" label="Parent asset"><Select id="parentAssetId" {...form.register("parentAssetId")}><option value="">Root asset</option>{refs.assets.filter((item) => item.id !== assetId).map((item) => <option key={item.id} value={item.id}>{item.code} — {item.name} ({item.structureLevel})</option>)}</Select></Field>
        <Field id="location" label="Location" error={form.formState.errors.location?.message}><Input id="location" {...form.register("location")} /></Field>
        <Field id="gpsCoordinates" label="GPS coordinates"><Input id="gpsCoordinates" placeholder="latitude, longitude" {...form.register("gpsCoordinates")} /></Field>
        <Field id="ownerUserId" label="Assigned owner"><Select id="ownerUserId" {...form.register("ownerUserId")}><option value="">Unassigned</option>{refs.users.map((item) => <option key={item.id} value={item.id}>{item.fullName}</option>)}</Select></Field>
        <Field id="contractId" label="Linked contract"><Select id="contractId" {...form.register("contractId")}><option value="">No contract</option>{refs.contracts.map((item) => <option key={item.id} value={item.id}>{item.code} — {item.name}</option>)}</Select></Field>
        <Field id="inventoryLocationName" label="Inventory location"><Input id="inventoryLocationName" {...form.register("inventoryLocationName")} /></Field>
      </div></Section>
      <Section title="Technical and maintenance data"><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Field id="unit" label="Unit"><Input id="unit" {...form.register("unit")} /></Field><Field id="serialNumber" label="Serial number"><Input id="serialNumber" {...form.register("serialNumber")} /></Field><Field id="maintenanceInterval" label="Maintenance interval"><Input id="maintenanceInterval" type="number" min={0} {...form.register("maintenanceInterval")} /></Field>
        <Field id="runningHourCode" label="Runtime-hour KKS"><Input id="runningHourCode" {...form.register("runningHourCode")} /></Field><Field id="budgetId" label="Budget ID"><Input id="budgetId" {...form.register("budgetId")} /></Field><Field id="primaryImagePath" label="Primary image path"><Input id="primaryImagePath" placeholder="Managed URL or preserved legacy path" {...form.register("primaryImagePath")} /></Field>
        <Field id="primaryImage" label="Upload primary image" wide><div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4"><label htmlFor="primaryImage" className="flex min-h-20 cursor-pointer items-center gap-3"><ImagePlus className="size-8 text-blue-700" /><span><strong className="block text-sm">{imageFile ? imageFile.name : "Choose JPEG, PNG, or WebP"}</strong><span className="text-xs text-slate-500">Maximum 5 MB. The uploaded image becomes the primary asset image after saving.</span></span></label><input id="primaryImage" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={mode !== "edit"} onChange={(event) => setImageFile(event.target.files?.[0] ?? null)} />{mode !== "edit" && <p className="mt-2 text-xs text-amber-700">Create the asset first, then open Edit Asset to upload an image.</p>}</div></Field>
      </div></Section>
      <Section title="Preserved legacy references" description="These identifiers remain editable for migration reconciliation and are never silently discarded."><div className="grid gap-4 md:grid-cols-3"><Field id="costCenterLegacyId" label="Cost center legacy ID"><Input id="costCenterLegacyId" type="number" min={1} {...form.register("costCenterLegacyId")} /></Field><Field id="budgetReferenceLegacyId" label="Budget reference legacy ID"><Input id="budgetReferenceLegacyId" type="number" min={1} {...form.register("budgetReferenceLegacyId")} /></Field><Field id="inventoryLocationLegacyId" label="Inventory location legacy ID"><Input id="inventoryLocationLegacyId" type="number" min={1} {...form.register("inventoryLocationLegacyId")} /></Field></div></Section>
      {definitions.length > 0 && <Section title="Category custom fields" description="Changing category replaces the applicable custom-value set transactionally."><div className="grid gap-4 md:grid-cols-2">{definitions.map((field) => <CustomField key={field.id} field={field} register={form.register} />)}</div></Section>}
      <div className="sticky bottom-3 z-10 flex flex-col-reverse gap-2 rounded-xl border bg-white/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:justify-end"><Button variant="outline" asChild><Link href={assetId ? `/assets/${assetId}` : "/assets"}>Cancel</Link></Button><Button type="submit" disabled={form.formState.isSubmitting || uploading}>{form.formState.isSubmitting || uploading ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}{uploading ? "Uploading image…" : mode === "create" ? "Create asset" : "Save changes"}</Button></div>
    </form>}
  </main>;
}

async function read(response: Response) { const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || "Request failed"); return body; }
function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) { return <Card><CardContent className="p-5 md:p-6"><h2 className="text-lg font-bold text-slate-950">{title}</h2>{description && <p className="mt-1 text-sm text-slate-600">{description}</p>}<div className="mt-5">{children}</div></CardContent></Card>; }
function Field({ id, label, error, wide, children }: { id: string; label: string; error?: string; wide?: boolean; children: React.ReactNode }) { return <div className={wide ? "md:col-span-2 lg:col-span-2" : ""}><Label htmlFor={id} className="mb-2 block">{label}</Label>{children}{error && <p className="mt-1 text-sm text-red-700" role="alert">{error}</p>}</div>; }
const Select = (props: React.ComponentProps<"select">) => <select className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-100" {...props} />;
function options(value: string | null) { if (!value) return []; try { const parsed = JSON.parse(value); if (Array.isArray(parsed)) return parsed.map(String); } catch { /* comma-delimited legacy values */ } return value.split(",").map((item) => item.trim()).filter(Boolean); }
function CustomField({ field, register }: { field: Reference["customFields"][number]; register: ReturnType<typeof useForm<Values>>["register"] }) { const id = `custom-${field.id}`; const registration = register(`customFields.${field.id}`); return <Field id={id} label={`${field.groupName} · ${field.label}${field.unit ? ` (${field.unit})` : ""}`}><div>{!field.active ? <Input id={id} readOnly className="bg-slate-50 text-slate-600" {...registration} /> : field.fieldType === "ARRAY" ? <Select id={id} {...registration}><option value="">{field.placeholder || "Select value"}</option>{options(field.availableValues).map((item) => <option key={item} value={item}>{item}</option>)}</Select> : <Input id={id} type={field.fieldType === "NUMBER" ? "number" : field.fieldType === "DATE" ? "date" : "text"} placeholder={field.placeholder ?? field.defaultValue ?? undefined} {...registration} />}{field.description && <p className="mt-1 text-xs text-slate-500">{field.description}{!field.active ? " · Retired definition retained for compatibility" : ""}</p>}</div></Field>; }
