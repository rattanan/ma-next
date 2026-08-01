"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Bell, Boxes, Building2, ClipboardCheck, ClipboardList, ClipboardPlus, Database, LogOut, Menu, PanelLeftClose, PanelLeftOpen, ShieldCheck, UserRound, Users, Wrench } from "lucide-react";
import { MaLogo } from "@/components/brand/ma-logo";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Breadcrumbs } from "./breadcrumbs";

type ShellUser = { fullName: string; role: string; permissions: string[] };
const SIDEBAR_STORAGE_KEY = "ma-next-sidebar-collapsed";
const SIDEBAR_CHANGE_EVENT = "ma-sidebar-state-changed";

const navigation = [
  { href: "/assets", label: "Assets", icon: Boxes, permission: "ASSET_READ" },
  { href: "/notifications", label: "แจ้งบำรุงรักษา", icon: ClipboardPlus, permission: "NOTIFICATION_VIEW" },
  { href: "/maintenance", label: "Maintenance", icon: Wrench, permission: "VIEW_MAINTENANCE" },
  { href: "/work-orders", label: "Work Orders", icon: ClipboardList, permission: "VIEW_MAINTENANCE" },
  { href: "/approvals", label: "Approve Center", icon: ClipboardCheck, permission: "NOTIFICATION_REVIEW", approvalBadge: true },
  { href: "/organization", label: "Organization", icon: Building2, permission: "VIEW_ORGANIZATION" },
  { href: "/settings/master-data", label: "Master data", icon: Database, permission: "VIEW_MASTER_DATA" },
  { href: "/admin/users", label: "Users & access", icon: Users, permission: "MANAGE_USERS" },
  { href: "/admin/audit-logs", label: "Audit log", icon: ShieldCheck, permission: "VIEW_AUDIT_LOGS" },
];

function ApprovalBadge({ count, collapsed = false }: { count: number; collapsed?: boolean }) { return count > 0 ? <span className={cn("min-w-5 rounded-full bg-cyan-300 px-1.5 py-0.5 text-center text-[10px] font-extrabold leading-4 text-blue-950", collapsed ? "absolute right-1 top-1" : "ml-auto")} aria-label={`${count} pending approvals`}>{count > 99 ? "99+" : count}</span> : null; }

function subscribeToSidebarState(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(SIDEBAR_CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(SIDEBAR_CHANGE_EVENT, callback);
  };
}

function getSidebarState() { return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true"; }
function getServerSidebarState() { return false; }

function Navigation({ user, approvalCount, collapsed = false }: { user: ShellUser; approvalCount: number; collapsed?: boolean }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      <Link href="/" className={cn("flex min-h-20 items-center border-b border-white/10 px-1", collapsed && "justify-center px-0")} aria-label="MA Next home">
        <MaLogo inverse compact={collapsed} size="sm" />
      </Link>
      <nav className="flex-1 space-y-1 py-5" aria-label="Primary navigation">
        {navigation.filter((item) => !item.permission || user.permissions.includes(item.permission)).map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} aria-label={collapsed ? item.label : undefined} title={collapsed ? item.label : undefined} aria-current={active ? "page" : undefined} className={cn("relative flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-blue-100/80 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300", collapsed && "justify-center gap-0 px-0", active && "bg-blue-600 text-white")}>
              <Icon className="size-5 shrink-0" />
              {!collapsed && item.label}
              {"approvalBadge" in item && item.approvalBadge && <ApprovalBadge count={approvalCount} collapsed={collapsed} />}
            </Link>
          );
        })}
      </nav>
      <div className={cn("border-t border-white/10 pt-3", collapsed ? "px-0" : "px-1")}>
        <Link href="/profile" aria-label={collapsed ? `เปิดโปรไฟล์ของ ${user.fullName}` : undefined} aria-current={pathname === "/profile" || pathname.startsWith("/profile/") ? "page" : undefined} title={collapsed ? `${user.fullName} · ${user.role.replaceAll("_", " ")}` : undefined} className={cn("block rounded-xl text-blue-100/80 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300", collapsed ? "grid min-h-11 place-items-center" : "px-3 py-2", (pathname === "/profile" || pathname.startsWith("/profile/")) && "bg-white/10 text-white")}>
          {collapsed ? <UserRound className="size-5" aria-hidden="true" /> : <><p className="truncate text-sm font-semibold">{user.fullName}</p><p className="mt-1 truncate text-xs text-blue-100/60">{user.role.replaceAll("_", " ")}</p></>}
        </Link>
      </div>
    </div>
  );
}

export function AppShell({ user, children }: { user: ShellUser; children: React.ReactNode }) {
  const router = useRouter();
  const [approvalCount, setApprovalCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const sidebarCollapsed = useSyncExternalStore(subscribeToSidebarState, getSidebarState, getServerSidebarState);
  const loadApprovalCount = useCallback(async () => { if (!user.permissions.includes("NOTIFICATION_REVIEW")) return; try { const response = await fetch("/api/approvals/pending-count", { cache: "no-store" }); if (response.ok) setApprovalCount((await response.json()).count ?? 0); } catch { /* The next poll retries without disrupting navigation. */ } }, [user.permissions]);
  const loadUnreadCount = useCallback(async () => { if (!user.permissions.includes("VIEW_NOTIFICATIONS")) return; try { const response = await fetch("/api/notifications/unread-count", { cache: "no-store" }); if (response.ok) setUnreadCount((await response.json()).count ?? 0); } catch { /* The next poll retries without disrupting navigation. */ } }, [user.permissions]);
  useEffect(() => { const initial = window.setTimeout(() => void loadApprovalCount(), 0); const interval = window.setInterval(() => void loadApprovalCount(), 45_000); window.addEventListener("approval-count-changed", loadApprovalCount); return () => { window.clearTimeout(initial); window.clearInterval(interval); window.removeEventListener("approval-count-changed", loadApprovalCount); }; }, [loadApprovalCount]);
  useEffect(() => { const initial = window.setTimeout(() => void loadUnreadCount(), 0); const interval = window.setInterval(() => void loadUnreadCount(), 45_000); window.addEventListener("notification-unread-count-changed", loadUnreadCount); return () => { window.clearTimeout(initial); window.clearInterval(interval); window.removeEventListener("notification-unread-count-changed", loadUnreadCount); }; }, [loadUnreadCount]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  function toggleSidebar() {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(!sidebarCollapsed));
    window.dispatchEvent(new Event(SIDEBAR_CHANGE_EVENT));
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:shadow">Skip to content</a>
      <aside className={cn("fixed inset-y-0 left-0 z-30 hidden bg-[#0b2a4a] text-white transition-[width,padding] duration-200 motion-reduce:transition-none lg:block", sidebarCollapsed ? "w-20 p-3" : "w-64 p-4")}>
        <Button type="button" variant="outline" size="icon" className="absolute -right-3 top-6 z-10 size-7 rounded-full border-slate-300 bg-white text-slate-700 shadow-md hover:bg-slate-100" onClick={toggleSidebar} aria-label={sidebarCollapsed ? "Expand side menu" : "Collapse side menu"} title={sidebarCollapsed ? "Expand side menu" : "Collapse side menu"} aria-expanded={!sidebarCollapsed}>
          {sidebarCollapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
        </Button>
        <Navigation user={user} approvalCount={approvalCount} collapsed={sidebarCollapsed} />
      </aside>
      <div className={cn("transition-[padding-left] duration-200 motion-reduce:transition-none", sidebarCollapsed ? "lg:pl-20" : "lg:pl-64")}>
        <header className="sticky top-0 z-20 flex min-h-16 items-center gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur md:px-6">
          <Dialog>
            <DialogTrigger asChild><Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation"><Menu className="size-5" /></Button></DialogTrigger>
            <DialogContent className="border-0 bg-[#0b2a4a] text-white">
              <DialogTitle className="sr-only">Application navigation</DialogTitle>
              <DialogDescription className="sr-only">Choose a MA maintenance workspace</DialogDescription>
              <Navigation user={user} approvalCount={approvalCount} />
            </DialogContent>
          </Dialog>
          <Link href="/" className="lg:hidden" aria-label="MA Next home"><MaLogo compact size="sm" /></Link>
          <div className="min-w-0 flex-1"><Breadcrumbs /></div>
          {user.permissions.includes("VIEW_NOTIFICATIONS") && <Button asChild variant="ghost" size="icon" className="relative" aria-label={unreadCount ? `${unreadCount} unread messages` : "No unread messages"}><Link href="/inbox"><Bell className="size-5" />{unreadCount > 0 && <span className="absolute right-0.5 top-0.5 min-w-4 rounded-full bg-red-600 px-1 text-center text-[9px] font-bold leading-4 text-white" aria-hidden="true">{unreadCount > 99 ? "99+" : unreadCount}</span>}</Link></Button>}
          <Button variant="ghost" size="icon" onClick={logout} aria-label="Sign out"><LogOut className="size-5" /></Button>
        </header>
        <div id="main-content" tabIndex={-1}>{children}</div>
      </div>
    </div>
  );
}
