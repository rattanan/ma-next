"use client";

import { TriangleAlert } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, destructive = true, pending, onConfirm }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; description: string; confirmLabel: string; destructive?: boolean; pending?: boolean; onConfirm: () => void | Promise<void> }) {
  return <AlertDialog open={open} onOpenChange={onOpenChange}><AlertDialogContent className="w-[min(30rem,calc(100vw-2rem))] rounded-xl"><AlertDialogHeader className="text-left"><span className="mb-2 grid size-10 place-items-center rounded-full bg-amber-100 text-amber-800"><TriangleAlert className="size-5" /></span><AlertDialogTitle>{title}</AlertDialogTitle><AlertDialogDescription className="leading-6">{description}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel><AlertDialogAction asChild><Button variant={destructive ? "destructive" : "default"} disabled={pending} onClick={(event) => { event.preventDefault(); void onConfirm(); }}>{pending ? "Working…" : confirmLabel}</Button></AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>;
}
