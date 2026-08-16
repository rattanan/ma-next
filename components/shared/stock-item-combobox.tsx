"use client";

import { Check, Loader2, Search, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type StockItemOption = { id: string; code: string; name: string; unit: string };

type Props = {
  id?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string, option: StockItemOption | null) => void;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
};

const optionLabel = (option: StockItemOption) => `${option.code} — ${option.name}`;

export function StockItemCombobox({ id, name, value, defaultValue = "", onValueChange, required, disabled, placeholder = "พิมพ์รหัสหรือชื่อ Item อย่างน้อย 2 ตัว", className }: Props) {
  const generatedId = useId();
  const inputId = id ?? `stock-item-search-${generatedId}`;
  const listId = `${inputId}-listbox`;
  const controlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue);
  const selectedId = controlled ? value : internalValue;
  const [selected, setSelected] = useState<StockItemOption | null>(null);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<StockItemOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeSelected = selected?.id === selectedId ? selected : null;
  const displayedQuery = selected && !activeSelected ? "" : query;

  function commit(next: StockItemOption | null) {
    if (!controlled) setInternalValue(next?.id ?? "");
    setSelected(next);
    setQuery(next ? optionLabel(next) : "");
    setItems([]);
    setOpen(false);
    setActiveIndex(-1);
    inputRef.current?.setCustomValidity("");
    onValueChange?.(next?.id ?? "", next);
  }

  useEffect(() => {
    const form = rootRef.current?.closest("form");
    if (!form) return;
    const reset = () => {
      if (!controlled) setInternalValue(defaultValue);
      setSelected(null);
      setQuery("");
      setItems([]);
      setOpen(false);
      setActiveIndex(-1);
      inputRef.current?.setCustomValidity("");
      onValueChange?.(defaultValue, null);
    };
    form.addEventListener("reset", reset);
    return () => form.removeEventListener("reset", reset);
  }, [controlled, defaultValue, onValueChange]);

  useEffect(() => {
    const term = displayedQuery.trim();
    if (!open || activeSelected || term.length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      fetch(`/api/stock-items/search?${new URLSearchParams({ q: term, limit: "20" })}`, { signal: controller.signal })
        .then((response) => response.ok ? response.json() : Promise.reject(new Error("Stock item search failed")))
        .then((body: { items: StockItemOption[] }) => {
          setItems(body.items);
          setActiveIndex(body.items.length ? 0 : -1);
        })
        .catch((error) => { if (error.name !== "AbortError") setItems([]); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [activeSelected, displayedQuery, open]);

  function change(text: string) {
    if (selected) {
      if (!controlled) setInternalValue("");
      onValueChange?.("", null);
      setSelected(null);
    }
    inputRef.current?.setCustomValidity(text ? "กรุณาเลือก Item จากผลการค้นหา" : "");
    setQuery(text);
    setItems([]);
    setLoading(false);
    setActiveIndex(-1);
    setOpen(true);
  }

  function keyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); setActiveIndex((index) => Math.min(items.length - 1, index + 1)); }
    else if (event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((index) => Math.max(0, index - 1)); }
    else if (event.key === "Enter" && open && activeIndex >= 0 && items[activeIndex]) { event.preventDefault(); commit(items[activeIndex]); }
    else if (event.key === "Escape") setOpen(false);
  }

  return <div ref={rootRef} className={cn("relative min-w-0", className)} onBlur={() => { blurTimer.current = setTimeout(() => setOpen(false), 100); }} onFocus={() => { if (blurTimer.current) clearTimeout(blurTimer.current); }}>
    {name && <input type="hidden" name={name} value={selectedId} />}
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-3 size-4 text-slate-400" />
      <Input ref={inputRef} id={inputId} role="combobox" autoComplete="off" value={displayedQuery} disabled={disabled} required={required} aria-expanded={open} aria-controls={listId} aria-autocomplete="list" aria-busy={loading} aria-activedescendant={activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined} className="min-h-10 min-w-0 bg-white pl-9 pr-10" placeholder={placeholder} onFocus={() => setOpen(true)} onChange={(event) => change(event.target.value)} onKeyDown={keyDown} />
      {loading ? <Loader2 className="absolute right-3 top-3 size-4 animate-spin text-slate-500" /> : activeSelected && <Button type="button" variant="ghost" size="icon" disabled={disabled} aria-label="ล้าง Item ที่เลือก" className="absolute right-1 top-0.5 size-9" onClick={() => commit(null)}><X className="size-4" /></Button>}
    </div>
    {open && !activeSelected && <div id={listId} role="listbox" className="absolute z-50 mt-1 max-h-72 w-full min-w-64 overflow-auto rounded-xl border bg-white p-1 shadow-xl">
      {displayedQuery.trim().length < 2 ? <p className="px-3 py-3 text-sm text-slate-500">พิมพ์อย่างน้อย 2 ตัวอักษรเพื่อค้นหา Item</p> : loading ? <p className="px-3 py-3 text-sm text-slate-500">กำลังค้นหา…</p> : items.length ? items.map((item, index) => <button id={`${listId}-${index}`} key={item.id} type="button" role="option" aria-selected={index === activeIndex} className={cn("flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm", index === activeIndex ? "bg-blue-50 text-blue-900" : "hover:bg-slate-50")} onMouseDown={(event) => event.preventDefault()} onMouseEnter={() => setActiveIndex(index)} onClick={() => commit(item)}><span className="min-w-0 truncate"><strong>{item.code}</strong> — {item.name}</span><span className="shrink-0 text-xs text-slate-500">{item.unit}</span>{index === activeIndex && <Check className="size-4 shrink-0 text-blue-700" />}</button>) : <p className="px-3 py-3 text-sm text-slate-500">ไม่พบ Item ที่ตรงกับคำค้นหา</p>}
    </div>}
  </div>;
}
