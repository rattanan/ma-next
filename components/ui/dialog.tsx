"use client";
import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogTitle = DialogPrimitive.Title;
export const DialogDescription = DialogPrimitive.Description;
export function DialogContent({ className, children, ...props }: React.ComponentProps<typeof DialogPrimitive.Content>) { return <DialogPrimitive.Portal><DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-950/45" /><DialogPrimitive.Content className={cn("fixed inset-y-0 left-0 z-50 w-[min(20rem,88vw)] bg-slate-950 p-5 text-white shadow-2xl", className)} {...props}>{children}<DialogPrimitive.Close className="absolute right-3 top-3 grid size-10 place-items-center rounded-lg hover:bg-white/10" aria-label="Close navigation"><X className="size-5" /></DialogPrimitive.Close></DialogPrimitive.Content></DialogPrimitive.Portal>; }
