"use client";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { usePathname } from "next/navigation";

const names: Record<string, string> = { admin: "Administration", users: "Users", "audit-logs": "Audit logs", "login-history": "Login history", organization: "Organization", settings: "Settings", "master-data": "Master data", notifications: "แจ้งบำรุงรักษา", inbox: "System Inbox", profile: "Profile", security: "Security", maintenance: "Maintenance" };
export function Breadcrumbs() { const segments = usePathname().split("/").filter(Boolean); return <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 text-sm text-slate-500"><Link href="/" className="hover:text-slate-950">Home</Link>{segments.map((segment, index) => { const href = `/${segments.slice(0, index + 1).join("/")}`; const current = index === segments.length - 1; return <span key={href} className="flex min-w-0 items-center gap-1"><ChevronRight className="size-4 shrink-0" /><Link href={href} aria-current={current ? "page" : undefined} className={current ? "truncate font-semibold text-slate-950" : "truncate hover:text-slate-950"}>{names[segment] || segment}</Link></span>; })}</nav>; }
