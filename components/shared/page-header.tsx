import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({ eyebrow, title, description, icon, actions, metadata, className }: { eyebrow?: string; title: string; description?: string; icon?: ReactNode; actions?: ReactNode; metadata?: ReactNode; className?: string }) {
  return <header className={cn("flex flex-col gap-4 border-b border-slate-200 pb-6 lg:flex-row lg:items-end lg:justify-between", className)}><div className="flex min-w-0 items-start gap-4">{icon && <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-800 ring-1 ring-blue-100">{icon}</span>}<div className="min-w-0">{eyebrow && <p className="text-xs font-bold uppercase tracking-[.16em] text-blue-700">{eyebrow}</p>}<h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 md:text-3xl">{title}</h1>{description && <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 md:text-base">{description}</p>}{metadata && <div className="mt-3 text-sm text-slate-500">{metadata}</div>}</div></div>{actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}</header>;
}

export function PageContainer({ children, size = "wide", className }: { children: ReactNode; size?: "narrow" | "wide"; className?: string }) {
  return <main className={cn("mx-auto w-full space-y-6 p-4 md:p-8", size === "narrow" ? "max-w-3xl" : "max-w-7xl", className)}>{children}</main>;
}
