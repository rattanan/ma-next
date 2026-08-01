import * as React from "react";
import { cn } from "@/lib/utils";
export function Badge({ className, ...props }: React.ComponentProps<"span">) { return <span className={cn("inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-900", className)} {...props} />; }
