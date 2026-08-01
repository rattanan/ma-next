import * as React from "react";
import { cn } from "@/lib/utils";
export function Card({ className, ...props }: React.ComponentProps<"section">) { return <section className={cn("rounded-xl border border-slate-200 bg-white shadow-sm", className)} {...props} />; }
export function CardHeader({ className, ...props }: React.ComponentProps<"div">) { return <div className={cn("space-y-1.5 p-5 pb-3", className)} {...props} />; }
export function CardTitle({ className, ...props }: React.ComponentProps<"h2">) { return <h2 className={cn("text-lg font-bold tracking-tight text-slate-950", className)} {...props} />; }
export function CardDescription({ className, ...props }: React.ComponentProps<"p">) { return <p className={cn("text-sm leading-6 text-slate-600", className)} {...props} />; }
export function CardContent({ className, ...props }: React.ComponentProps<"div">) { return <div className={cn("p-5 pt-2", className)} {...props} />; }
