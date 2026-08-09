"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { ArrowLeftRight, Bell, BookOpen, Boxes, Building2, ChevronDown, ClipboardCheck, ClipboardList, ClipboardPlus, Database, FileCog, FileText, LayoutDashboard, List, LogOut, MapPin, Menu, PackageSearch, PanelLeftClose, PanelLeftOpen, Settings, ShieldCheck, Truck, UserRound, Users, Warehouse, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { MaLogo } from "@/components/brand/ma-logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { Breadcrumbs } from "./breadcrumbs";

type ShellUser = { fullName: string; username: string; role: string; departments: string[]; permissions: string[] };
type NavigationItem = { href: string; label: string; icon: LucideIcon; permission?: string; anyPermissions?: string[]; approvalBadge?: boolean };
type NavigationGroup = { label: string; items: NavigationItem[] };
const SIDEBAR_STORAGE_KEY = "ma-next-sidebar-collapsed";
const SIDEBAR_CHANGE_EVENT = "ma-sidebar-state-changed";

const navigation: NavigationGroup[] = [
  { label: "Overview", items: [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, permission: "VIEW_DASHBOARD" },
    { href: "/approvals", label: "Approval Center", icon: ClipboardCheck, permission: "VIEW_APPROVAL_CENTER", approvalBadge: true },
    { href: "/inbox", label: "My Inbox", icon: Bell, permission: "VIEW_NOTIFICATIONS" },
  ] },
  { label: "Maintenance", items: [
    { href: "/notifications", label: "แจ้งซ่อม", icon: ClipboardPlus, permission: "NOTIFICATION_VIEW" },
    { href: "/work-orders", label: "Work Orders", icon: ClipboardList, permission: "VIEW_MAINTENANCE" },
    { href: "/maintenance", label: "Workflow Queue", icon: Wrench, permission: "VIEW_MAINTENANCE" },
    { href: "/assets", label: "Assets", icon: Boxes, permission: "ASSET_READ" },
  ] },
  { label: "Purchasing", items: [
    { href: "/purchase-requests", label: "Purchase Requests", icon: FileText, permission: "PURCHASE_REQUEST_VIEW" },
    { href: "/purchase-orders", label: "Purchase Orders", icon: FileText, permission: "PURCHASE_ORDER_VIEW" },
    { href: "/approval-workflows", label: "Approval Workflows", icon: FileCog, permission: "APPROVAL_WORKFLOW_VIEW" },
  ] },
  { label: "Inventory", items: [
    { href: "/inventory", label: "Inventory Overview", icon: Warehouse, permission: "VIEW_INVENTORY" },
    { href: "/inventory/po-receipts", label: "PO Receipts", icon: ClipboardCheck, permission: "INVENTORY_REQUEST_VIEW" },
    { href: "/inventory/requests", label: "Requests", icon: ClipboardPlus, permission: "INVENTORY_REQUEST_VIEW" },
    { href: "/inventory/transactions", label: "Documents", icon: ClipboardList, permission: "INVENTORY_REQUEST_VIEW" },
    { href: "/inventory/on-hand", label: "Stock On-hand", icon: List, permission: "INVENTORY_REPORT_VIEW" },
    { href: "/inventory/movement", label: "Stock Movement", icon: ArrowLeftRight, permission: "INVENTORY_REPORT_VIEW" },
    { href: "/inventory/stock-card", label: "Stock Card", icon: BookOpen, permission: "INVENTORY_REPORT_VIEW" },
    { href: "/inventory/counts", label: "Stock Count", icon: ClipboardCheck, anyPermissions: ["INVENTORY_COUNT_MANAGE", "INVENTORY_COUNT_REVIEW"] },
  ] },
  { label: "Master Data", items: [
    { href: "/inventory/items", label: "Stock Items", icon: PackageSearch, permission: "VIEW_INVENTORY" },
    { href: "/inventory/locations", label: "Locations", icon: MapPin, permission: "VIEW_INVENTORY" },
    { href: "/inventory/vendors", label: "Vendors", icon: Truck, permission: "VIEW_INVENTORY" },
    { href: "/organization", label: "Organization", icon: Building2, permission: "VIEW_ORGANIZATION" },
    { href: "/settings/master-data", label: "System Master Data", icon: Database, permission: "VIEW_MASTER_DATA" },
    { href: "/inventory/configuration", label: "Inventory Settings", icon: Settings, permission: "INVENTORY_CONFIG_MANAGE" },
  ] },
  { label: "Administration", items: [
    { href: "/admin/users", label: "Users & Access", icon: Users, permission: "MANAGE_USERS" },
    { href: "/admin/audit-logs", label: "Audit Log", icon: ShieldCheck, permission: "VIEW_AUDIT_LOGS" },
  ] },
];

function canSee(item: NavigationItem, user: ShellUser) {
  return (!item.permission || user.permissions.includes(item.permission)) && (!item.anyPermissions || item.anyPermissions.some((permission) => user.permissions.includes(permission)));
}

function ApprovalBadge({ count, compact = false }: { count: number; compact?: boolean }) {
  return count > 0 ? <span className={cn("min-w-5 rounded-full bg-cyan-300 px-1.5 py-0.5 text-center text-[10px] font-extrabold leading-4 text-blue-950", compact ? "absolute right-1 top-1" : "ml-auto")} aria-label={`${count} pending approvals`}>{count > 99 ? "99+" : count}</span> : null;
}

function subscribeToSidebarState(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(SIDEBAR_CHANGE_EVENT, callback);
  return () => { window.removeEventListener("storage", callback); window.removeEventListener(SIDEBAR_CHANGE_EVENT, callback); };
}
function getSidebarState() { return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true"; }
function getServerSidebarState() { return false; }

function NavigationLink({ item, active, collapsed, mobile, approvalCount }: { item: NavigationItem; active: boolean; collapsed: boolean; mobile: boolean; approvalCount: number }) {
  const Icon = item.icon;
  const link = <Link href={item.href} aria-label={collapsed ? item.label : undefined} title={collapsed ? item.label : undefined} aria-current={active ? "page" : undefined} className={cn("relative flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold text-blue-100/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300", collapsed && "justify-center gap-0 px-0", active && "bg-blue-600 text-white shadow-sm")}>
    <Icon className="size-5 shrink-0" aria-hidden="true" />{!collapsed && <span className="truncate">{item.label}</span>}{item.approvalBadge && <ApprovalBadge count={approvalCount} compact={collapsed} />}
  </Link>;
  return mobile ? <SheetClose asChild>{link}</SheetClose> : link;
}

function Navigation({ user, approvalCount, collapsed = false, mobile = false }: { user: ShellUser; approvalCount: number; collapsed?: boolean; mobile?: boolean }) {
  const pathname = usePathname();
  const visibleGroups = navigation.map((group) => ({ ...group, items: group.items.filter((item) => canSee(item, user)) })).filter((group) => group.items.length);
  const activeGroupLabel = visibleGroups.find((group) => group.items.some((item) => {
    const exactRoot = ["/inventory", "/maintenance", "/notifications"].includes(item.href);
    return pathname === item.href || (!exactRoot && pathname.startsWith(`${item.href}/`));
  }))?.label;
  const defaultOpenGroup = activeGroupLabel ?? visibleGroups[0]?.label ?? null;
  const [groupState, setGroupState] = useState<{ pathname: string; openGroup: string | null }>(() => ({ pathname, openGroup: defaultOpenGroup }));
  const openGroup = groupState.pathname === pathname ? groupState.openGroup : defaultOpenGroup;

  return <div className="flex h-full min-h-0 flex-col">
    <Link href="/dashboard" className={cn("flex min-h-20 items-center border-b border-white/10 px-1", collapsed && "justify-center px-0")} aria-label="MA Next dashboard"><MaLogo inverse compact={collapsed} size="sm" /></Link>
    <nav className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain py-3 pr-1" aria-label="Primary navigation">
      {visibleGroups.map((group) => {
        const groupId = `${mobile ? "mobile" : "desktop"}-nav-${group.label.replaceAll(" ", "-").toLowerCase()}`;
        const submenuId = `${groupId}-items`;
        const expanded = collapsed || openGroup === group.label;
        return <section key={group.label} aria-labelledby={collapsed ? undefined : groupId} aria-label={collapsed ? group.label : undefined}>
        {!collapsed && <button id={groupId} type="button" className="flex min-h-9 w-full items-center justify-between rounded-lg px-3 text-left text-[10px] font-bold uppercase tracking-[.16em] text-blue-200/65 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300" onClick={() => setGroupState({ pathname, openGroup: openGroup === group.label ? null : group.label })} aria-expanded={expanded} aria-controls={submenuId}>
          <span>{group.label}</span><ChevronDown className={cn("size-4 transition-transform duration-200 motion-reduce:transition-none", expanded && "rotate-180")} aria-hidden="true" />
        </button>}
        <div id={submenuId} hidden={!expanded} className={cn("space-y-1", !collapsed && "mt-1")}>{group.items.map((item) => {
          const exactRoot = ["/inventory", "/maintenance", "/notifications"].includes(item.href);
          const active = pathname === item.href || (!exactRoot && pathname.startsWith(`${item.href}/`));
          return <NavigationLink key={item.href} item={item} active={active} collapsed={collapsed} mobile={mobile} approvalCount={approvalCount} />;
        })}</div>
      </section>})}
    </nav>
    <div className="border-t border-white/10 pt-3"><Link href="/profile" className={cn("block rounded-lg text-blue-100/80 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300", collapsed ? "grid min-h-11 place-items-center" : "px-3 py-2")} title={collapsed ? `${user.fullName} · ${user.role.replaceAll("_", " ")}` : undefined}>{collapsed ? <UserRound className="size-5" /> : <><p className="truncate text-sm font-semibold text-white">{user.fullName}</p><p className="mt-1 truncate text-xs text-blue-100/60">{user.role.replaceAll("_", " ")}</p></>}</Link></div>
  </div>;
}

export function AppShell({ user, children }: { user: ShellUser; children: React.ReactNode }) {
  const router = useRouter();
  const [approvalCount, setApprovalCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const sidebarCollapsed = useSyncExternalStore(subscribeToSidebarState, getSidebarState, getServerSidebarState);
  const loadApprovalCount = useCallback(async () => { if (!user.permissions.includes("VIEW_APPROVAL_CENTER")) return; try { const response = await fetch("/api/approvals/pending-count", { cache: "no-store" }); if (response.ok) setApprovalCount((await response.json()).count ?? 0); } catch { /* The next poll retries. */ } }, [user.permissions]);
  const loadUnreadCount = useCallback(async () => { if (!user.permissions.includes("VIEW_NOTIFICATIONS")) return; try { const response = await fetch("/api/notifications/unread-count", { cache: "no-store" }); if (response.ok) setUnreadCount((await response.json()).count ?? 0); } catch { /* The next poll retries. */ } }, [user.permissions]);
  useEffect(() => { const initial = window.setTimeout(() => void loadApprovalCount(), 0); const interval = window.setInterval(() => void loadApprovalCount(), 45_000); window.addEventListener("approval-count-changed", loadApprovalCount); return () => { window.clearTimeout(initial); window.clearInterval(interval); window.removeEventListener("approval-count-changed", loadApprovalCount); }; }, [loadApprovalCount]);
  useEffect(() => { const initial = window.setTimeout(() => void loadUnreadCount(), 0); const interval = window.setInterval(() => void loadUnreadCount(), 45_000); window.addEventListener("notification-unread-count-changed", loadUnreadCount); return () => { window.clearTimeout(initial); window.clearInterval(interval); window.removeEventListener("notification-unread-count-changed", loadUnreadCount); }; }, [loadUnreadCount]);

  async function logout() { await fetch("/api/auth/logout", { method: "POST" }); router.push("/login"); router.refresh(); }
  function toggleSidebar() { window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(!sidebarCollapsed)); window.dispatchEvent(new Event(SIDEBAR_CHANGE_EVENT)); }
  const department = user.departments.length ? user.departments.join(", ") : "All authorized departments";

  return <div className="min-h-screen bg-background text-foreground">
    <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:shadow">Skip to content</a>
    <aside className={cn("fixed inset-y-0 left-0 z-30 hidden bg-[#0b2a4a] p-3 text-white transition-[width] duration-200 motion-reduce:transition-none lg:block", sidebarCollapsed ? "w-20" : "w-64")}>
      <Button type="button" variant="outline" size="icon" className="absolute -right-3 top-6 z-10 size-7 rounded-full border-slate-300 bg-white text-slate-700 shadow-md hover:bg-slate-100" onClick={toggleSidebar} aria-label={sidebarCollapsed ? "Expand side menu" : "Collapse side menu"} title={sidebarCollapsed ? "Expand side menu" : "Collapse side menu"} aria-expanded={!sidebarCollapsed}>{sidebarCollapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}</Button>
      <Navigation user={user} approvalCount={approvalCount} collapsed={sidebarCollapsed} />
    </aside>
    <div className={cn("transition-[padding-left] duration-200 motion-reduce:transition-none", sidebarCollapsed ? "lg:pl-20" : "lg:pl-64")}>
      <header className="sticky top-0 z-20 flex min-h-16 items-center gap-2 border-b border-slate-200 bg-white/95 px-3 backdrop-blur md:gap-3 md:px-6">
        <Sheet><SheetTrigger asChild><Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation"><Menu className="size-5" /></Button></SheetTrigger><SheetContent side="left" className="w-[19rem] border-0 bg-[#0b2a4a] p-3 text-white"><SheetTitle className="sr-only">Application navigation</SheetTitle><SheetDescription className="sr-only">Choose a MA maintenance workspace</SheetDescription><Navigation user={user} approvalCount={approvalCount} mobile /></SheetContent></Sheet>
        <Link href="/dashboard" className="lg:hidden" aria-label="MA Next dashboard"><MaLogo compact size="sm" /></Link>
        <div className="hidden min-w-0 flex-1 sm:block"><Breadcrumbs /></div>
        <div className="ml-auto flex items-center gap-1 md:gap-2">
          {user.permissions.includes("VIEW_APPROVAL_CENTER") && <Button asChild variant="ghost" className="relative hidden min-h-10 gap-2 px-3 sm:flex"><Link href="/approvals"><ClipboardCheck className="size-4" /><span className="hidden xl:inline">Approvals</span><ApprovalBadge count={approvalCount} /></Link></Button>}
          {user.permissions.includes("VIEW_NOTIFICATIONS") && <Button asChild variant="ghost" size="icon" className="relative" aria-label={unreadCount ? `${unreadCount} unread messages` : "No unread messages"}><Link href="/inbox"><Bell className="size-5" />{unreadCount > 0 && <span className="absolute right-0.5 top-0.5 min-w-4 rounded-full bg-red-600 px-1 text-center text-[9px] font-bold leading-4 text-white" aria-hidden="true">{unreadCount > 99 ? "99+" : unreadCount}</span>}</Link></Button>}
          <Link href="/profile" className="hidden min-w-0 items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 md:flex"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-blue-100 text-sm font-bold text-blue-800">{user.fullName.slice(0, 1).toUpperCase()}</span><span className="min-w-0"><strong className="block max-w-44 truncate text-sm">{user.fullName}</strong><span className="block max-w-52 truncate text-xs text-slate-500">{user.role.replaceAll("_", " ")} · {department}</span></span></Link>
          <Button variant="ghost" size="icon" onClick={logout} aria-label="Sign out" title="Sign out"><LogOut className="size-5" /></Button>
        </div>
      </header>
      <div id="main-content" tabIndex={-1}>{children}</div>
    </div>
  </div>;
}
