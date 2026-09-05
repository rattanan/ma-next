"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, BookOpen, Boxes, Building2, ClipboardList, Search, ShieldCheck, UserRound, Wrench, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageContainer, PageHeader } from "@/components/shared/page-header";
import { helpArticles, helpCategories, type HelpCategory } from "@/lib/help/articles";
import { cn } from "@/lib/utils";

const categoryIcons = { "เริ่มต้นใช้งาน": BookOpen, "งานซ่อม": Wrench, "จัดซื้อ": ClipboardList, "คลังและอะไหล่": Boxes, "ข้อมูลหลัก": Building2, "ดูแลระบบ": ShieldCheck, "บัญชีผู้ใช้": UserRound } satisfies Record<HelpCategory, typeof BookOpen>;

export default function HelpCenter() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<HelpCategory | "ทั้งหมด">("ทั้งหมด");
  const normalized = query.trim().toLocaleLowerCase("th");
  const results = useMemo(() => helpArticles.filter((article) => {
    if (category !== "ทั้งหมด" && article.category !== category) return false;
    if (!normalized) return true;
    return [article.title, article.summary, article.purpose, article.audience, article.route, ...article.keywords, ...article.meanings.flatMap((item) => [item.term, item.description])].join(" ").toLocaleLowerCase("th").includes(normalized);
  }), [category, normalized]);
  const groups = helpCategories.map((name) => ({ name, articles: results.filter((article) => article.category === name) })).filter((group) => group.articles.length);

  return <PageContainer className="pb-16">
    <PageHeader eyebrow="ศูนย์ช่วยเหลือ MA Next" title="ค้นหาคำตอบและเข้าใจ Workflow ของระบบ" description="อ่านวิธีใช้งาน ความหมายของข้อมูล และความเชื่อมโยงระหว่างแต่ละหน้า ตั้งแต่รับแจ้งซ่อมจนปิดงาน และตั้งแต่ขอซื้อจนรับเข้าคลัง" icon={<BookOpen className="size-5" />} metadata={<span>บทความ {helpArticles.length} เรื่อง · อ้างอิงตามหน้าจอและกระบวนการของระบบ</span>} />
    <section className="overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-br from-[#0b2a4a] via-[#104f9f] to-[#1464d2] p-5 text-white shadow-[var(--shadow-card)] md:p-8" aria-labelledby="help-search-title">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-end"><div><p className="text-xs font-bold tracking-[.14em] text-cyan-200">HELP CENTER</p><h2 id="help-search-title" className="mt-2 text-2xl font-bold md:text-3xl">วันนี้คุณต้องการทำอะไร?</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100">ค้นหาด้วยชื่อหน้า งาน สถานะ หรือคำศัพท์ เช่น “เบิกอะไหล่”, “คืนเรื่อง”, “SLA”</p></div><label className="relative block"><span className="sr-only">ค้นหาบทความ</span><Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-400" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาบทความ..." className="h-12 border-white/20 bg-white pl-12 pr-11 text-slate-950 shadow-lg placeholder:text-slate-400" />{query && <button type="button" onClick={() => setQuery("")} className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-md text-slate-500 hover:bg-slate-100" aria-label="ล้างคำค้น"><X className="size-4" /></button>}</label></div>
    </section>
    <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="หมวดบทความ">{(["ทั้งหมด", ...helpCategories] as const).map((item) => <button key={item} type="button" onClick={() => setCategory(item)} aria-pressed={category === item} className={cn("min-h-11 shrink-0 rounded-full border px-4 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600", category === item ? "border-blue-700 bg-blue-700 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50")}>{item}</button>)}</nav>
    <div aria-live="polite" className="space-y-10"><p className="text-sm text-slate-500">พบ {results.length} บทความ{normalized ? ` สำหรับ “${query.trim()}”` : ""}</p>{groups.map((group) => { const Icon = categoryIcons[group.name]; return <section key={group.name} aria-labelledby={`help-${group.name}`}><div className="mb-4 flex items-center gap-3"><span className="grid size-9 place-items-center rounded-lg bg-blue-50 text-blue-800"><Icon className="size-4" /></span><div><h2 id={`help-${group.name}`} className="text-lg font-bold text-slate-950">{group.name}</h2><p className="text-xs text-slate-500">{group.articles.length} บทความ</p></div></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{group.articles.map((article) => <Card key={article.slug} className="group relative overflow-hidden border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md motion-reduce:transform-none"><CardContent className="flex h-full flex-col p-5"><div className="flex items-start justify-between gap-3"><Badge variant="secondary" className="rounded-md bg-slate-100 text-slate-600">{article.route}</Badge><ArrowRight className="size-4 shrink-0 text-slate-300 transition group-hover:translate-x-1 group-hover:text-blue-700" /></div><h3 className="mt-4 text-base font-bold text-slate-950 group-hover:text-blue-800"><Link href={`/help/${article.slug}`} className="after:absolute after:inset-0 focus-visible:outline-none">{article.title}</Link></h3><p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{article.summary}</p><p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">สำหรับ {article.audience}</p></CardContent></Card>)}</div></section>; })}{!results.length && <section className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center"><Search className="mx-auto size-8 text-slate-300" /><h2 className="mt-4 text-lg font-bold">ยังไม่พบบทความที่ตรงกัน</h2><p className="mt-2 text-sm text-slate-600">ลองใช้ชื่อเมนูหรือคำที่สั้นลง</p><Button variant="outline" className="mt-5" onClick={() => { setQuery(""); setCategory("ทั้งหมด"); }}>ล้างตัวกรอง</Button></section>}</div>
  </PageContainer>;
}
