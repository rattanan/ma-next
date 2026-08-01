"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Clipboard, KeyRound, LockKeyhole, LogOut, Save, ShieldAlert, UserCheck, UserX } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type User = { id: string; fullName: string; username: string; email: string; role: string; status: string; adminNotes: string | null; mustChangePassword: boolean; lastLoginAt: string | null; createdAt: string };
type PendingAction = { name: string; title: string; description: string; label: string; destructive?: boolean; reset?: boolean };

export default function UserDetailForm({ user }: { user: User }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [confirmation, setConfirmation] = useState<PendingAction | null>(null);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setMessage(""); setError("");
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ fullName: data.get("fullName"), username: data.get("username"), email: data.get("email"), role: data.get("role"), status: data.get("status"), adminNotes: data.get("adminNotes"), mustChangePassword: data.get("mustChangePassword") === "on" }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to update user");
      setMessage("User details and access settings were updated.");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to update user");
    } finally { setSaving(false); }
  }

  async function executeConfirmed() {
    if (!confirmation) return;
    setRunning(true); setMessage(""); setError("");
    try {
      if (confirmation.reset) {
        const response = await fetch(`/api/admin/users/${user.id}/reset-password`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ generate: true }) });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Unable to reset password");
        setTemporaryPassword(body.temporaryPassword);
        setMessage("Temporary password generated. It is shown once.");
      } else {
        const response = await fetch(`/api/admin/users/${user.id}/${confirmation.name}`, { method: "POST" });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Unable to complete account action");
        setMessage(`${confirmation.label} completed.`);
      }
      setConfirmation(null);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to complete account action");
    } finally { setRunning(false); }
  }

  const accountActions: Array<PendingAction & { icon: React.ReactNode }> = [
    user.status === "LOCKED" ? { name: "unlock", title: "Unlock this account?", description: `${user.fullName} will be able to sign in again if the account is otherwise active.`, label: "Unlock account", destructive: false, icon: <UserCheck className="size-4" /> } : { name: "lock", title: "Lock this account?", description: `${user.fullName} will be prevented from signing in until an administrator unlocks the account.`, label: "Lock account", icon: <LockKeyhole className="size-4" /> },
    user.status === "INACTIVE" ? { name: "enable", title: "Enable this account?", description: `${user.fullName} will regain access according to the assigned role and permissions.`, label: "Enable account", destructive: false, icon: <UserCheck className="size-4" /> } : { name: "disable", title: "Disable this account?", description: `${user.fullName} will no longer be able to use the application until re-enabled.`, label: "Disable account", icon: <UserX className="size-4" /> },
    { name: "revoke-sessions", title: "Revoke all active sessions?", description: `${user.fullName} will be signed out on every device and must authenticate again.`, label: "Revoke sessions", icon: <LogOut className="size-4" /> },
    { name: "reset-password", title: "Reset password and revoke sessions?", description: `Every session for ${user.fullName} will be revoked. A temporary password will be displayed once after confirmation.`, label: "Reset password", reset: true, icon: <KeyRound className="size-4" /> },
  ];

  return <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]"><Card><CardHeader><CardTitle>Account details</CardTitle><CardDescription>Identity, legacy platform role, account state, and sign-in requirements.</CardDescription></CardHeader><CardContent><form className="space-y-6" onSubmit={save} aria-busy={saving}><div className="grid gap-5 md:grid-cols-2"><Field label="Full name" htmlFor="fullName"><Input id="fullName" name="fullName" defaultValue={user.fullName} required disabled={saving} /></Field><Field label="Username" htmlFor="username"><Input id="username" name="username" defaultValue={user.username} required disabled={saving} /></Field><Field label="Email" htmlFor="email"><Input id="email" name="email" type="email" defaultValue={user.email} required disabled={saving} /></Field><Field label="Role" htmlFor="role"><Select name="role" defaultValue={user.role} disabled={saving}><SelectTrigger id="role" className="h-11"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ADMIN">Administrator</SelectItem><SelectItem value="DASHBOARD_CREATOR">Dashboard Creator</SelectItem><SelectItem value="DATA_SOURCE_CREATOR">Data Source Creator</SelectItem><SelectItem value="VIEWER">Viewer</SelectItem></SelectContent></Select></Field><Field label="Status" htmlFor="status"><Select name="status" defaultValue={user.status} disabled={saving}><SelectTrigger id="status" className="h-11"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ACTIVE">Active</SelectItem><SelectItem value="INACTIVE">Inactive</SelectItem><SelectItem value="LOCKED">Locked</SelectItem><SelectItem value="ARCHIVED">Archived</SelectItem></SelectContent></Select></Field><label className="flex min-h-11 items-center gap-3 self-end rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700"><input name="mustChangePassword" type="checkbox" defaultChecked={user.mustChangePassword} className="size-4 accent-blue-700" disabled={saving} />Force password change</label></div><Field label="Admin notes" htmlFor="adminNotes"><Textarea id="adminNotes" name="adminNotes" rows={4} defaultValue={user.adminNotes ?? ""} disabled={saving} /></Field>{error && <Alert variant="destructive">{error}</Alert>}{message && <Alert variant="success">{message}</Alert>}<div className="flex justify-end border-t border-slate-200 pt-5"><Button type="submit" disabled={saving}><Save className="size-4" />{saving ? "Saving…" : "Save changes"}</Button></div></form></CardContent></Card><aside className="space-y-6"><Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><ShieldAlert className="size-5 text-amber-700" />Security actions</CardTitle><CardDescription>These actions affect account access or active sessions.</CardDescription></CardHeader><CardContent className="grid gap-2">{accountActions.map(({ icon, ...action }) => <Button key={action.name} type="button" variant={action.destructive === false ? "outline" : "destructive"} className="justify-start" onClick={() => setConfirmation(action)} disabled={running}>{icon}{action.label}</Button>)}</CardContent></Card>{temporaryPassword && <Card className="border-amber-300 bg-amber-50"><CardHeader><CardTitle className="text-base text-amber-950">Temporary password</CardTitle><CardDescription className="text-amber-900/70">Copy this password now. It will not be shown again.</CardDescription></CardHeader><CardContent><code className="block overflow-wrap-anywhere rounded-lg border border-amber-200 bg-white p-3 text-sm text-slate-950">{temporaryPassword}</code><Button type="button" variant="outline" className="mt-3 w-full" onClick={() => navigator.clipboard.writeText(temporaryPassword)}><Clipboard className="size-4" />Copy password</Button></CardContent></Card>}</aside><ConfirmDialog open={Boolean(confirmation)} onOpenChange={(open) => { if (!open && !running) setConfirmation(null); }} title={confirmation?.title ?? "Confirm account action"} description={confirmation?.description ?? "Confirm this account action."} confirmLabel={confirmation?.label ?? "Confirm"} destructive={confirmation?.destructive !== false} pending={running} onConfirm={executeConfirmed} /></div>;
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label htmlFor={htmlFor}>{label}</Label>{children}</div>;
}
