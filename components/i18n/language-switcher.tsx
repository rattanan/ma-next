"use client";

import { Languages } from "lucide-react";
import { useLanguage } from "@/components/i18n/language-provider";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/i18n/translations";

const options: Array<{ locale: Locale; label: string; accessibleLabel: string }> = [
  { locale: "th", label: "ไทย", accessibleLabel: "เปลี่ยนเป็นภาษาไทย" },
  { locale: "en", label: "Eng", accessibleLabel: "Switch to English" },
];

export function LanguageSwitcher({ className, inverse = false }: { className?: string; inverse?: boolean }) {
  const { locale, setLocale } = useLanguage();

  return (
    <div
      data-no-translate
      className={cn(
        "inline-flex h-10 shrink-0 items-center gap-1 rounded-xl border p-1 shadow-sm backdrop-blur transition-colors",
        inverse ? "border-white/15 bg-white/10" : "border-slate-200 bg-slate-100/90",
        className,
      )}
      role="group"
      aria-label="เลือกภาษา / Choose language"
    >
      <Languages className={cn("ml-1.5 size-4", inverse ? "text-cyan-200" : "text-blue-700")} aria-hidden="true" />
      {options.map((option) => {
        const active = locale === option.locale;
        return (
          <button
            key={option.locale}
            type="button"
            onClick={() => setLocale(option.locale)}
            aria-label={option.accessibleLabel}
            aria-pressed={active}
            className={cn(
              "relative min-h-8 rounded-lg px-2.5 text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-1",
              active
                ? inverse
                  ? "bg-white text-blue-950 shadow-sm"
                  : "bg-white text-blue-800 shadow-sm ring-1 ring-slate-200/70"
                : inverse
                  ? "text-blue-100 hover:bg-white/10 hover:text-white"
                  : "text-slate-500 hover:bg-white/70 hover:text-slate-900",
            )}
          >
            {option.label}
          </button>
        );
      })}
      <span className="sr-only" aria-live="polite">{locale === "th" ? "กำลังใช้ภาษาไทย" : "English selected"}</span>
    </div>
  );
}
