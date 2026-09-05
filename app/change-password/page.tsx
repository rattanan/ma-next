"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, KeyRound, ShieldCheck } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MaLogo } from "@/components/brand/ma-logo";
import { useLanguage } from "@/components/i18n/language-provider";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";

export default function ChangePasswordPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const requirements = [
    t("อย่างน้อย 10 ตัวอักษร", "At least 10 characters"),
    t("มีตัวพิมพ์ใหญ่และตัวพิมพ์เล็ก", "Uppercase and lowercase letters"),
    t("มีตัวเลขอย่างน้อยหนึ่งตัว", "At least one number"),
    t("มีอักขระพิเศษอย่างน้อยหนึ่งตัว", "At least one special character"),
  ];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          currentPassword: data.get("currentPassword") || undefined,
          newPassword: data.get("newPassword"),
          confirmPassword: data.get("confirmPassword"),
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body.error || t("ไม่สามารถอัปเดตรหัสผ่านได้", "Unable to update password"));
        return;
      }
      setMessage(t("เปลี่ยนรหัสผ่านสำเร็จ กำลังไปยังหน้าโปรไฟล์…", "Password changed successfully. Redirecting to your profile…"));
      setTimeout(() => {
        router.replace("/profile");
        router.refresh();
      }, 900);
    } catch {
      setError(t("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ รหัสผ่านของคุณยังไม่ถูกเปลี่ยน", "Unable to connect to the server. Your password was not changed."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-dvh items-center justify-center bg-slate-50 px-4 pb-8 pt-24 md:px-8">
      <Link href="/" className="absolute left-5 top-5 sm:left-8 sm:top-8" aria-label="MA Next home"><MaLogo size="md" /></Link>
      <LanguageSwitcher className="absolute right-5 top-5 sm:right-8 sm:top-8" />
      <Card className="w-full max-w-2xl shadow-lg shadow-blue-950/5">
        <CardContent className="p-6 md:p-8">
          <div className="flex items-start gap-4 border-b border-slate-200 pb-6">
            <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-800"><KeyRound className="size-6" /></span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[.16em] text-blue-700">{t("ความปลอดภัยของบัญชี", "Account security")}</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 md:text-3xl">{t("เปลี่ยนรหัสผ่าน", "Change your password")}</h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">{t("เลือกรหัสผ่านที่รัดกุมและไม่ซ้ำกับบัญชีอื่น", "Choose a strong password that is not used for another account.")}</p>
            </div>
          </div>
          <div className="mt-6 grid gap-8 md:grid-cols-[1fr_16rem]">
            <form className="space-y-5" onSubmit={submit} aria-busy={loading}>
              <div className="space-y-2">
                <Label htmlFor="currentPassword">{t("รหัสผ่านปัจจุบัน", "Current password")}</Label>
                <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" disabled={loading} />
                <p className="text-xs leading-5 text-slate-500">{t("เว้นว่างได้เมื่อเข้าสู่ระบบด้วยรหัสผ่านชั่วคราวที่ผู้ดูแลระบบออกให้", "Optional when signing in with an administrator-issued temporary password.")}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">{t("รหัสผ่านใหม่", "New password")}</Label>
                <Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" required minLength={10} disabled={loading} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">{t("ยืนยันรหัสผ่านใหม่", "Confirm new password")}</Label>
                <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required minLength={10} disabled={loading} />
              </div>
              {error && <Alert variant="destructive">{error}</Alert>}
              {message && <Alert variant="success">{message}</Alert>}
              <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={loading}>
                {loading ? t("กำลังอัปเดตรหัสผ่าน…", "Updating password…") : t("อัปเดตรหัสผ่าน", "Update password")}
              </Button>
            </form>
            <aside className="rounded-xl border border-blue-100 bg-blue-50 p-4">
              <ShieldCheck className="size-5 text-blue-800" />
              <h2 className="mt-3 text-sm font-bold text-blue-950">{t("ข้อกำหนดรหัสผ่าน", "Password requirements")}</h2>
              <ul className="mt-3 space-y-2">
                {requirements.map((requirement) => <li key={requirement} className="flex gap-2 text-xs leading-5 text-blue-950/75"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-blue-700" />{requirement}</li>)}
              </ul>
            </aside>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
