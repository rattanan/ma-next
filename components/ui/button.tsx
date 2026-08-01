import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva("inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50", { variants: { variant: { default: "bg-blue-700 text-white shadow-sm hover:bg-blue-800", secondary: "bg-blue-50 text-blue-950 hover:bg-blue-100", outline: "border border-slate-300 bg-white text-slate-900 hover:border-blue-300 hover:bg-blue-50", ghost: "text-slate-700 hover:bg-blue-50 hover:text-blue-900", destructive: "bg-red-700 text-white hover:bg-red-800" }, size: { default: "h-10", sm: "h-9 px-3", lg: "h-12 px-6", icon: "size-10 px-0" } }, defaultVariants: { variant: "default", size: "default" } });
export function Button({ className, variant, size, asChild = false, ...props }: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) { const Comp = asChild ? Slot : "button"; return <Comp data-slot="button" className={cn(buttonVariants({ variant, size }), className)} {...props} />; }
