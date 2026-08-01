import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Bot,
  BrainCircuit,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  Gauge,
  History,
  Link2,
  MapPin,
  MessageSquareText,
  PackageSearch,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Users,
  Wrench,
} from "lucide-react";
import { MaLogo } from "@/components/brand/ma-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentSession } from "@/lib/auth/session";

const copilotCapabilities = [
  {
    icon: MessageSquareText,
    title: "เปลี่ยนข้อความเป็นใบงานอัตโนมัติ",
    description: "วิเคราะห์อุปกรณ์ สถานที่ อาการเสีย หมวดงาน และความเร่งด่วนจากข้อความหรือเสียงของผู้แจ้งงาน",
  },
  {
    icon: Gauge,
    title: "แนะนำ Priority ทีมช่าง และ SLA",
    description: "ประเมินผลกระทบ ประวัติการซ่อม และบริบทของทรัพย์สิน ก่อนส่งคำแนะนำให้ผู้ควบคุมงานยืนยัน",
  },
  {
    icon: History,
    title: "ค้นหาวิธีแก้จากข้อมูลจริง",
    description: "ช่วยช่างค้นประวัติซ่อม งานที่คล้ายกัน อะไหล่ คู่มือ และ Knowledge Base จากหน้า Work Order",
  },
  {
    icon: FileCheck2,
    title: "สรุปผลการซ่อมอัตโนมัติ",
    description: "จัดรูปแบบบันทึกหน้างานให้เป็นรายงานที่มีสาเหตุ วิธีแก้ อะไหล่ Downtime ผลทดสอบ และข้อเสนอแนะ",
  },
  {
    icon: ClipboardCheck,
    title: "ตรวจความครบถ้วนก่อนปิดงาน",
    description: "ตรวจสอบข้อมูลสำคัญ รูปก่อน–หลัง และผลการทดสอบ พร้อมเตือนงานซ้ำที่ควรทำ Root Cause Analysis",
  },
];

const coreCapabilities = [
  { icon: Wrench, title: "Work Order Management", description: "รับแจ้ง มอบหมาย ติดตาม Priority สถานะ และ SLA แบบเรียลไทม์" },
  { icon: Clock3, title: "Preventive Maintenance", description: "วางแผน PM ตามเวลา ชั่วโมงใช้งาน ระยะทาง หรือเงื่อนไขอุปกรณ์" },
  { icon: Building2, title: "Asset Management", description: "จัดการทะเบียน ตำแหน่ง Warranty ประวัติซ่อม และต้นทุนตลอดอายุใช้งาน" },
  { icon: Smartphone, title: "Technician Mobile Workspace", description: "รับงาน บันทึกเวลา ถ่ายภาพ ใช้อะไหล่ และส่งมอบงานจากหน้างาน" },
  { icon: PackageSearch, title: "Spare Parts & Inventory", description: "ควบคุมสต็อก การเบิกจ่าย จุดสั่งซื้อ และการใช้อะไหล่ต่อ Work Order" },
  { icon: Gauge, title: "SLA & Escalation", description: "ติดตาม Response และ Resolution Time พร้อมแจ้งเตือนก่อนเกินกำหนด" },
  { icon: BarChart3, title: "Dashboard & Analytics", description: "ติดตามงานค้าง ค่าใช้จ่าย ทีมช่าง SLA และแนวโน้มปัญหาในภาพเดียว" },
  { icon: Users, title: "Multi-organization Control", description: "รองรับหลายองค์กร หน่วยงาน พื้นที่ และลูกค้าภายใต้สิทธิ์ที่ควบคุมได้" },
];

const intelligenceSignals = [
  "ทรัพย์สินที่เสียบ่อยและงานซ่อมซ้ำ",
  "พื้นที่ที่มีปัญหาสูงผิดปกติ",
  "Vendor ที่ไม่สามารถทำงานตาม SLA",
  "อะไหล่ที่ถูกเปลี่ยนบ่อย",
  "ค่าใช้จ่ายซ่อมที่เพิ่มขึ้นต่อเนื่อง",
  "อุปกรณ์ที่ควรซ่อมหรือวางแผนเปลี่ยน",
];

const integrations = ["ERP", "Inventory", "HR", "Identity Provider", "IoT Platform", "GIS", "ระบบจัดซื้อ", "Notification Gateway"];

const industries = ["อาคารและสถานที่", "ไฟฟ้าและเครื่องกล", "เครื่องปรับอากาศ", "ระบบเครือข่ายและ IT", "CCTV", "ถนนและไฟส่องสว่าง", "เครื่องจักรและโรงงาน", "ยานพาหนะ", "อุปกรณ์ทางการแพทย์", "สินทรัพย์เมือง"];

export default async function LandingPage() {
  const session = await getCurrentSession();
  const workspaceHref = session ? "/maintenance" : "/login";

  return (
    <main className="min-h-screen overflow-hidden bg-white text-slate-950">
      <nav className="relative z-30 border-b border-slate-200 bg-white/95 backdrop-blur" aria-label="เมนูหลัก">
        <div className="mx-auto flex min-h-20 max-w-[90rem] items-center justify-between gap-5 px-5 md:px-8">
          <Link href="/" aria-label="หน้าแรก MA Next"><MaLogo size="md" /></Link>
          <div className="hidden items-center gap-7 text-sm font-semibold text-slate-600 lg:flex">
            <a href="#copilot" className="transition hover:text-blue-700">AI Copilot</a>
            <a href="#capabilities" className="transition hover:text-blue-700">ความสามารถ</a>
            <a href="#mobile" className="transition hover:text-blue-700">Web & Mobile</a>
            <a href="#security" className="transition hover:text-blue-700">ความปลอดภัย</a>
          </div>
          <Button asChild variant="outline" className="border-blue-200 text-blue-900 hover:border-blue-300">
            <Link href={workspaceHref}>{session ? "เข้าสู่พื้นที่ทำงาน" : "เข้าสู่ระบบ"}<ArrowRight className="size-4" /></Link>
          </Button>
        </div>
      </nav>

      <section className="relative isolate min-h-[44rem] overflow-hidden border-b border-slate-200 bg-white">
        <figure className="absolute inset-0">
          <Image src="/brand/ma-maintenance-hero.png" alt="วิศวกรซ่อมบำรุงใช้แท็บเล็ตตรวจสอบโรงงานและข้อมูลการบำรุงรักษา" fill preload sizes="100vw" className="object-cover object-[70%_center]" />
          <div className="absolute inset-0 bg-gradient-to-r from-white via-white/95 via-[43%] to-white/5 to-[76%]" />
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-white/90 to-transparent" />
        </figure>
        <div className="relative mx-auto flex min-h-[44rem] max-w-[90rem] items-center px-5 py-16 md:px-8 lg:py-24">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/85 px-3.5 py-2 text-xs font-bold text-blue-800 shadow-sm backdrop-blur">
              <Sparkles className="size-4" />AI-Powered Maintenance Copilot
            </div>
            <p className="mt-7 text-sm font-bold tracking-wide text-blue-700">ระบบบริหารงานซ่อมบำรุงอัจฉริยะ</p>
            <h1 className="mt-3 max-w-2xl text-4xl font-bold leading-[1.12] tracking-[-.035em] text-[#0b2a4a] sm:text-5xl lg:text-6xl">เปลี่ยนทุกงานซ่อม ให้เป็นการตัดสินใจที่แม่นยำ</h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">บริหารงานแจ้งซ่อม งานบำรุงรักษาเชิงป้องกัน ทรัพย์สิน ทีมช่าง อะไหล่ และ SLA จากระบบเดียว พร้อม AI Copilot ที่ช่วยวิเคราะห์ปัญหา แนะนำแนวทาง และเปลี่ยนข้อมูลหน้างานเป็นข้อมูลเพื่อการตัดสินใจ</p>
            <p className="mt-4 max-w-xl text-sm font-bold leading-6 text-[#0b2a4a]">ลดงานเอกสาร เพิ่มประสิทธิภาพทีมช่าง และป้องกันปัญหาซ้ำก่อนกระทบการให้บริการ</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="shadow-lg shadow-blue-700/20"><Link href={workspaceHref}>{session ? "เปิดระบบ MA-next" : "ดูระบบตัวอย่าง"}<ArrowRight className="size-4" /></Link></Button>
              <Button asChild size="lg" variant="outline" className="border-slate-300 bg-white/80 backdrop-blur"><a href="#copilot">ดูความสามารถ AI Copilot</a></Button>
            </div>
            <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-sm text-slate-700">
              {["Mobile-First", "ควบคุมสิทธิ์ตามบทบาท", "ตรวจสอบย้อนหลังได้"].map((item) => <span key={item} className="flex items-center gap-2"><CheckCircle2 className="size-4 text-emerald-600" />{item}</span>)}
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-[#0b2a4a] text-white">
        <div className="mx-auto grid max-w-[90rem] gap-5 px-5 py-7 sm:grid-cols-2 lg:grid-cols-5 md:px-8">
          {["รับแจ้งปัญหา", "วิเคราะห์และวางแผน", "มอบหมายและปฏิบัติงาน", "ตรวจสอบผล", "ปิดงานและเรียนรู้"].map((step, index) => (
            <div key={step} className="flex items-center gap-3 border-white/10 lg:border-r lg:last:border-0">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-blue-500/20 text-xs font-bold text-cyan-200">{String(index + 1).padStart(2, "0")}</span>
              <span className="text-sm font-semibold text-blue-50">{step}</span>
            </div>
          ))}
        </div>
      </section>

      <section id="copilot" className="bg-slate-50 py-16 md:py-24">
        <div className="mx-auto max-w-[90rem] px-5 md:px-8">
          <div className="grid gap-12 lg:grid-cols-[.85fr_1.15fr] lg:items-start">
            <div className="lg:sticky lg:top-28">
              <span className="grid size-12 place-items-center rounded-2xl bg-blue-700 text-white shadow-lg shadow-blue-700/20"><BrainCircuit className="size-6" /></span>
              <p className="mt-6 text-xs font-bold uppercase tracking-[.16em] text-blue-700">AI-Powered Maintenance Copilot</p>
              <h2 className="mt-3 text-3xl font-bold leading-tight tracking-tight text-[#0b2a4a] md:text-4xl">ผู้ช่วยอัจฉริยะสำหรับทุกขั้นตอนของงานซ่อมบำรุง</h2>
              <p className="mt-5 max-w-xl leading-7 text-slate-600">ทำงานร่วมกับผู้แจ้ง ช่างภาคสนาม ผู้ควบคุมงาน และผู้บริหาร โดยให้มนุษย์ตรวจสอบและยืนยันคำแนะนำในจุดสำคัญเสมอ</p>
              <div className="mt-8 rounded-2xl border border-blue-100 bg-white p-5 shadow-lg shadow-blue-950/5">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-4"><span className="grid size-9 place-items-center rounded-xl bg-blue-50 text-blue-700"><Bot className="size-5" /></span><div><strong className="block text-sm text-[#0b2a4a]">Maintenance Copilot</strong><small className="text-xs text-emerald-700">พร้อมช่วยวิเคราะห์</small></div></div>
                <blockquote className="mt-4 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">“เครื่องปรับอากาศห้อง Server ชั้น 3 ไม่เย็นและมีเสียงดัง”</blockquote>
                <div className="mt-4 flex flex-wrap gap-2">{["HVAC", "Server Room", "เร่งด่วน", "ตรวจสอบ SLA"].map((tag) => <span key={tag} className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">{tag}</span>)}</div>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {copilotCapabilities.map(({ icon: Icon, title, description }, index) => (
                <Card key={title} className={index === copilotCapabilities.length - 1 ? "border-blue-200 shadow-none sm:col-span-2" : "border-slate-200 shadow-none"}>
                  <CardHeader className="p-6">
                    <span className="mb-3 grid size-10 place-items-center rounded-xl bg-blue-50 text-blue-700"><Icon className="size-5" /></span>
                    <CardTitle className="text-base leading-6 text-[#0b2a4a]">{title}</CardTitle>
                    <CardDescription className="leading-6">{description}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-[#071f38] py-16 text-white md:py-24">
        <div className="absolute -right-40 -top-40 size-[32rem] rounded-full border border-cyan-300/10" />
        <div className="absolute -right-10 -top-10 size-[18rem] rounded-full border border-blue-300/10" />
        <div className="relative mx-auto grid max-w-[90rem] gap-12 px-5 lg:grid-cols-[1fr_1fr] lg:items-center md:px-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.16em] text-cyan-300">Maintenance Intelligence</p>
            <h2 className="mt-3 text-3xl font-bold leading-tight tracking-tight md:text-4xl">มองเห็นปัญหาซ้ำ ก่อนกลายเป็นผลกระทบครั้งถัดไป</h2>
            <p className="mt-5 max-w-xl leading-7 text-blue-100/75">MA-next วิเคราะห์ข้อมูลย้อนหลังเพื่อค้นหารูปแบบที่ซ่อนอยู่ และเปลี่ยนงานซ่อมประจำวันให้เป็นข้อมูลเชิงบริหารที่นำไปใช้ได้จริง</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {intelligenceSignals.map((signal) => <div key={signal} className="flex min-h-20 items-center gap-3 rounded-xl border border-white/10 bg-white/[.06] p-4"><CheckCircle2 className="size-5 shrink-0 text-cyan-300" /><span className="text-sm leading-6 text-blue-50">{signal}</span></div>)}
          </div>
        </div>
      </section>

      <section id="capabilities" className="py-16 md:py-24">
        <div className="mx-auto max-w-[90rem] px-5 md:px-8">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[.16em] text-blue-700">Complete maintenance platform</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#0b2a4a] md:text-4xl">บริหารวงจรงานซ่อมบำรุงครบจากระบบเดียว</h2>
            <p className="mt-4 leading-7 text-slate-600">ตั้งแต่รับแจ้ง วางแผน มอบหมาย ติดตาม SLA บันทึกผล จัดการอะไหล่ ไปจนถึงวิเคราะห์ประสิทธิภาพทรัพย์สินและทีมงาน</p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {coreCapabilities.map(({ icon: Icon, title, description }) => (
              <Card key={title} className="group border-slate-200 shadow-none transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg hover:shadow-blue-950/5">
                <CardHeader className="p-6">
                  <span className="mb-3 grid size-11 place-items-center rounded-xl bg-blue-50 text-blue-800 transition group-hover:bg-blue-700 group-hover:text-white"><Icon className="size-5" /></span>
                  <CardTitle className="text-base text-[#0b2a4a]">{title}</CardTitle>
                  <CardDescription className="leading-6">{description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="mobile" className="border-y border-slate-200 bg-slate-50 py-16 md:py-24">
        <div className="mx-auto grid max-w-[90rem] gap-6 px-5 lg:grid-cols-3 md:px-8">
          <Card className="border-slate-200 shadow-none lg:col-span-1">
            <CardContent className="p-7">
              <Smartphone className="size-7 text-blue-700" />
              <h2 className="mt-5 text-2xl font-bold tracking-tight text-[#0b2a4a]">ทำงานได้ทั้ง Web และ Mobile</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">ออกแบบแบบ Mobile-First ให้ผู้แจ้งงาน ช่าง และผู้ควบคุมงานทำงานได้ง่ายจากทุกอุปกรณ์</p>
              <ul className="mt-6 space-y-3 text-sm text-slate-700">{["QR Code สำหรับแจ้งซ่อมและดูทรัพย์สิน", "รูปภาพ เอกสาร และพิกัดสถานที่", "Email, LINE และช่องทางองค์กร"].map((item) => <li key={item} className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />{item}</li>)}</ul>
            </CardContent>
          </Card>
          <Card className="border-slate-200 shadow-none lg:col-span-2">
            <CardContent className="p-7">
              <Link2 className="size-7 text-blue-700" />
              <h2 className="mt-5 text-2xl font-bold tracking-tight text-[#0b2a4a]">เชื่อมต่อกับระบบเดิมขององค์กร</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">รองรับการเชื่อมต่อผ่าน API เพื่อใช้งานร่วมกับระบบเดิม โดยไม่จำเป็นต้องเปลี่ยนทุกระบบพร้อมกัน</p>
              <div className="mt-6 flex flex-wrap gap-2">{integrations.map((item) => <span key={item} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">{item}</span>)}</div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="py-16 md:py-24">
        <div className="mx-auto max-w-[90rem] px-5 md:px-8">
          <div className="grid gap-10 lg:grid-cols-[.7fr_1.3fr] lg:items-start">
            <div><MapPin className="size-7 text-blue-700" /><h2 className="mt-5 text-3xl font-bold tracking-tight text-[#0b2a4a]">รองรับงานบำรุงรักษาหลากหลายประเภท</h2><p className="mt-4 leading-7 text-slate-600">ปรับโครงสร้างข้อมูล กระบวนการ และสิทธิ์ให้เหมาะกับบริบทของแต่ละองค์กร</p></div>
            <div className="flex flex-wrap gap-3">{industries.map((industry) => <span key={industry} className="rounded-full border border-blue-100 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-950">{industry}</span>)}</div>
          </div>
        </div>
      </section>

      <section id="security" className="border-t border-slate-200 bg-[#0b2a4a] py-16 text-white md:py-20">
        <div className="mx-auto grid max-w-[90rem] gap-10 px-5 lg:grid-cols-[1fr_1.2fr] lg:items-center md:px-8">
          <div><ShieldCheck className="size-9 text-cyan-300" /><p className="mt-5 text-xs font-bold uppercase tracking-[.16em] text-cyan-300">Secure by design</p><h2 className="mt-3 text-3xl font-bold tracking-tight">ปลอดภัย ควบคุมได้ และตรวจสอบย้อนหลังได้</h2><p className="mt-4 max-w-xl leading-7 text-blue-100/75">AI ทำงานภายใต้สิทธิ์ของผู้ใช้และนโยบายข้อมูลขององค์กร พร้อมควบคุมแหล่งข้อมูลที่ AI สามารถเข้าถึงได้</p></div>
          <div className="grid gap-3 sm:grid-cols-2">{["Role-Based Access Control", "Single Sign-On", "Audit Log และประวัติการเปลี่ยนแปลง", "การอนุมัติตามลำดับขั้น", "แยกข้อมูลตามองค์กรและหน่วยงาน", "Cloud หรือ Private Infrastructure"].map((item) => <div key={item} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[.06] px-4 py-3 text-sm"><CheckCircle2 className="size-4 shrink-0 text-cyan-300" />{item}</div>)}</div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-gradient-to-br from-blue-700 to-blue-950 py-16 text-white md:py-24">
        <div className="absolute inset-0 opacity-15 [background-image:radial-gradient(circle_at_20%_20%,white_0,transparent_28%),radial-gradient(circle_at_80%_80%,#67e8f9_0,transparent_30%)]" />
        <div className="relative mx-auto max-w-4xl px-5 text-center md:px-8">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/15"><Sparkles className="size-7 text-cyan-200" /></span>
          <h2 className="mt-6 text-3xl font-bold leading-tight tracking-tight md:text-5xl">เปลี่ยนงานซ่อมบำรุงจาก Reactive เป็น Intelligent Maintenance</h2>
          <p className="mx-auto mt-5 max-w-2xl leading-7 text-blue-100">ลดเวลารับแจ้ง ลดงานซ้ำ ควบคุม SLA และใช้ข้อมูลเพื่อป้องกันปัญหาก่อนเกิดผลกระทบ</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="bg-white text-blue-900 hover:bg-blue-50"><Link href={workspaceHref}>{session ? "เข้าสู่พื้นที่ทำงาน" : "ดูระบบตัวอย่าง"}<ArrowRight className="size-4" /></Link></Button>
            <Button asChild size="lg" variant="outline" className="border-white/30 bg-white/5 text-white hover:bg-white/10 hover:text-white"><a href="#capabilities">สำรวจความสามารถทั้งหมด</a></Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[90rem] flex-col gap-5 px-5 py-8 sm:flex-row sm:items-center sm:justify-between md:px-8">
          <MaLogo size="sm" />
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-slate-500"><a href="#copilot" className="hover:text-blue-700">AI Copilot</a><a href="#capabilities" className="hover:text-blue-700">ความสามารถ</a><a href="#security" className="hover:text-blue-700">ความปลอดภัย</a></div>
          <span className="text-xs text-slate-500">Intelligent maintenance from report to verified close.</span>
        </div>
      </footer>
    </main>
  );
}
