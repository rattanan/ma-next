"use client";

import { Check, Loader2, Search, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type AssetOption = { id: string; code: string; name: string; location: string; structureLevel: string; status: string };

type Props = {
  id?: string; name?: string; value?: string | null; defaultValue?: string | null; onValueChange?: (value: string, option: AssetOption | null) => void;
  required?: boolean; disabled?: boolean; activeOnly?: boolean; excludeId?: string; placeholder?: string; className?: string;
};

const optionLabel = (option: AssetOption) => `${option.code} — ${option.name}`;

export function AssetCombobox({ id, name, value, defaultValue, onValueChange, required, disabled, activeOnly = true, excludeId, placeholder = "พิมพ์รหัสหรือชื่อ Asset อย่างน้อย 2 ตัวอักษร", className }: Props) {
  const generatedId = useId(); const inputId = id ?? `asset-search-${generatedId}`; const listId = `${inputId}-listbox`;
  const controlled = value !== undefined; const [internalValue, setInternalValue] = useState(defaultValue ?? ""); const selectedId = controlled ? value ?? "" : internalValue;
  const [selected, setSelected] = useState<AssetOption | null>(null); const [query, setQuery] = useState(""); const [items, setItems] = useState<AssetOption[]>([]); const [open, setOpen] = useState(false); const [loading, setLoading] = useState(false); const [activeIndex, setActiveIndex] = useState(-1); const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null); const rootRef = useRef<HTMLDivElement>(null); const inputRef = useRef<HTMLInputElement>(null);
  function commit(next: AssetOption | null) { if (!controlled) setInternalValue(next?.id ?? ""); setSelected(next); setQuery(next ? optionLabel(next) : ""); setItems([]); setOpen(false); setActiveIndex(-1); inputRef.current?.setCustomValidity(""); onValueChange?.(next?.id ?? "", next); }

  useEffect(() => {
    const form = rootRef.current?.closest("form"); if (!form) return;
    const reset = () => { if (!controlled) setInternalValue(defaultValue ?? ""); setSelected(null); setQuery(""); setItems([]); setOpen(false); setActiveIndex(-1); inputRef.current?.setCustomValidity(""); onValueChange?.(defaultValue ?? "", null); };
    form.addEventListener("reset", reset); return () => form.removeEventListener("reset", reset);
  }, [controlled, defaultValue, onValueChange]);

  useEffect(() => {
    if (!selectedId) return;
    if (selected?.id === selectedId) return;
    const controller = new AbortController(); const params = new URLSearchParams({ selectedId, activeOnly: "false", limit: "1" }); if (excludeId) params.set("excludeId", excludeId);
    fetch(`/api/assets/search?${params}`, { signal: controller.signal }).then((response) => response.ok ? response.json() : Promise.reject(new Error("Asset lookup failed"))).then((body: { items: AssetOption[] }) => { const option = body.items[0] ?? null; setSelected(option); setQuery(option ? optionLabel(option) : ""); }).catch((error) => { if (error.name !== "AbortError") setSelected(null); });
    return () => controller.abort();
  }, [activeOnly, excludeId, selected, selectedId]);

  useEffect(() => {
    const term = query.trim(); if (!open || selected || term.length < 2) return;
    const controller = new AbortController(); const timer = window.setTimeout(() => { const params = new URLSearchParams({ q: term, activeOnly: String(activeOnly), limit: "20" }); if (excludeId) params.set("excludeId", excludeId); setLoading(true); fetch(`/api/assets/search?${params}`, { signal: controller.signal }).then((response) => response.ok ? response.json() : Promise.reject(new Error("Asset search failed"))).then((body: { items: AssetOption[] }) => { setItems(body.items); setActiveIndex(body.items.length ? 0 : -1); }).catch((error) => { if (error.name !== "AbortError") setItems([]); }).finally(() => { if (!controller.signal.aborted) setLoading(false); }); }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [activeOnly, excludeId, open, query, selected]);

  function change(text: string) { if (selected) { if (!controlled) setInternalValue(""); onValueChange?.("", null); setSelected(null); } inputRef.current?.setCustomValidity(text ? "กรุณาเลือก Asset จากผลการค้นหา" : ""); setQuery(text); setItems([]); setLoading(false); setActiveIndex(-1); setOpen(true); }
  function keyDown(event: React.KeyboardEvent<HTMLInputElement>) { if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); setActiveIndex((index) => Math.min(items.length - 1, index + 1)); } else if (event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((index) => Math.max(0, index - 1)); } else if (event.key === "Enter" && open && activeIndex >= 0 && items[activeIndex]) { event.preventDefault(); commit(items[activeIndex]); } else if (event.key === "Escape") { setOpen(false); } }

  return <div ref={rootRef} className={cn("relative", className)} onBlur={() => { blurTimer.current = setTimeout(() => setOpen(false), 100); }} onFocus={() => { if (blurTimer.current) clearTimeout(blurTimer.current); }}>
    {name && <input type="hidden" name={name} value={selectedId} />}
    <div className="relative"><Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-slate-400" /><Input ref={inputRef} id={inputId} role="combobox" autoComplete="off" value={query} disabled={disabled} required={required} aria-expanded={open} aria-controls={listId} aria-autocomplete="list" aria-busy={loading} aria-activedescendant={activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined} className="pl-9 pr-10" placeholder={placeholder} onFocus={() => setOpen(true)} onChange={(event) => change(event.target.value)} onKeyDown={keyDown} />{loading ? <Loader2 className="absolute right-3 top-3.5 size-4 animate-spin text-slate-500" /> : selected && <Button type="button" variant="ghost" size="icon" disabled={disabled} aria-label="ล้าง Asset ที่เลือก" className="absolute right-1 top-1 size-9" onClick={() => commit(null)}><X className="size-4" /></Button>}</div>
    {open && !selected && <div id={listId} role="listbox" className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-xl border bg-white p-1 shadow-xl">{query.trim().length < 2 ? <p className="px-3 py-3 text-sm text-slate-500">พิมพ์อย่างน้อย 2 ตัวอักษรเพื่อค้นหา</p> : loading ? <p className="px-3 py-3 text-sm text-slate-500">กำลังค้นหา…</p> : items.length ? items.map((item, index) => <button id={`${listId}-${index}`} key={item.id} type="button" role="option" aria-selected={index === activeIndex} className={cn("flex min-h-12 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm", index === activeIndex ? "bg-blue-50 text-blue-900" : "hover:bg-slate-50")} onMouseDown={(event) => event.preventDefault()} onMouseEnter={() => setActiveIndex(index)} onClick={() => commit(item)}><span className="min-w-0"><strong className="block truncate">{item.code} — {item.name}</strong><span className="block truncate text-xs text-slate-500">{item.location} · {item.structureLevel}</span></span>{index === activeIndex && <Check className="size-4 shrink-0 text-blue-700" />}</button>) : <p className="px-3 py-3 text-sm text-slate-500">ไม่พบ Asset ที่ขึ้นต้นด้วยคำค้นหานี้</p>}</div>}
    <p className="mt-1 text-xs text-slate-500" aria-live="polite">{selected ? `${selected.location} · ${selected.status}` : "ค้นหาจาก Code, Name หรือ Location; แสดงสูงสุด 20 รายการ"}</p>
  </div>;
}
