"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole, ShieldCheck, Wrench } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identifier: data.get("identifier"), password: data.get("password"), rememberMe: data.get("rememberMe") === "on" }) });
      const body = await response.json();
      if (!response.ok) { setError(body.error || "ไม่สามารถเข้าสู่ระบบได้"); return; }
      router.replace(body.redirectTo);
      router.refresh();
    } catch {
      setError("ไม่สามารถเชื่อมต่อระบบได้ กรุณาตรวจสอบเครือข่ายแล้วลองอีกครั้ง");
    } finally {
      setLoading(false);
    }
  }

  return <main className="grid min-h-dvh bg-slate-50 lg:grid-cols-[minmax(28rem,44%)_1fr]"><section className="relative flex items-center justify-center p-4 sm:p-8 lg:p-12"><div className="absolute left-5 top-5 flex items-center gap-3 sm:left-8 sm:top-8"><span className="ma-brand-mark">MA</span><span><strong className="block text-sm text-slate-950">MA Maintenance</strong><small className="text-xs text-slate-500">Management System</small></span></div><Card className="mt-16 w-full max-w-md shadow-lg shadow-blue-950/5"><CardContent className="p-6 sm:p-8"><div className="mb-7"><span className="mb-4 grid size-11 place-items-center rounded-xl bg-blue-50 text-blue-800"><LockKeyhole className="size-5" /></span><p className="text-xs font-bold uppercase tracking-[.16em] text-blue-700">Secure workspace</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Welcome back</h1><p className="mt-2 text-sm leading-6 text-slate-600">Sign in to manage assets, maintenance notifications, work orders, and verified completion.</p></div><form className="space-y-5" onSubmit={submit} aria-busy={loading}><div className="space-y-2"><Label htmlFor="identifier">Email or username</Label><Input id="identifier" name="identifier" autoComplete="username" required autoFocus placeholder="you@company.com" disabled={loading} /></div><div className="space-y-2"><Label htmlFor="password">Password</Label><Input id="password" name="password" type="password" autoComplete="current-password" required placeholder="Enter your password" disabled={loading} /></div><label className="flex min-h-11 items-center gap-3 text-sm text-slate-700"><input name="rememberMe" type="checkbox" className="size-4 accent-blue-700" disabled={loading} /> Remember me on this device</label>{error && <Alert variant="destructive">{error}</Alert>}<Button type="submit" size="lg" className="w-full" disabled={loading}>{loading ? "Signing in…" : "Sign in"}</Button></form><p className="mt-6 text-center text-xs leading-5 text-slate-500">Accounts are created by your administrator. Public registration is disabled.</p></CardContent></Card></section><aside className="relative hidden overflow-hidden bg-[#0b2a4a] p-12 text-white lg:flex lg:items-end"><div className="absolute -right-36 -top-36 size-[34rem] rounded-full border border-cyan-300/20" /><div className="absolute -right-10 -top-10 size-[20rem] rounded-full border border-blue-300/20" /><div className="relative max-w-xl"><span className="grid size-14 place-items-center rounded-2xl bg-blue-500/20 text-cyan-200 ring-1 ring-cyan-200/20"><Wrench className="size-7" /></span><p className="mt-8 text-xs font-bold uppercase tracking-[.18em] text-cyan-200">Controlled maintenance flow</p><h2 className="mt-4 text-4xl font-bold leading-tight tracking-tight xl:text-5xl">Reliable maintenance from report to verified close.</h2><p className="mt-5 max-w-lg text-base leading-7 text-blue-100/80">Keep asset history, work execution, approvals, and audit-ready decisions together in one trusted workspace.</p><p className="mt-8 flex items-center gap-2 text-sm text-blue-100"><ShieldCheck className="size-5 text-cyan-300" />Server-enforced permissions and auditable actions</p></div></aside></main>;
}
