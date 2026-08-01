import * as React from "react";
import { cn } from "@/lib/utils";

export function Alert({ variant = "info", className, ...props }: React.ComponentProps<"div"> & { variant?: "info" | "success" | "destructive" }) {
  return <div role={variant === "destructive" ? "alert" : "status"} className={cn("rounded-lg border px-4 py-3 text-sm leading-6", variant === "destructive" && "border-red-200 bg-red-50 text-red-900", variant === "success" && "border-emerald-200 bg-emerald-50 text-emerald-900", variant === "info" && "border-blue-200 bg-blue-50 text-blue-950", className)} {...props} />;
}
