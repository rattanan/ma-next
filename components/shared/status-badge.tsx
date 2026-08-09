import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const tones: Record<string, string> = {
  DRAFT: "border-slate-300 bg-slate-100 text-slate-700",
  NEW: "border-blue-200 bg-blue-50 text-blue-800",
  OPEN: "border-blue-200 bg-blue-50 text-blue-800",
  CREATED: "border-blue-200 bg-blue-50 text-blue-800",
  ASSIGNED: "border-indigo-200 bg-indigo-50 text-indigo-800",
  TECHNICIAN_ACCEPTED: "border-indigo-200 bg-indigo-50 text-indigo-800",
  IN_PROGRESS: "border-blue-300 bg-blue-100 text-blue-900",
  UNDER_REVIEW: "border-amber-200 bg-amber-50 text-amber-800",
  UNDER_MANAGER_REVIEW: "border-amber-200 bg-amber-50 text-amber-800",
  SUBMITTED: "border-amber-200 bg-amber-50 text-amber-800",
  NEEDS_INFORMATION: "border-orange-200 bg-orange-50 text-orange-800",
  IN_MAINTENANCE: "border-blue-300 bg-blue-100 text-blue-900",
  COMPLETION_PENDING: "border-cyan-200 bg-cyan-50 text-cyan-900",
  TECHNICIAN_COMPLETED: "border-cyan-200 bg-cyan-50 text-cyan-900",
  MANAGER_APPROVED: "border-teal-200 bg-teal-50 text-teal-800",
  WAITING_FOR_OPERATOR_ACCEPTANCE: "border-amber-200 bg-amber-50 text-amber-800",
  OPERATOR_ACCEPTED: "border-emerald-200 bg-emerald-50 text-emerald-800",
  READY_TO_CLOSE: "border-teal-200 bg-teal-50 text-teal-800",
  PENDING: "border-amber-200 bg-amber-50 text-amber-800",
  PENDING_APPROVAL: "border-amber-200 bg-amber-50 text-amber-800",
  PARTIAL_RECEIVED: "border-cyan-200 bg-cyan-50 text-cyan-900",
  RECEIVED: "border-emerald-200 bg-emerald-50 text-emerald-800",
  APPROVED: "border-emerald-200 bg-emerald-50 text-emerald-800",
  VERIFIED: "border-teal-200 bg-teal-50 text-teal-800",
  COMPLETED: "border-emerald-200 bg-emerald-50 text-emerald-800",
  CLOSED: "border-emerald-200 bg-emerald-50 text-emerald-800",
  WAITING_FOR_PARTS: "border-amber-200 bg-amber-50 text-amber-800",
  WAITING_FOR_VENDOR: "border-amber-200 bg-amber-50 text-amber-800",
  WAITING_FOR_ACCESS: "border-amber-200 bg-amber-50 text-amber-800",
  ON_HOLD: "border-amber-200 bg-amber-50 text-amber-800",
  BACKLOG: "border-orange-200 bg-orange-50 text-orange-800",
  RETURNED: "border-orange-300 bg-orange-50 text-orange-900",
  RETURNED_TO_TECHNICIAN: "border-orange-300 bg-orange-50 text-orange-900",
  OPERATOR_REJECTED: "border-red-200 bg-red-50 text-red-800",
  REJECTED: "border-red-200 bg-red-50 text-red-800",
  CANCELLED: "border-red-200 bg-red-50 text-red-800",
  ACTIVE: "border-emerald-200 bg-emerald-50 text-emerald-800",
  INACTIVE: "border-slate-300 bg-slate-100 text-slate-700",
  POSTED: "border-emerald-200 bg-emerald-50 text-emerald-800",
  COUNTING: "border-blue-200 bg-blue-50 text-blue-800",
  PENDING_MAINTENANCE_MANAGER: "border-amber-200 bg-amber-50 text-amber-800",
  PENDING_WAREHOUSE_MANAGER: "border-amber-200 bg-amber-50 text-amber-800",
  PENDING_PLANT_MANAGER: "border-amber-200 bg-amber-50 text-amber-800",
};

export function humanizeStatus(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

export function statusToneClass(status: string) {
  return tones[status] ?? "border-slate-200 bg-slate-50 text-slate-700";
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return <Badge className={cn("border font-semibold", statusToneClass(status), className)}>{humanizeStatus(status)}</Badge>;
}

export function PriorityBadge({ priority, className }: { priority: string; className?: string }) {
  const tone = priority === "CRITICAL" ? "border-red-300 bg-red-100 text-red-900" : priority === "HIGH" ? "border-orange-200 bg-orange-50 text-orange-900" : priority === "LOW" ? "border-slate-200 bg-slate-50 text-slate-700" : "border-blue-200 bg-blue-50 text-blue-800";
  return <Badge className={cn("border font-semibold", tone, className)}>{humanizeStatus(priority)}</Badge>;
}
