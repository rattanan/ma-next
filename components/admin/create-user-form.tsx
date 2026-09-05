"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { FieldHelp } from "@/components/ui/field-help";

export default function CreateUserForm() {
  const router = useRouter();
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fullName: data.get("fullName"), username: data.get("username"), email: data.get("email"), role: data.get("role"), status: data.get("status"), password: data.get("password"), mustChangePassword: data.get("mustChangePassword") === "on", adminNotes: data.get("adminNotes") || undefined,
      }),
    });
    const body = await response.json();
    if (!response.ok) return setError(body.error);
    router.push(`/admin/users/${body.user.id}`);
    router.refresh();
  }

  return <form className="auth-form wide-form" onSubmit={submit}>
    <div className="form-grid">
      <Field label="Full name"><input name="fullName" required /></Field>
      <Field label="Username"><input name="username" required minLength={3} /></Field>
      <Field label="Email"><input name="email" required type="email" /></Field>
      <Field label="Role"><select name="role"><option value="OPERATOR">Operator</option><option value="MAINTENANCE_MANAGER">Maintenance Manager</option><option value="TECHNICIAN">Technician</option><option value="VIEWER">Viewer</option><option value="DASHBOARD_CREATOR">Dashboard Creator</option><option value="DATA_SOURCE_CREATOR">Data Source Creator</option><option value="ADMIN">Administrator</option></select></Field>
      <Field label="Status"><select name="status"><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></Field>
      <Field label="Initial password"><input name="password" type="password" minLength={10} required /></Field>
    </div>
    <Field label="Admin notes"><textarea name="adminNotes" rows={3} /></Field>
    <label className="check"><input name="mustChangePassword" type="checkbox" defaultChecked /> <span className="inline-flex items-center gap-1.5">Force password change on next login<FieldHelp label="Force password change on next login" /></span></label>
    {error && <p className="form-error">{error}</p>}
    <div className="profile-actions"><button className="primary-button">Create user</button><button type="button" className="secondary-button" onClick={() => router.back()}>Cancel</button></div>
  </form>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label><span className="inline-flex items-center gap-1.5">{label}<FieldHelp label={label} /></span>{children}</label>;
}
