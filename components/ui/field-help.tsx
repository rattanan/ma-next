"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

type HelpContent = {
  description: string
  example: string
}

const helpByLabel: Record<string, HelpContent> = {
  "kks / asset code": { description: "รหัสอ้างอิงเฉพาะของอุปกรณ์หรือสินทรัพย์ในระบบ", example: "เช่น PUMP-101A หรือ 10-MP-001" },
  "asset name": { description: "ชื่อที่ใช้เรียกอุปกรณ์หรือสินทรัพย์ให้ผู้ใช้งานเข้าใจตรงกัน", example: "เช่น Main Cooling Water Pump" },
  "asset type": { description: "ประเภทหลักของสินทรัพย์ ใช้จัดกลุ่มและกำหนดข้อมูลที่เกี่ยวข้อง", example: "เช่น Pump, Motor หรือ Building" },
  category: { description: "หมวดหมู่ย่อยของรายการ ใช้สำหรับการค้นหาและรายงาน", example: "เช่น Centrifugal Pump" },
  "structure level": { description: "ระดับของรายการในโครงสร้างสินทรัพย์", example: "เช่น System, Equipment หรือ Component" },
  status: { description: "สถานะปัจจุบันของรายการ ซึ่งมีผลต่อการนำไปใช้งานในขั้นตอนถัดไป", example: "เช่น Active หรือ Inactive" },
  criticality: { description: "ระดับผลกระทบหากสินทรัพย์ขัดข้อง ใช้ช่วยจัดลำดับงานบำรุงรักษา", example: "เช่น Medium หรือ Critical" },
  description: { description: "รายละเอียดเพิ่มเติมที่ช่วยให้เข้าใจรายการหรือขอบเขตงาน", example: "เช่น พบเสียงผิดปกติบริเวณลูกปืนด้านขับ" },
  "parent asset": { description: "สินทรัพย์ระดับบนที่รายการนี้เป็นส่วนประกอบอยู่", example: "เช่น Cooling Water System" },
  location: { description: "ตำแหน่งติดตั้งหรือพื้นที่จัดเก็บของรายการ", example: "เช่น Utility Building ชั้น 1" },
  "gps coordinates": { description: "พิกัดละติจูดและลองจิจูดของตำแหน่งสินทรัพย์", example: "เช่น 13.7563, 100.5018" },
  "assigned owner": { description: "ผู้รับผิดชอบหลักในการดูแลข้อมูลหรือสินทรัพย์นี้", example: "เช่น Somchai Maintenance" },
  "linked contract": { description: "สัญญาที่ครอบคลุมการดูแล บริการ หรือรับประกันสินทรัพย์", example: "เช่น MA-2026-001" },
  "inventory location": { description: "ชื่อพื้นที่คลังที่เชื่อมโยงกับสินทรัพย์", example: "เช่น MAIN-WH · Main Warehouse" },
  unit: { description: "หน่วยนับหรือหน่วยวัดของรายการ", example: "เช่น EA, SET, L หรือ KG" },
  "serial number": { description: "หมายเลขประจำเครื่องที่ผู้ผลิตกำหนด", example: "เช่น SN-A1B2C3-2026" },
  "maintenance interval": { description: "ระยะห่างระหว่างการบำรุงรักษาตามแผน", example: "เช่น 30 วัน หรือ 500 ชั่วโมง ตามมาตรฐานที่ใช้งาน" },
  "runtime-hour kks": { description: "รหัสจุดข้อมูลชั่วโมงเดินเครื่องที่ใช้วางแผนบำรุงรักษา", example: "เช่น 10-MP-001-RH" },
  "budget id": { description: "รหัสงบประมาณที่ใช้ติดตามค่าใช้จ่ายของสินทรัพย์", example: "เช่น CAPEX-2026-014" },
  "primary image path": { description: "ที่อยู่รูปหลักของสินทรัพย์ในระบบหรือ path เดิมที่ย้ายข้อมูลมา", example: "เช่น /api/attachments/abc123/content" },
  "upload primary image": { description: "รูปหลักสำหรับช่วยระบุสินทรัพย์ในหน้ารายละเอียด", example: "เช่น รูป JPEG ของปั๊มที่เห็นป้ายชื่อชัดเจน" },
  "cost center legacy id": { description: "รหัส Cost Center จากระบบเดิมสำหรับตรวจสอบข้อมูลหลังย้ายระบบ", example: "เช่น 1205" },
  "budget reference legacy id": { description: "รหัสอ้างอิงงบประมาณจากระบบเดิม", example: "เช่น 8451" },
  "inventory location legacy id": { description: "รหัสตำแหน่งคลังจากระบบเดิม", example: "เช่น 32" },
  "source type": { description: "แหล่งที่มาของใบสั่งงาน", example: "เช่น MANUAL หรือ PREVENTIVE_EVENT" },
  "source record": { description: "รหัสรายการต้นทางเมื่อใบสั่งงานไม่ได้สร้างแบบ Manual", example: "เช่น PM-EVENT-2026-0042" },
  "work type": { description: "ประเภทของงานบำรุงรักษาที่ต้องดำเนินการ", example: "เช่น CORRECTIVE หรือ PREVENTIVE" },
  "primary asset": { description: "สินทรัพย์หลักที่ได้รับผลกระทบหรือเป็นเป้าหมายของงาน", example: "เช่น PUMP-101A · Cooling Water Pump" },
  title: { description: "หัวข้อสั้น ๆ ที่สรุปสิ่งที่ต้องดำเนินการ", example: "เช่น เปลี่ยนซีลปั๊มน้ำหล่อเย็น" },
  "work description": { description: "รายละเอียดอาการ ขอบเขต และผลลัพธ์ที่ต้องการจากงาน", example: "เช่น ตรวจสอบการรั่วและเปลี่ยน mechanical seal" },
  priority: { description: "ความเร่งด่วนในการจัดคิวและตอบสนองงาน", example: "เช่น HIGH เมื่องานควรเริ่มภายในวันเดียวกัน" },
  severity: { description: "ระดับความรุนแรงของผลกระทบจากปัญหา", example: "เช่น MAJOR เมื่อกระทบกำลังการผลิต" },
  "equipment status": { description: "สภาพการเดินเครื่องของอุปกรณ์ ณ เวลาที่แจ้งงาน", example: "เช่น RUNNING, STOPPED หรือ DEGRADED" },
  department: { description: "หน่วยงานเจ้าของรายการหรือผู้รับผิดชอบดำเนินงาน", example: "เช่น Mechanical Maintenance" },
  "crew / team": { description: "ชื่อชุดปฏิบัติงานหรือทีมที่ได้รับมอบหมาย", example: "เช่น Mechanical Team A" },
  "assigned technician": { description: "ช่างผู้รับผิดชอบหลักในการดำเนินงาน", example: "เช่น Somchai Jaidee" },
  lead: { description: "หัวหน้าทีมหรือผู้ประสานงานหลักของงาน", example: "เช่น Maintenance Lead A" },
  supervisor: { description: "ผู้ควบคุม ตรวจสอบ หรือรับรองผลการดำเนินงาน", example: "เช่น Shift Supervisor" },
  "vendor / manufacturer": { description: "ผู้ขายหรือผู้ผลิตที่เกี่ยวข้องกับอุปกรณ์หรืองานนี้", example: "เช่น ABC Engineering Co., Ltd." },
  customer: { description: "หน่วยงานหรือผู้ใช้งานที่ร้องขอและรับมอบผลของงาน", example: "เช่น Production Line 2" },
  reporter: { description: "ชื่อผู้แจ้งปัญหาหรือผู้ให้ข้อมูลหน้างาน", example: "เช่น Anan Operator" },
  "reporter phone": { description: "หมายเลขติดต่อผู้แจ้งสำหรับสอบถามข้อมูลเพิ่มเติม", example: "เช่น 081-234-5678 หรือ Ext. 2401" },
  "reported date": { description: "วันและเวลาที่พบหรือแจ้งปัญหา", example: "เช่น 05/09/2026 09:30" },
  "planned start": { description: "วันและเวลาที่วางแผนจะเริ่มงาน", example: "เช่น 06/09/2026 08:00" },
  "planned finish": { description: "วันและเวลาที่คาดว่าจะดำเนินงานเสร็จ", example: "เช่น 06/09/2026 12:00" },
  "required completion": { description: "กำหนดเสร็จล่าสุดที่งานต้องแล้วเสร็จ", example: "เช่น 07/09/2026 17:00" },
  "estimated duration (minutes)": { description: "เวลาที่คาดว่าจะใช้ดำเนินงานทั้งหมด หน่วยเป็นนาที", example: "เช่น 120" },
  notes: { description: "ข้อมูลประกอบหรือข้อสังเกตเพิ่มเติม", example: "เช่น ต้องประสานฝ่ายผลิตก่อนหยุดเครื่อง" },
  "full name": { description: "ชื่อและนามสกุลที่ใช้แสดงในระบบ", example: "เช่น สมชาย ใจดี" },
  username: { description: "ชื่อบัญชีสำหรับเข้าสู่ระบบ ต้องไม่ซ้ำกับผู้ใช้อื่น", example: "เช่น somchai.j" },
  email: { description: "อีเมลที่ใช้ติดต่อและระบุตัวผู้ใช้งาน", example: "เช่น somchai@company.com" },
  role: { description: "บทบาทที่กำหนดขอบเขตสิทธิ์ของผู้ใช้งาน", example: "เช่น Technician หรือ Administrator" },
  password: { description: "รหัสผ่านสำหรับยืนยันตัวตนของผู้ใช้งาน", example: "เช่น รหัสผ่านยาวอย่างน้อย 10 ตัวอักษรที่คาดเดายาก" },
  "initial password": { description: "รหัสผ่านชั่วคราวสำหรับการเข้าสู่ระบบครั้งแรก", example: "เช่น รหัสผ่านยาวอย่างน้อย 10 ตัวอักษรที่ไม่ซ้ำข้อมูลส่วนตัว" },
  "admin notes": { description: "บันทึกภายในสำหรับผู้ดูแลระบบ", example: "เช่น บัญชีสำหรับทีมซ่อมบำรุงกะกลางคืน" },
  "email or username": { description: "อีเมลหรือชื่อบัญชีที่ลงทะเบียนไว้ในระบบ", example: "เช่น somchai@company.com หรือ somchai.j" },
  "แผนก": { description: "หน่วยงานที่เป็นเจ้าของหรือรับผิดชอบเอกสาร", example: "เช่น MNT · Maintenance" },
  "สกุลเงิน": { description: "สกุลเงินที่ใช้ระบุราคาบนเอกสาร", example: "เช่น THB, USD หรือ EUR" },
  "อัตราแลกเปลี่ยนเป็นบาท": { description: "มูลค่าเงินบาทต่อหนึ่งหน่วยของสกุลเงินในเอกสาร", example: "เช่น 35.50 สำหรับ 1 USD" },
  "วิธีจัดซื้อ": { description: "วิธีหรือกระบวนการที่ใช้ในการจัดซื้อครั้งนี้", example: "เช่น Quotation หรือ Sole source" },
  "ผู้ขาย": { description: "ผู้ขายที่เสนอราคาหรือเป็นคู่สัญญาของเอกสาร", example: "เช่น V0001 · ABC Supply" },
  "จำนวน #": { description: "จำนวนสินค้าหรืออะไหล่ของรายการนี้", example: "เช่น 2.000000" },
  "ราคาประมาณต่อหน่วย #": { description: "ราคาต่อหน่วยที่ใช้ประมาณมูลค่าในใบขอซื้อ", example: "เช่น 1,250.00" },
  "ราคาต่อหน่วย #": { description: "ราคาซื้อต่อหนึ่งหน่วยก่อนหักส่วนลด", example: "เช่น 1,250.00" },
  "ส่วนลด #": { description: "ส่วนลดของรายการสินค้าในสกุลเงินของเอกสาร", example: "เช่น 100.00" },
  "ส่วนลดรายการ #": { description: "ส่วนลดเฉพาะรายการสินค้าในสกุลเงินของเอกสาร", example: "เช่น 100.00" },
  "ส่วนลดท้ายเอกสาร": { description: "ส่วนลดรวมที่หักจากยอดท้ายเอกสาร", example: "เช่น 500.00" },
  "ภาษีมูลค่าเพิ่ม": { description: "ยอดภาษีมูลค่าเพิ่มของเอกสาร", example: "เช่น 735.00" },
  "หมายเหตุ": { description: "ข้อมูลประกอบหรือข้อสังเกตเพิ่มเติม", example: "เช่น ขอส่งของภายในวันที่ 15 กันยายน" },
}

function normalizeLabel(label: string) {
  return label.trim().toLowerCase().replace(/\s+/g, " ").replace(/\d+/g, "#")
}

function defaultHelp(label: string): HelpContent {
  return {
    description: `ข้อมูลสำหรับช่อง “${label}” ใช้ประกอบการบันทึกและตรวจสอบรายการ`,
    example: `เช่น กรอกหรือเลือกค่า “${label}” ให้ตรงกับข้อมูลอ้างอิงของรายการนี้`,
  }
}

function textFromNode(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node)
  if (Array.isArray(node)) return node.map(textFromNode).join("")
  return ""
}

function getFieldHelp(label: string, description?: string, example?: string): HelpContent {
  const catalog = helpByLabel[normalizeLabel(label)]
  const fallback = defaultHelp(label)
  return {
    description: description || catalog?.description || fallback.description,
    example: example || catalog?.example || fallback.example,
  }
}

function FieldHelp({ label, description, example, className }: { label: string; description?: string; example?: string; className?: string }) {
  const tooltipId = React.useId()
  const content = getFieldHelp(label, description, example)

  return (
    <span className={cn("group/field-help relative inline-flex shrink-0 align-middle", className)}>
      <span
        aria-describedby={tooltipId}
        aria-label={`คำอธิบายช่อง ${label}`}
        className="inline-grid size-[1.125rem] cursor-help place-items-center rounded-full border border-blue-300 bg-blue-50 text-[11px] font-bold leading-none text-blue-700 outline-none transition hover:border-blue-500 hover:bg-blue-100 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
        role="button"
        tabIndex={0}
      >
        ?
      </span>
      <span
        id={tooltipId}
        role="tooltip"
        className="pointer-events-none absolute left-0 top-full z-[80] mt-2 hidden w-[min(18rem,calc(100vw-2rem))] rounded-lg bg-slate-950 px-3 py-2.5 text-left text-xs font-normal leading-5 text-white shadow-xl group-hover/field-help:block group-focus-within/field-help:block"
      >
        <span className="block font-semibold text-white">{content.description}</span>
        <span className="mt-1 block text-slate-300">{content.example}</span>
      </span>
    </span>
  )
}

export { FieldHelp, getFieldHelp, textFromNode }
export type { HelpContent }
