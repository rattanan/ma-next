"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Bell, CheckCheck, Inbox } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/shared/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type Recipient = { id: string; status: "UNREAD" | "READ"; readAt: string | null; notification: { title: string; message: string; type: string; actionUrl: string | null; createdAt: string } };
type View = "unread" | "all";

export function NotificationCenter() {
  const [items, setItems] = useState<Recipient[]>([]);
  const [view, setView] = useState<View>("unread");
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function load() {
    const response = await fetch("/api/notifications");
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Unable to load notifications");
    setItems(body.notifications);
  }

  useEffect(() => {
    let active = true;
    fetch("/api/notifications").then(async (response) => ({ response, body: await response.json() })).then(({ response, body }) => {
      if (!response.ok) throw new Error(body.error || "Unable to load notifications");
      if (active) setItems(body.notifications);
    }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Unable to load notifications"); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function markRead(id: string) {
    setPendingId(id);
    setError("");
    try {
      const response = await fetch(`/api/notifications/${id}/read`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "READ" }) });
      if (!response.ok) throw new Error((await response.json()).error || "Unable to mark notification as read");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to mark notification as read");
    } finally {
      setPendingId(null);
    }
  }

  const unreadCount = items.filter((item) => item.status === "UNREAD").length;
  const visibleItems = useMemo(() => view === "unread" ? items.filter((item) => item.status === "UNREAD") : items, [items, view]);

  return <PageContainer><PageHeader eyebrow="Inbox" title="Notification center" description="Operational updates and actions assigned to your account." icon={<Bell className="size-5" />} metadata={!loading ? `${unreadCount} unread · ${items.length} total` : undefined} /><Tabs value={view} onValueChange={(value) => setView(value as View)}><TabsList aria-label="Notification views"><TabsTrigger value="unread">Unread <span className="ml-1 opacity-75">{unreadCount}</span></TabsTrigger><TabsTrigger value="all">All <span className="ml-1 opacity-75">{items.length}</span></TabsTrigger></TabsList></Tabs>{error && <Alert variant="destructive">{error}</Alert>}<section className="overflow-hidden rounded-xl border border-slate-200 bg-white" aria-busy={loading} aria-live="polite">{loading ? <NotificationSkeleton /> : visibleItems.length ? <div className="divide-y divide-slate-200">{visibleItems.map((item) => <article key={item.id} className={cn("grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:p-5", item.status === "UNREAD" && "bg-blue-50/40")}><div className="flex min-w-0 gap-3"><span className={cn("mt-1 size-2 shrink-0 rounded-full", item.status === "UNREAD" ? "bg-blue-600" : "bg-slate-300")} aria-hidden="true" /><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="font-bold text-slate-950">{item.notification.title}</h2>{item.status === "UNREAD" && <Badge>Unread</Badge>}</div><p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{item.notification.type.replaceAll("_", " ")} · {new Date(item.notification.createdAt).toLocaleString()}</p><p className="mt-3 max-w-3xl text-sm leading-6 text-slate-700">{item.notification.message}</p>{item.notification.actionUrl && <Link className="mt-3 inline-flex min-h-10 items-center gap-2 text-sm font-bold text-blue-700 hover:text-blue-900" href={item.notification.actionUrl}>Open related record <ArrowRight className="size-4" /></Link>}</div></div>{item.status === "UNREAD" && <Button variant="outline" size="sm" className="w-full md:w-auto" disabled={pendingId === item.id} onClick={() => markRead(item.id)}><CheckCheck className="size-4" />{pendingId === item.id ? "Marking…" : "Mark read"}</Button>}</article>)}</div> : <div className="p-10 text-center"><span className="mx-auto grid size-12 place-items-center rounded-xl bg-blue-50 text-blue-700"><Inbox className="size-6" /></span><h2 className="mt-4 font-bold text-slate-950">{view === "unread" ? "You are all caught up" : "No notifications yet"}</h2><p className="mt-2 text-sm text-slate-500">{view === "unread" ? "There are no unread operational notifications." : "Operational updates assigned to you will appear here."}</p>{view === "unread" && items.length > 0 && <Button variant="outline" className="mt-4" onClick={() => setView("all")}>View read notifications</Button>}</div>}</section></PageContainer>;
}

function NotificationSkeleton() {
  return <div className="divide-y divide-slate-200">{[1, 2, 3].map((item) => <div key={item} className="space-y-3 p-5"><Skeleton className="h-5 w-2/5" /><Skeleton className="h-3 w-1/3" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-4/5" /></div>)}</div>;
}
