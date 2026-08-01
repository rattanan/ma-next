"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";

type Role = "ADMIN" | "DATA_SOURCE_CREATOR" | "DASHBOARD_CREATOR" | "VIEWER";
type User = { id: string; fullName: string; role: Role };
type Asset = { id: string; code: string; name: string; location: string; criticality: string; status: string; typeName: string; categoryName: string | null };
type Notification = { id: string; code: string; title: string; description: string; type: string; priority: string; status: string; assetId: string; assetCode: string; assetName: string; dueAt: string | null; createdAt: string; requestedByName: string };
type WorkOrder = { id: string; code: string; title: string; description: string; priority: string; status: WorkStatus; notificationId: string; assetId: string; assetCode: string; assetName: string; assignedTo: string | null; dueAt: string | null; startedAt: string | null; verifiedAt: string | null; closedAt: string | null; updatedAt: string };
type WorkStatus = "OPEN" | "BACKLOG" | "IN_PROGRESS" | "COMPLETION_PENDING" | "VERIFIED" | "CLOSED";
type Task = { id: string; sequence: number; title: string; description: string | null; required: boolean; status: "OPEN" | "IN_PROGRESS" | "COMPLETED" };
type Completion = { id: string; result: string; solution: string; durationMinutes: number; completedAt: string };
type Event = { id: string; eventType: string; fromStatus: WorkStatus | null; toStatus: WorkStatus | null; note: string | null; createdAt: string };
type Detail = { order: WorkOrder; tasks: Task[]; execution: Array<{ id: string; description: string; minutesSpent: number; actionAt: string }>; completions: Completion[]; verifications: Array<{ id: string; decision: string; note: string; verifiedAt: string }>; events: Event[] };
type Overview = { assets: Asset[]; notifications: Notification[]; workOrders: WorkOrder[]; users: User[]; assetTypes: Array<{ id: string; code: string; name: string }>; assetCategories: Array<{ id: string; code: string; name: string }> };
type CurrentUser = { id: string; fullName: string; role: Role };
type Mutate = (url: string, payload: unknown, success: string, refreshDetailId?: string) => Promise<boolean>;

const emptyOverview: Overview = { assets: [], notifications: [], workOrders: [], users: [], assetTypes: [], assetCategories: [] };
const formatDate = (value: string | null) => value ? new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "Not set";
const label = (value: string) => value.toLowerCase().replaceAll("_", " ").replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
const isSupervisor = (role?: Role) => role === "ADMIN" || role === "DATA_SOURCE_CREATOR";
const canExecute = (role?: Role) => role === "ADMIN" || role === "DATA_SOURCE_CREATOR" || role === "DASHBOARD_CREATOR";

async function jsonRequest(url: string, options?: RequestInit) {
  const response = await fetch(url, options); const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Request failed");
  return body;
}

function StatusPill({ value }: { value: string }) { return <span className={`maintenance-status maintenance-status-${value.toLowerCase().replaceAll("_", "-")}`}>{label(value)}</span>; }

function Field({ label: fieldLabel, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="maintenance-field"><span>{fieldLabel}</span>{children}{hint && <small>{hint}</small>}</label>;
}

export default function MaintenanceWorkspace() {
  const [overview, setOverview] = useState<Overview>(emptyOverview);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [tab, setTab] = useState<"pipeline" | "assets" | "notifications">("pipeline");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [panel, setPanel] = useState<"asset" | "notification" | null>(null);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadOverview() {
    const [data, me] = await Promise.all([jsonRequest("/api/maintenance/overview"), jsonRequest("/api/auth/me")]);
    setOverview(data); setCurrentUser(me.user); setBusy(false);
  }

  useEffect(() => {
    let active = true;
    Promise.all([jsonRequest("/api/maintenance/overview"), jsonRequest("/api/auth/me")])
      .then(([data, me]) => { if (active) { setOverview(data); setCurrentUser(me.user); setBusy(false); } })
      .catch((reason) => { if (active) { setError(reason.message); setBusy(false); } });
    return () => { active = false; };
  }, []);

  async function loadDetail(id: string) { setError(""); try { setDetail(await jsonRequest(`/api/maintenance/work-orders/${id}`)); } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to load work order"); } }
  async function mutate(url: string, payload: unknown, success: string, refreshDetailId?: string) {
    setError(""); setMessage("");
    try { await jsonRequest(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }); setMessage(success); await loadOverview(); if (refreshDetailId) await loadDetail(refreshDetailId); return true; }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to save changes"); return false; }
  }

  async function createAsset(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const data = new FormData(event.currentTarget); if (await mutate("/api/maintenance/assets", { code: data.get("code"), name: data.get("name"), description: data.get("description"), assetTypeId: data.get("assetTypeId"), assetCategoryId: data.get("assetCategoryId") || null, location: data.get("location"), criticality: data.get("criticality"), status: "ACTIVE", ownerUserId: data.get("ownerUserId") || null }, "Asset created")) setPanel(null); }
  async function createNotification(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const data = new FormData(event.currentTarget); if (await mutate("/api/maintenance/notifications", { assetId: data.get("assetId"), title: data.get("title"), description: data.get("description"), type: data.get("type"), priority: data.get("priority"), breakdown: data.get("breakdown") === "on", supervisorId: data.get("supervisorId") || null, dueAt: data.get("dueAt") ? new Date(String(data.get("dueAt"))).toISOString() : null }, "Maintenance notification reported")) setPanel(null); }

  const counts = useMemo(() => ({ newNotifications: overview.notifications.filter((item) => item.status === "NEW").length, activeWork: overview.workOrders.filter((item) => !["CLOSED", "VERIFIED"].includes(item.status)).length, pendingVerification: overview.workOrders.filter((item) => item.status === "COMPLETION_PENDING").length, closed: overview.workOrders.filter((item) => item.status === "CLOSED").length }), [overview]);
  const initials = currentUser?.fullName.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "--";

  return <main className="maintenance-shell">
    <a className="skip-link" href="#maintenance-main">Skip to maintenance workspace</a>
    <aside className="maintenance-sidebar" aria-label="Maintenance navigation">
      <Link href="/" className="maintenance-brand"><span>AM</span><strong>Atlas Maintain</strong></Link>
      <p>WORKSPACE</p>
      <nav><button className={tab === "pipeline" ? "active" : ""} onClick={() => setTab("pipeline")}>Work pipeline</button><button className={tab === "assets" ? "active" : ""} onClick={() => setTab("assets")}>Asset register</button><button className={tab === "notifications" ? "active" : ""} onClick={() => setTab("notifications")}>Notifications</button></nav>
      <div className="maintenance-sidebar-note"><strong>Migration slice</strong><span>Asset to verified close</span></div>
      <Link className="maintenance-account" href="/profile"><span>{initials}</span><small>{currentUser?.fullName}<br />{currentUser ? label(currentUser.role) : "Loading"}</small></Link>
    </aside>
    <section className="maintenance-content" id="maintenance-main">
      <header className="maintenance-topbar"><div><span>Maintenance operations</span><strong>/ {tab === "pipeline" ? "Work pipeline" : tab === "assets" ? "Assets" : "Notifications"}</strong></div><div><Link href="/">Administration</Link><Link href="/profile">Profile</Link></div></header>
      <div className="maintenance-page">
        <div className="maintenance-heading"><div><p className="maintenance-eyebrow">CONTROLLED MAINTENANCE FLOW</p><h1>{tab === "pipeline" ? "Maintenance work pipeline" : tab === "assets" ? "Asset register" : "Maintenance notifications"}</h1><p>{tab === "pipeline" ? "Move work from reported condition through supervised verification and close." : tab === "assets" ? "Maintain the equipment identity that anchors every request and work order." : "Report, review, and authorize maintenance against an active asset."}</p></div><div className="maintenance-heading-actions">{canExecute(currentUser?.role) && <button className="secondary-button" onClick={() => { setPanel("asset"); setTab("assets"); }}>New asset</button>}<button className="primary-button" onClick={() => { setPanel("notification"); setTab("notifications"); }}>Report notification</button></div></div>
        <div className="maintenance-live" aria-live="polite" aria-atomic="true">{message && <p className="form-success">{message}</p>}{error && <p className="form-error" role="alert">{error}</p>}</div>
        {busy ? <div className="maintenance-loading">Loading maintenance data…</div> : <>
          <section className="maintenance-metrics" aria-label="Maintenance summary"><article><span>New notifications</span><strong>{counts.newNotifications}</strong><small>Awaiting review</small></article><article><span>Active work</span><strong>{counts.activeWork}</strong><small>Backlog to completion</small></article><article><span>Verification queue</span><strong>{counts.pendingVerification}</strong><small>Supervisor action</small></article><article><span>Closed</span><strong>{counts.closed}</strong><small>Verified records</small></article></section>
          {panel === "asset" && <AssetForm overview={overview} onSubmit={createAsset} onCancel={() => setPanel(null)} />}
          {panel === "notification" && <NotificationForm overview={overview} onSubmit={createNotification} onCancel={() => setPanel(null)} />}
          {tab === "pipeline" && <Pipeline orders={overview.workOrders} onOpen={loadDetail} detail={detail} role={currentUser?.role} mutate={mutate} />}
          {tab === "assets" && <AssetRegister assets={overview.assets} />}
          {tab === "notifications" && <NotificationQueue notifications={overview.notifications} users={overview.users} role={currentUser?.role} mutate={mutate} />}
        </>}
      </div>
    </section>
  </main>;
}

function AssetForm({ overview, onSubmit, onCancel }: { overview: Overview; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onCancel: () => void }) {
  return <section className="maintenance-form-card" aria-labelledby="asset-form-title"><div><p className="maintenance-eyebrow">ASSET FOUNDATION</p><h2 id="asset-form-title">Register an asset</h2><p>Codes are normalized to uppercase and must be unique.</p></div>{overview.assetTypes.length === 0 ? <p className="form-error" role="alert">No active asset type exists. Run the maintenance seed after applying the migration.</p> : <form onSubmit={onSubmit}><div className="maintenance-form-grid"><Field label="Asset code"><input name="code" required minLength={2} maxLength={60} /></Field><Field label="Asset name"><input name="name" required minLength={2} maxLength={160} /></Field><Field label="Type"><select name="assetTypeId" required><option value="">Select type</option>{overview.assetTypes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label="Category"><select name="assetCategoryId"><option value="">No category</option>{overview.assetCategories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label="Location"><input name="location" required minLength={2} maxLength={190} /></Field><Field label="Criticality"><select name="criticality" defaultValue="MEDIUM"><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>CRITICAL</option></select></Field><Field label="Owner"><select name="ownerUserId"><option value="">Unassigned</option>{overview.users.map((item) => <option key={item.id} value={item.id}>{item.fullName}</option>)}</select></Field><Field label="Description"><textarea name="description" rows={3} maxLength={4000} /></Field></div><div className="maintenance-form-actions"><button type="button" className="secondary-button" onClick={onCancel}>Cancel</button><button className="primary-button">Create asset</button></div></form>}</section>;
}

function NotificationForm({ overview, onSubmit, onCancel }: { overview: Overview; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onCancel: () => void }) {
  return <section className="maintenance-form-card" aria-labelledby="notification-form-title"><div><p className="maintenance-eyebrow">REPORT CONDITION</p><h2 id="notification-form-title">New maintenance notification</h2><p>A supervisor reviews this record before work begins.</p></div>{overview.assets.length === 0 ? <p className="form-error" role="alert">Register an active asset before reporting a notification.</p> : <form onSubmit={onSubmit}><div className="maintenance-form-grid"><Field label="Asset"><select name="assetId" required><option value="">Select asset</option>{overview.assets.filter((item) => item.status === "ACTIVE").map((item) => <option key={item.id} value={item.id}>{item.code} — {item.name}</option>)}</select></Field><Field label="Title"><input name="title" required minLength={3} maxLength={190} /></Field><Field label="Type"><select name="type" defaultValue="CORRECTIVE"><option>CORRECTIVE</option><option>BREAKDOWN</option><option>INSPECTION</option></select></Field><Field label="Priority"><select name="priority" defaultValue="MEDIUM"><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>CRITICAL</option></select></Field><Field label="Supervisor"><select name="supervisorId"><option value="">Assign during review</option>{overview.users.filter((item) => isSupervisor(item.role)).map((item) => <option key={item.id} value={item.id}>{item.fullName}</option>)}</select></Field><Field label="Requested due date"><input name="dueAt" type="datetime-local" /></Field><Field label="Description"><textarea name="description" required minLength={5} maxLength={8000} rows={4} /></Field><label className="maintenance-check"><input name="breakdown" type="checkbox" /> Asset is in breakdown</label></div><div className="maintenance-form-actions"><button type="button" className="secondary-button" onClick={onCancel}>Cancel</button><button className="primary-button">Submit notification</button></div></form>}</section>;
}

function AssetRegister({ assets: rows }: { assets: Asset[] }) { return <section className="maintenance-card"><div className="maintenance-card-head"><div><h2>Assets</h2><p>{rows.length} registered assets</p></div></div><div className="maintenance-table-wrap"><table className="maintenance-table"><thead><tr><th>Asset</th><th>Type</th><th>Location</th><th>Criticality</th><th>Status</th></tr></thead><tbody>{rows.map((asset) => <tr key={asset.id}><td><strong>{asset.code}</strong><small>{asset.name}</small></td><td>{asset.typeName}<small>{asset.categoryName || "Uncategorized"}</small></td><td>{asset.location}</td><td><StatusPill value={asset.criticality} /></td><td><StatusPill value={asset.status} /></td></tr>)}</tbody></table>{rows.length === 0 && <p className="maintenance-empty">No assets registered yet.</p>}</div></section>; }

function NotificationQueue({ notifications, users, role, mutate }: { notifications: Notification[]; users: User[]; role?: Role; mutate: Mutate }) {
  return <section className="maintenance-card"><div className="maintenance-card-head"><div><h2>Notification review queue</h2><p>One immutable review decision per notification</p></div></div><div className="maintenance-list">{notifications.map((item) => <article className="notification-row" key={item.id}><div className="notification-code"><strong>{item.code}</strong><StatusPill value={item.status} /></div><div><h3>{item.title}</h3><p>{item.assetCode} · {item.assetName} · Reported by {item.requestedByName}</p><small>{item.description}</small></div>{item.status === "NEW" && isSupervisor(role) ? <ReviewForm item={item} users={users} mutate={mutate} /> : <div className="notification-meta"><StatusPill value={item.priority} /><time>{formatDate(item.dueAt)}</time></div>}</article>)}{notifications.length === 0 && <p className="maintenance-empty">No notifications reported yet.</p>}</div></section>;
}

function ReviewForm({ item, users, mutate }: { item: Notification; users: User[]; mutate: Mutate }) {
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const data = new FormData(event.currentTarget); const due = data.get("dueAt"); await mutate(`/api/maintenance/notifications/${item.id}/review`, { decision: data.get("decision"), note: data.get("note"), assignedTo: data.get("assignedTo") || null, dueAt: due ? new Date(String(due)).toISOString() : null }, `${item.code} reviewed`); }
  return <form className="review-form" onSubmit={submit}><Field label="Decision"><select name="decision" defaultValue="APPROVED"><option>APPROVED</option><option>BACKLOG</option><option>REJECTED</option></select></Field><Field label="Assignee"><select name="assignedTo"><option value="">Not required for rejection</option>{users.filter((user) => canExecute(user.role)).map((user) => <option key={user.id} value={user.id}>{user.fullName}</option>)}</select></Field><Field label="Due"><input name="dueAt" type="datetime-local" /></Field><Field label="Review note"><input name="note" required minLength={3} maxLength={4000} /></Field><button className="primary-button">Record review</button></form>;
}

function Pipeline({ orders, onOpen, detail, role, mutate }: { orders: WorkOrder[]; onOpen: (id: string) => void; detail: Detail | null; role?: Role; mutate: Mutate }) {
  return <div className="pipeline-grid"><section className="maintenance-card"><div className="maintenance-card-head"><div><h2>Work orders</h2><p>Select a record to manage execution</p></div></div><div className="work-order-list">{orders.map((order) => <button key={order.id} className={detail?.order.id === order.id ? "selected" : ""} onClick={() => onOpen(order.id)}><span><strong>{order.code}</strong><small>{order.assetCode} · {order.assetName}</small></span><span><StatusPill value={order.status} /><small>{formatDate(order.updatedAt)}</small></span></button>)}{orders.length === 0 && <p className="maintenance-empty">Approved notifications will create work orders here.</p>}</div></section>{detail ? <WorkOrderDetail detail={detail} role={role} mutate={mutate} /> : <section className="maintenance-card maintenance-detail-empty"><span>01 → 02 → 03</span><h2>Select a work order</h2><p>Tasks, execution, completion, verification, and closure stay together in one auditable record.</p></section>}</div>;
}

function WorkOrderDetail({ detail, role, mutate }: { detail: Detail; role?: Role; mutate: Mutate }) {
  const { order } = detail; const endpoint = `/api/maintenance/work-orders/${order.id}`; const latestCompletion = detail.completions[0];
  const action = (name: string, payload: unknown, message: string) => mutate(`${endpoint}/${name}`, payload, message, order.id);
  return <section className="maintenance-card work-detail"><div className="work-detail-head"><div><p className="maintenance-eyebrow">{order.assetCode} · {order.assetName}</p><h2>{order.code}</h2><p>{order.title}</p></div><StatusPill value={order.status} /></div><div className="workflow-rail" aria-label="Work order progress">{["OPEN", "IN_PROGRESS", "COMPLETION_PENDING", "VERIFIED", "CLOSED"].map((step, index) => <div key={step} className={step === order.status || (["BACKLOG"].includes(order.status) && step === "OPEN") ? "current" : ""}><span>{index + 1}</span><small>{label(step)}</small></div>)}</div>
    {(order.status === "OPEN" || order.status === "BACKLOG") && canExecute(role) && <div className="maintenance-action-strip"><p>Work is authorized and ready for the assignee.</p><button className="primary-button" onClick={() => action("start", {}, `${order.code} started`)}>Start work</button></div>}
    <section className="work-section"><div className="work-section-title"><div><h3>Required tasks</h3><p>Every required task must be complete before submission.</p></div></div><div className="task-list">{detail.tasks.map((task) => <article key={task.id}><span className="task-number">{task.sequence}</span><div><strong>{task.title}</strong><small>{task.required ? "Required" : "Optional"}{task.description ? ` · ${task.description}` : ""}</small></div><StatusPill value={task.status} />{canExecute(role) && ["OPEN", "BACKLOG", "IN_PROGRESS"].includes(order.status) && task.status !== "COMPLETED" && <button className="secondary-button" onClick={() => action("task-status", { taskId: task.id, status: "COMPLETED" }, "Task completed")}>Complete</button>}</article>)}{detail.tasks.length === 0 && <p className="maintenance-empty">No tasks added. Legacy behavior permits completion with no tasks.</p>}</div>{canExecute(role) && ["OPEN", "BACKLOG", "IN_PROGRESS"].includes(order.status) && <CompactForm legend="Add task" fields={<><Field label="Task title"><input name="title" required minLength={2} /></Field><Field label="Description"><input name="description" maxLength={4000} /></Field><label className="maintenance-check"><input name="required" type="checkbox" defaultChecked /> Required task</label></>} onSubmit={(data) => action("tasks", { title: data.get("title"), description: data.get("description"), required: data.get("required") === "on" }, "Task added")} submitLabel="Add task" />}</section>
    {order.status === "IN_PROGRESS" && canExecute(role) && <><section className="work-section"><h3>Execution log</h3>{detail.execution.map((entry) => <article className="execution-entry" key={entry.id}><strong>{entry.minutesSpent} min</strong><span>{entry.description}</span><time>{formatDate(entry.actionAt)}</time></article>)}<CompactForm legend="Record work" fields={<><Field label="Action"><input name="description" required minLength={3} /></Field><Field label="Minutes spent"><input name="minutesSpent" type="number" min={1} max={1440} required /></Field><Field label="Action time"><input name="actionAt" type="datetime-local" required defaultValue={new Date().toISOString().slice(0, 16)} /></Field></>} onSubmit={(data) => action("execution", { description: data.get("description"), minutesSpent: Number(data.get("minutesSpent")), actionAt: new Date(String(data.get("actionAt"))).toISOString() }, "Execution recorded")} submitLabel="Record execution" /></section><CompletionForm submit={(payload) => action("completion", payload, "Completion submitted for supervisor verification")} /></>}
    {order.status === "COMPLETION_PENDING" && isSupervisor(role) && latestCompletion && <VerificationForm completion={latestCompletion} submit={(payload) => action("verification", payload, "Supervisor decision recorded")} />}
    {order.status === "VERIFIED" && isSupervisor(role) && <CompactForm legend="Close verified work" fields={<Field label="Closure note"><input name="note" required minLength={3} maxLength={4000} /></Field>} onSubmit={(data) => action("close", { note: data.get("note") }, `${order.code} closed`)} submitLabel="Close work order" />}
    <section className="work-section"><h3>Audit timeline</h3><ol className="event-timeline">{detail.events.map((event) => <li key={event.id}><span /><div><strong>{label(event.eventType)}</strong><small>{event.note || `${event.fromStatus ? label(event.fromStatus) : "Created"} → ${event.toStatus ? label(event.toStatus) : "Recorded"}`}</small></div><time>{formatDate(event.createdAt)}</time></li>)}</ol></section>
  </section>;
}

function CompactForm({ legend, fields, onSubmit, submitLabel }: { legend: string; fields: ReactNode; onSubmit: (data: FormData) => Promise<unknown>; submitLabel: string }) { async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); await onSubmit(new FormData(event.currentTarget)); } return <form className="compact-form" onSubmit={submit}><fieldset><legend>{legend}</legend><div>{fields}<button className="primary-button">{submitLabel}</button></div></fieldset></form>; }

function CompletionForm({ submit }: { submit: (payload: unknown) => Promise<unknown> }) { return <section className="work-section"><CompactForm legend="Submit completion" fields={<><Field label="Result"><input name="result" required minLength={2} maxLength={190} /></Field><Field label="Problem"><input name="problem" maxLength={8000} /></Field><Field label="Cause"><input name="cause" maxLength={8000} /></Field><Field label="Solution"><textarea name="solution" required minLength={3} maxLength={8000} rows={3} /></Field><Field label="Escalation"><input name="escalation" maxLength={8000} /></Field><Field label="Duration (minutes)"><input name="durationMinutes" type="number" required min={1} max={525600} /></Field></>} onSubmit={(data) => submit({ result: data.get("result"), problem: data.get("problem"), cause: data.get("cause"), solution: data.get("solution"), escalation: data.get("escalation"), durationMinutes: Number(data.get("durationMinutes")) })} submitLabel="Submit for verification" /></section>; }

function VerificationForm({ completion, submit }: { completion: Completion; submit: (payload: unknown) => Promise<unknown> }) { return <section className="work-section supervisor-panel"><p className="maintenance-eyebrow">SUPERVISOR GATE</p><h3>Verify completion</h3><dl><div><dt>Result</dt><dd>{completion.result}</dd></div><div><dt>Solution</dt><dd>{completion.solution}</dd></div><div><dt>Duration</dt><dd>{completion.durationMinutes} minutes</dd></div></dl><CompactForm legend="Supervisor decision" fields={<><Field label="Decision"><select name="decision"><option>VERIFIED</option><option>RETURNED</option></select></Field><Field label="Verification note"><input name="note" required minLength={3} maxLength={4000} /></Field></>} onSubmit={(data) => submit({ completionId: completion.id, decision: data.get("decision"), note: data.get("note") })} submitLabel="Record decision" /></section>; }
