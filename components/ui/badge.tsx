import * as React from "react";
import { cn } from "@/lib/utils";
export function Badge({ className, variant = "default", ...props }: React.ComponentProps<"span"> & { variant?: "default" | "secondary" | "outline" }) {
  return <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold", variant === "default" && "border-blue-200 bg-blue-50 text-blue-900", variant === "secondary" && "border-slate-200 bg-slate-100 text-slate-700", variant === "outline" && "border-slate-200 bg-transparent text-slate-700", className)} {...props} />;
}
