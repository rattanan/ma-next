"use client";

import { Check, Loader2, Search, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type AssetTypeOption = { id: string; code: string; name: string };

export function AssetTypeFilter({ value, onValueChange }: { value: string; onValueChange: (value: string) => void }) {
  const generatedId = useId(); const inputId = `asset-type-filter-${generatedId}`; const listId = `${inputId}-listbox`;
  const [selected, setSelected] = useState<AssetTypeOption | null>(null); const [query, setQuery] = useState(""); const [items, setItems] = useState<AssetTypeOption[]>([]);
  const [open, setOpen] = useState(false); const [loading, setLoading] = useState(false); const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null); const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeSelected = selected?.id === value ? selected : null;
  const displayedQuery = selected && !activeSelected ? "" : query;

  function commit(option: AssetTypeOption | null) {
    setSelected(option); setQuery(option ? `${option.code} — ${option.name}` : ""); setItems([]); setOpen(false); setActiveIndex(-1); onValueChange(option?.id ?? "");
  }

  useEffect(() => {
    if (!value) return;
    if (selected?.id === value) return;
    const controller = new AbortController();
    fetch(`/api/assets/types/search?${new URLSearchParams({ selectedId: value, limit: "1" })}`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Asset type lookup failed")))
      .then((body: { items: AssetTypeOption[] }) => { const option = body.items[0] ?? null; setSelected(option); setQuery(option ? `${option.code} — ${option.name}` : ""); })
      .catch((error) => { if (error.name !== "AbortError") setSelected(null); });
    return () => controller.abort();
  }, [selected, value]);

  useEffect(() => {
    const term = displayedQuery.trim(); if (!open || activeSelected || term.length < 2) return;
    const controller = new AbortController(); const timer = window.setTimeout(() => {
      setLoading(true);
      fetch(`/api/assets/types/search?${new URLSearchParams({ q: term, limit: "20" })}`, { signal: controller.signal })
        .then((response) => response.ok ? response.json() : Promise.reject(new Error("Asset type search failed")))
        .then((body: { items: AssetTypeOption[] }) => { setItems(body.items); setActiveIndex(body.items.length ? 0 : -1); })
        .catch((error) => { if (error.name !== "AbortError") setItems([]); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [activeSelected, displayedQuery, open]);

  function change(text: string) { if (selected) { setSelected(null); onValueChange(""); } setQuery(text); setItems([]); setLoading(false); setActiveIndex(-1); setOpen(true); }
  function keyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); setActiveIndex((index) => Math.min(items.length - 1, index + 1)); }
    else if (event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((index) => Math.max(0, index - 1)); }
    else if (event.key === "Enter" && open && activeIndex >= 0 && items[activeIndex]) { event.preventDefault(); commit(items[activeIndex]); }
    else if (event.key === "Escape") setOpen(false);
  }

  return <div className="relative" onBlur={() => { blurTimer.current = setTimeout(() => setOpen(false), 100); }} onFocus={() => { if (blurTimer.current) clearTimeout(blurTimer.current); }}>
    <Search className="pointer-events-none absolute left-3 top-3.5 z-10 size-4 text-slate-400" />
    <Input ref={inputRef} id={inputId} role="combobox" autoComplete="off" value={displayedQuery} aria-label="Filter by asset type" aria-expanded={open} aria-controls={listId} aria-autocomplete="list" aria-busy={loading} aria-activedescendant={activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined} className="min-h-11 pl-9 pr-10" placeholder="ค้นหา Type อย่างน้อย 2 ตัว" onFocus={() => setOpen(true)} onChange={(event) => change(event.target.value)} onKeyDown={keyDown} />
    {loading ? <Loader2 className="absolute right-3 top-3.5 size-4 animate-spin text-slate-500" /> : (activeSelected || displayedQuery) && <Button type="button" variant="ghost" size="icon" aria-label="ล้างตัวกรอง Type" className="absolute right-1 top-1 size-9" onClick={() => commit(null)}><X className="size-4" /></Button>}
    {open && !activeSelected && <div id={listId} role="listbox" className="absolute z-50 mt-1 max-h-72 w-full min-w-64 overflow-auto rounded-xl border bg-white p-1 shadow-xl">{displayedQuery.trim().length < 2 ? <p className="px-3 py-3 text-sm text-slate-500">พิมพ์อย่างน้อย 2 ตัวอักษรเพื่อค้นหา Type</p> : loading ? <p className="px-3 py-3 text-sm text-slate-500">กำลังค้นหา…</p> : items.length ? items.map((item, index) => <button id={`${listId}-${index}`} key={item.id} type="button" role="option" aria-selected={index === activeIndex} className={cn("flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm", index === activeIndex ? "bg-blue-50 text-blue-900" : "hover:bg-slate-50")} onMouseDown={(event) => event.preventDefault()} onMouseEnter={() => setActiveIndex(index)} onClick={() => commit(item)}><span className="min-w-0 truncate"><strong>{item.code}</strong> — {item.name}</span>{index === activeIndex && <Check className="size-4 shrink-0 text-blue-700" />}</button>) : <p className="px-3 py-3 text-sm text-slate-500">ไม่พบ Type ที่ขึ้นต้นด้วยคำค้นหานี้</p>}</div>}
  </div>;
}
