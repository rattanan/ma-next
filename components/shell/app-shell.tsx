"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Boxes, Building2, ClipboardList, Database, LogOut, Menu, ShieldCheck, UserRound, Users, Wrench } from "lucide-react";
import { MaLogo } from "@/components/brand/ma-logo";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Breadcrumbs } from "./breadcrumbs";

type ShellUser = { fullName: string; role: string; permissions: string[] };

const navigation = [
  { href: "/assets", label: "Assets", icon: Boxes, permission: "ASSET_READ" },
  { href: "/maintenance", label: "Maintenance", icon: Wrench, permission: "VIEW_MAINTENANCE" },
  { href: "/work-orders", label: "Work Orders", icon: ClipboardList, permission: "VIEW_MAINTENANCE" },
  { href: "/organization", label: "Organization", icon: Building2, permission: "VIEW_ORGANIZATION" },
  { href: "/settings/master-data", label: "Master data", icon: Database, permission: "VIEW_MASTER_DATA" },
  { href: "/notifications", label: "Notifications", icon: Bell, permission: "VIEW_NOTIFICATIONS" },
  { href: "/admin/users", label: "Users & access", icon: Users, permission: "MANAGE_USERS" },
  { href: "/admin/audit-logs", label: "Audit log", icon: ShieldCheck, permission: "VIEW_AUDIT_LOGS" },
  { href: "/profile", label: "My profile", icon: UserRound },
];

function Navigation({ user }: { user: ShellUser }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      <Link href="/" className="flex min-h-20 items-center border-b border-white/10 px-1" aria-label="MA Next home">
        <MaLogo inverse size="sm" />
      </Link>
      <nav className="flex-1 space-y-1 py-5" aria-label="Primary navigation">
        {navigation.filter((item) => !item.permission || user.permissions.includes(item.permission)).map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={cn("flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-blue-100/80 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300", active && "bg-blue-600 text-white")}>
              <Icon className="size-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 px-3 pt-4">
        <p className="truncate text-sm font-semibold">{user.fullName}</p>
        <p className="mt-1 text-xs text-blue-100/60">{user.role.replaceAll("_", " ")}</p>
      </div>
    </div>
  );
}

export function AppShell({ user, children }: { user: ShellUser; children: React.ReactNode }) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:shadow">Skip to content</a>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 bg-[#0b2a4a] p-4 text-white lg:block"><Navigation user={user} /></aside>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex min-h-16 items-center gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur md:px-6">
          <Dialog>
            <DialogTrigger asChild><Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation"><Menu className="size-5" /></Button></DialogTrigger>
            <DialogContent className="border-0 bg-[#0b2a4a] text-white">
              <DialogTitle className="sr-only">Application navigation</DialogTitle>
              <DialogDescription className="sr-only">Choose a MA maintenance workspace</DialogDescription>
              <Navigation user={user} />
            </DialogContent>
          </Dialog>
          <Link href="/" className="lg:hidden" aria-label="MA Next home"><MaLogo compact size="sm" /></Link>
          <div className="min-w-0 flex-1"><Breadcrumbs /></div>
          <Button variant="ghost" size="icon" onClick={logout} aria-label="Sign out"><LogOut className="size-5" /></Button>
        </header>
        <div id="main-content" tabIndex={-1}>{children}</div>
      </div>
    </div>
  );
}
