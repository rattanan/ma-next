"use client";
import { useCallback, useEffect, useState } from "react";

export function usePurchaseList<T>(kind: "requests" | "orders", search: string, status: string) {
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  const query = new URLSearchParams({ q: search, ...(status ? { status } : {}), page: String(page), pageSize: "25" }).toString();
  const key = `${kind}?${query}:${revision}`;
  const [result, setResult] = useState<{ key: string; rows: T[]; total: number; pages: number; error: string }>({ key: "", rows: [], total: 0, pages: 1, error: "" });
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/purchase-${kind}?${query}`, { signal: controller.signal });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "โหลดเอกสารไม่สำเร็จ");
        if (!controller.signal.aborted) setResult({ key, rows: body[kind], total: body.total, pages: body.pages, error: "" });
      } catch (cause) {
        if (!controller.signal.aborted) setResult({ key, rows: [], total: 0, pages: 1, error: cause instanceof Error ? cause.message : "โหลดเอกสารไม่สำเร็จ" });
      }
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [kind, query, key]);
  return { ...result, page, setPage, reload, loading: result.key !== key };
}
