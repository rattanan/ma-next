"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { BarChart3, BookOpen, Bot, CircleAlert, FileQuestion, FormInput, Lightbulb, Send, Sparkles, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getHelpArticleForRoute, type HelpArticle } from "@/lib/help/articles";
import { findConcerns, findInsights, summarizeSnapshot, type PageSnapshot } from "@/lib/assistant/page-analysis";
import { cn } from "@/lib/utils";

type Message = { id: string; role: "assistant" | "user"; text: string };
type QuickAction = "guide" | "fields" | "summary" | "concerns" | "insights" | "workflow";
const statusWords = ["DRAFT", "SUBMITTED", "UNDER REVIEW", "RETURNED", "APPROVED", "OPEN", "BACKLOG", "ASSIGNED", "IN PROGRESS", "WAITING", "COMPLETED", "VERIFIED", "CLOSED", "CANCELLED", "REJECTED", "REORDER", "EXCESS", "ACTIVE", "INACTIVE", "ร่าง", "รออนุมัติ", "อนุมัติ", "คืนเรื่อง", "กำลังดำเนินการ", "เสร็จสิ้น", "ปิดงาน", "ยกเลิก"];

function welcome(article?: HelpArticle) {
  return article ? `สวัสดีครับ ผมเป็นผู้ช่วยประจำหน้า “${article.title}”\nถามวิธีใช้งาน วิธีกรอกข้อมูล หรือให้ช่วยวิเคราะห์สิ่งที่กำลังแสดงได้เลย` : "สวัสดีครับ ผมช่วยอธิบายวิธีใช้ สรุปข้อมูล และชี้จุดที่ควรตรวจสอบจากหน้าปัจจุบันได้";
}

function capturePage(): PageSnapshot {
  const root = document.querySelector<HTMLElement>("#main-content") ?? document.body;
  const text = (root.innerText || "").replace(/\s+/g, " ").trim().slice(0, 30000);
  const headings = Array.from(root.querySelectorAll<HTMLElement>("h1, h2")).map((node) => node.innerText.trim()).filter(Boolean).slice(0, 12);
  const rowCount = Array.from(root.querySelectorAll("table tbody tr, [role='row']")).filter((row) => row.querySelector("td, [role='cell'], [role='gridcell']")).length;
  const fields = Array.from(root.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input:not([type='hidden']), select, textarea")).filter((field) => field.offsetParent !== null).map((field) => {
    const explicit = field.id ? root.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(field.id)}"]`)?.innerText : "";
    const wrapping = field.closest("label")?.innerText;
    return { label: (explicit || wrapping || field.getAttribute("aria-label") || field.name || "ช่องข้อมูล").replace(/\s+/g, " ").trim(), required: field.required || field.getAttribute("aria-required") === "true", value: field.value };
  }).slice(0, 30);
  const statusCounts: Record<string, number> = {};
  const candidates = Array.from(root.querySelectorAll<HTMLElement>("[class*='badge'], [data-status], td, [role='cell']")).map((node) => node.innerText.trim().replace(/_/g, " ").toLocaleUpperCase("th"));
  for (const candidate of candidates) for (const status of statusWords) if (candidate === status.toLocaleUpperCase("th")) statusCounts[status] = (statusCounts[status] ?? 0) + 1;
  return { title: headings[0] || document.title.split("·")[0].trim(), headings, text, rowCount, fields, statusCounts };
}

function fieldAnswer(snapshot: PageSnapshot, article?: HelpArticle) {
  if (snapshot.fields.length) {
    const required = snapshot.fields.filter((field) => field.required);
    return `ช่องที่แสดงอยู่มี ${snapshot.fields.length} ช่อง${required.length ? ` และเป็นช่องบังคับ ${required.length} ช่อง ได้แก่ ${required.slice(0, 8).map((field) => field.label).join(", ")}` : ""}\nกรอกข้อมูลตามข้อเท็จจริง ตรวจรหัส/วันที่/จำนวนให้ถูกต้อง และทบทวนก่อนบันทึก${article?.tips[0] ? `\nข้อควรรู้: ${article.tips[0]}` : ""}`;
  }
  return article ? `หน้านี้ยังไม่แสดงแบบฟอร์ม กรุณากดสร้างหรือแก้ไขรายการก่อน โดยลำดับทั่วไปคือ:\n• ${article.steps.join("\n• ")}` : "ยังไม่พบช่องกรอกที่มองเห็นบนหน้าปัจจุบัน กรุณาเปิดโหมดสร้างหรือแก้ไขรายการแล้วถามอีกครั้ง";
}

function answerQuestion(question: string, article: HelpArticle | undefined, snapshot: PageSnapshot) {
  const q = question.toLocaleLowerCase("th");
  if (/สรุป|summary/.test(q)) return summarizeSnapshot(snapshot);
  if (/น่าสงสัย|ผิดปกติ|ตรวจสอบ|เสี่ยง|concern|anomal/.test(q)) return findConcerns(snapshot);
  if (/insight|แนวโน้ม|วิเคราะห์/.test(q)) return findInsights(snapshot);
  if (/กรอก|key|field|ช่อง|บันทึก/.test(q)) return fieldAnswer(snapshot, article);
  if (/ขั้นตอน|วิธีใช้|ใช้งาน|ทำอย่างไร|how/.test(q) && article) return `วิธีใช้งานหน้า ${article.title}:\n${article.steps.map((step, index) => `${index + 1}. ${step}`).join("\n")}`;
  if (/ต่อไป|เชื่อม|workflow|หน้าไหน/.test(q) && article) return `Workflow ที่เชื่อมกับหน้านี้:\n• ${article.connections.map((item) => `${item.label}: ${item.relation}`).join("\n• ")}`;
  const term = article?.meanings.find((item) => q.includes(item.term.toLocaleLowerCase("th")));
  if (term) return `${term.term} หมายถึง ${term.description}`;
  if (article) return `${article.purpose}\n\nสิ่งที่ควรจำ: ${article.tips.join(" และ ")}\nคุณสามารถถามต่อเรื่องขั้นตอน วิธีกรอก สถานะ หรือ Workflow ได้`;
  return "ผมตอบได้จากบริบทที่กำลังแสดง ลองถามว่า “สรุปหน้านี้”, “มีจุดไหนน่าสงสัย”, “กรอกข้อมูลอย่างไร” หรือ “ควรทำอะไรต่อ”";
}

const actionConfig: { id: QuickAction; label: string; icon: typeof BookOpen }[] = [
  { id: "guide", label: "วิธีใช้หน้านี้", icon: BookOpen }, { id: "fields", label: "วิธีกรอกข้อมูล", icon: FormInput },
  { id: "summary", label: "สรุปหน้านี้", icon: FileQuestion }, { id: "concerns", label: "จุดที่ควรตรวจสอบ", icon: CircleAlert },
  { id: "insights", label: "หา Insight", icon: BarChart3 }, { id: "workflow", label: "ควรทำอะไรต่อ", icon: Lightbulb },
];

export default function ContextualChatbot() {
  const pathname = usePathname();
  const article = useMemo(() => getHelpArticleForRoute(pathname), [pathname]);
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([{ id: "welcome", role: "assistant", text: welcome(article) }]);
  const endRef = useRef<HTMLDivElement>(null);
  const messageSequence = useRef(0);
  useEffect(() => { if (open) endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, open]);

  function addExchange(userText: string, response: string) {
    const stamp = String(++messageSequence.current);
    setMessages((current) => [...current, { id: `u-${stamp}`, role: "user", text: userText }, { id: `a-${stamp}`, role: "assistant", text: response }]);
  }
  function runAction(action: QuickAction) {
    const snapshot = capturePage();
    const responses: Record<QuickAction, string> = {
      guide: article ? `วิธีใช้งานหน้า ${article.title}:\n${article.steps.map((step, index) => `${index + 1}. ${step}`).join("\n")}` : answerQuestion("วิธีใช้", article, snapshot),
      fields: fieldAnswer(snapshot, article), summary: summarizeSnapshot(snapshot), concerns: findConcerns(snapshot), insights: findInsights(snapshot),
      workflow: article ? `Workflow ที่เชื่อมกับหน้านี้:\n• ${article.connections.map((item) => `${item.label}: ${item.relation}`).join("\n• ")}` : answerQuestion("ควรทำอะไรต่อ", article, snapshot),
    };
    addExchange(actionConfig.find((item) => item.id === action)?.label ?? action, responses[action]);
  }
  function submit(event: FormEvent) {
    event.preventDefault(); const value = question.trim(); if (!value) return;
    addExchange(value, answerQuestion(value, article, capturePage())); setQuestion("");
  }

  return <div className="fixed bottom-4 right-4 z-40 sm:bottom-6 sm:right-6">
    {open && <section role="dialog" aria-label="ผู้ช่วยประจำหน้า" className="mb-3 flex h-[min(42rem,calc(100dvh-7rem))] w-[min(25rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-blue-950/20">
      <header className="flex items-start gap-3 bg-gradient-to-r from-[#0b2a4a] to-[#104f9f] p-4 text-white"><span className="relative grid size-10 shrink-0 place-items-center rounded-xl bg-cyan-300 text-blue-950"><Bot className="size-5" /><span className="absolute -right-1 -top-1 size-3 rounded-full border-2 border-blue-950 bg-emerald-400" /></span><div className="min-w-0 flex-1"><h2 className="font-bold">ผู้ช่วยประจำหน้า</h2><p className="truncate text-xs text-blue-100">{article?.title ?? "MA Next"} · วิเคราะห์ข้อมูลบนหน้าจอนี้</p></div><button type="button" onClick={() => setOpen(false)} className="grid size-9 place-items-center rounded-lg text-blue-100 hover:bg-white/10 hover:text-white" aria-label="ปิดผู้ช่วย"><X className="size-4" /></button></header>
      <div className="border-b bg-slate-50 px-3 py-3"><div className="flex gap-2 overflow-x-auto pb-1">{actionConfig.map((action) => { const Icon = action.icon; return <button key={action.id} type="button" onClick={() => runAction(action.id)} className="flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:border-blue-300 hover:bg-blue-50"><Icon className="size-3.5 text-blue-700" />{action.label}</button>; })}</div></div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-slate-50/70 p-4" aria-live="polite">{messages.map((message) => <div key={message.id} className={cn("flex gap-2", message.role === "user" && "justify-end")}>
        {message.role === "assistant" && <span className="grid size-7 shrink-0 place-items-center rounded-full bg-blue-100 text-blue-800"><Sparkles className="size-3.5" /></span>}
        <div className={cn("max-w-[85%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-sm leading-6", message.role === "assistant" ? "rounded-tl-sm border border-slate-200 bg-white text-slate-700" : "rounded-tr-sm bg-blue-700 text-white")}>{message.text}</div>
        {message.role === "user" && <span className="grid size-7 shrink-0 place-items-center rounded-full bg-slate-200 text-slate-700"><UserRound className="size-3.5" /></span>}
      </div>)}<div ref={endRef} /></div>
      {article && <div className="border-t border-slate-100 bg-white px-4 py-2 text-right"><Link href={`/help/${article.slug}`} className="inline-flex min-h-9 items-center gap-1 text-xs font-bold text-blue-700 hover:text-blue-900"><BookOpen className="size-3.5" />เปิดคู่มือฉบับเต็ม</Link></div>}
      <form onSubmit={submit} className="flex items-end gap-2 border-t bg-white p-3"><Textarea value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} rows={1} placeholder="ถามเกี่ยวกับหน้านี้..." className="min-h-11 max-h-28 resize-none" aria-label="คำถามถึงผู้ช่วย" /><Button type="submit" size="icon" className="size-11 shrink-0" disabled={!question.trim()} aria-label="ส่งคำถาม"><Send className="size-4" /></Button></form>
      <p className="border-t bg-slate-50 px-3 py-2 text-center text-[10px] leading-4 text-slate-500">วิเคราะห์จากข้อมูลที่แสดงในเบราว์เซอร์ โปรดตรวจสอบก่อนดำเนินการ</p>
    </section>}
    <button type="button" onClick={() => setOpen((current) => !current)} aria-expanded={open} aria-label={open ? "ปิดผู้ช่วยประจำหน้า" : "เปิดผู้ช่วยประจำหน้า"} className={cn("group ml-auto flex min-h-14 items-center gap-3 rounded-full bg-[#0b2a4a] p-2 text-white shadow-xl shadow-blue-950/25 ring-1 ring-white/20 transition hover:-translate-y-0.5 hover:bg-blue-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-300 motion-reduce:transform-none", open && "bg-blue-800")}><span className="relative grid size-10 place-items-center rounded-full bg-cyan-300 text-blue-950"><Bot className="size-5" />{!open && <span className="absolute right-0 top-0 size-3 rounded-full border-2 border-[#0b2a4a] bg-emerald-400" />}</span><span className="hidden pr-3 text-left sm:block"><strong className="block text-sm">ถามผู้ช่วย</strong><span className="block text-[10px] text-blue-200">เกี่ยวกับหน้านี้</span></span></button>
  </div>;
}
