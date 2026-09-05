import type { WorkOrderStatus } from "@/lib/db/schema";
import { HttpError } from "@/lib/http";

export const projectStatuses = ["DRAFT", "PLANNED", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "CLOSED", "CANCELLED"] as const;
export const taskStatuses = ["DRAFT", "READY", "WO_CREATED", "IN_PROGRESS", "BLOCKED", "WAITING_COMPLETION", "COMPLETED", "CANCELLED"] as const;
export type ProjectStatus = typeof projectStatuses[number];
export type TaskStatus = typeof taskStatuses[number];
export const taskStatusFromWorkOrder = {
  OPEN: "WO_CREATED", CREATED: "WO_CREATED", ASSIGNED: "WO_CREATED", TECHNICIAN_ACCEPTED: "WO_CREATED",
  BACKLOG: "BLOCKED", IN_PROGRESS: "IN_PROGRESS", WAITING_FOR_PARTS: "BLOCKED", WAITING_FOR_VENDOR: "BLOCKED", WAITING_FOR_ACCESS: "BLOCKED", ON_HOLD: "BLOCKED",
  COMPLETION_PENDING: "WAITING_COMPLETION", VERIFIED: "WAITING_COMPLETION", TECHNICIAN_COMPLETED: "WAITING_COMPLETION", UNDER_MANAGER_REVIEW: "WAITING_COMPLETION",
  RETURNED_TO_TECHNICIAN: "IN_PROGRESS", MANAGER_APPROVED: "WAITING_COMPLETION", WAITING_FOR_OPERATOR_ACCEPTANCE: "WAITING_COMPLETION", OPERATOR_REJECTED: "BLOCKED", OPERATOR_ACCEPTED: "WAITING_COMPLETION", CLOSED: "COMPLETED", CANCELLED: "BLOCKED",
} satisfies Record<WorkOrderStatus, TaskStatus>;

export type RollupTask = { id: string; parentId: string | null; kind: "EXECUTION" | "SUMMARY" | "MILESTONE"; status: TaskStatus };
export function rollupProject(current: ProjectStatus, tasks: readonly RollupTask[]) {
  const executable = tasks.filter(t => t.kind !== "SUMMARY");
  const active = executable.filter(t => t.status !== "CANCELLED");
  const completed = active.filter(t => t.status === "COMPLETED").length;
  const progress = active.length ? Math.round(completed / active.length * 10000) / 100 : 0;
  let status = current;
  if (!["ON_HOLD", "CLOSED", "CANCELLED", "DRAFT"].includes(current)) {
    if (active.length && completed === active.length) status = "COMPLETED";
    else if (active.some(t => ["IN_PROGRESS", "WAITING_COMPLETION", "BLOCKED", "COMPLETED"].includes(t.status))) status = "IN_PROGRESS";
    else if (current === "COMPLETED") status = "PLANNED";
  }
  return { status, progress, completed, total: active.length, cancelled: executable.length - active.length, blocked: active.filter(t => t.status === "BLOCKED").length };
}

export function assertAcyclic(edges: readonly { from: string; to: string }[]) {
  const adjacency = new Map<string, string[]>();
  for (const { from, to } of edges) adjacency.set(from, [...(adjacency.get(from) ?? []), to]);
  const visiting = new Set<string>(); const done = new Set<string>();
  function visit(id: string) {
    if (visiting.has(id)) throw new HttpError(409, "Dependencies must not contain a cycle", "DEPENDENCY_CYCLE");
    if (done.has(id)) return;
    visiting.add(id); for (const child of adjacency.get(id) ?? []) visit(child);
    visiting.delete(id); done.add(id);
  }
  for (const id of adjacency.keys()) visit(id);
}

// Schedule dates are local calendar dates. No elapsed-hour arithmetic across DST.
export function occurrenceDates(start: string, expiry: string, unit: "DAY" | "WEEK" | "MONTH", interval: number, from: string, to: string, limit = 366) {
  if (!Number.isInteger(interval) || interval < 1 || interval > 1200) throw new HttpError(400, "Invalid recurrence interval", "INVALID_SCHEDULE");
  const parse = (s: string) => { const d = new Date(`${s}T00:00:00Z`); if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || !Number.isFinite(+d) || d.toISOString().slice(0, 10) !== s) throw new HttpError(400, "Invalid calendar date", "INVALID_SCHEDULE"); return d; };
  const anchor = parse(start); parse(expiry); parse(from); parse(to);
  if (expiry < start || to < from) throw new HttpError(400, "Invalid schedule range", "INVALID_SCHEDULE");
  const result: string[] = [];
  const monthDistance = (parse(from).getUTCFullYear() - anchor.getUTCFullYear()) * 12 + parse(from).getUTCMonth() - anchor.getUTCMonth();
  const dayDistance = Math.floor((+parse(from) - +anchor) / 86400000);
  const first = Math.max(0, Math.floor((unit === "MONTH" ? monthDistance : dayDistance) / (interval * (unit === "WEEK" ? 7 : 1))) - 1);
  for (let n = first; n < first + 10000; n++) {
    let next: Date;
    if (unit === "MONTH") {
      const base = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + interval * n, 1));
      const last = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)).getUTCDate();
      base.setUTCDate(Math.min(anchor.getUTCDate(), last)); next = base;
    } else next = new Date(+anchor + n * interval * (unit === "WEEK" ? 7 : 1) * 86400000);
    const date = next.toISOString().slice(0, 10);
    if (date > expiry || date > to) break;
    if (date >= from) { if (result.length >= limit) throw new HttpError(400, "Narrow the schedule preview window", "SCHEDULE_LIMIT"); result.push(date); }
  }
  return result;
}

export function localDateAt(now: Date, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function scheduledInstant(date: string, time: string, timezone: string) {
  const target = new Date(`${date}T${time}:00Z`);
  let value = +target;
  const formatter = new Intl.DateTimeFormat("sv-SE", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
  for (let i = 0; i < 4; i++) {
    const displayed = new Date(formatter.format(new Date(value)).replace(" ", "T") + "Z");
    const delta = +target - +displayed;
    if (!delta) return new Date(value);
    value += delta;
  }
  throw new HttpError(400, "Schedule time does not exist in this timezone on this date", "DST_SCHEDULE_GAP");
}
