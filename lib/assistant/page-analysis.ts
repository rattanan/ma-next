export type PageSnapshot = {
  title: string;
  headings: string[];
  text: string;
  rowCount: number;
  fields: { label: string; required: boolean; value: string }[];
  statusCounts: Record<string, number>;
};

const warningTerms = ["overdue", "เกินกำหนด", "failed", "ล้มเหลว", "rejected", "ปฏิเสธ", "returned", "คืนเรื่อง", "reorder", "ต่ำกว่าจุดสั่งซื้อ", "error", "ข้อผิดพลาด", "cancelled", "ยกเลิก"];
const emptyTerms = ["ไม่มีข้อมูล", "ไม่ระบุ", "no data", "not assigned", "n/a"];

function topStatuses(statusCounts: Record<string, number>) {
  return Object.entries(statusCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
}

export function summarizeSnapshot(snapshot: PageSnapshot) {
  const parts = [`หน้าปัจจุบันคือ “${snapshot.title || "หน้าระบบ"}”`];
  if (snapshot.rowCount) parts.push(`พบรายการที่แสดงอยู่ ${snapshot.rowCount} รายการ`);
  if (snapshot.fields.length) parts.push(`มีช่องข้อมูล ${snapshot.fields.length} ช่อง (${snapshot.fields.filter((field) => field.required).length} ช่องบังคับ)`);
  const statuses = topStatuses(snapshot.statusCounts);
  if (statuses.length) parts.push(`สถานะที่พบ: ${statuses.map(([name, count]) => `${name} ${count}`).join(", ")}`);
  if (snapshot.headings.length > 1) parts.push(`เนื้อหาหลักประกอบด้วย ${snapshot.headings.slice(1, 5).join(", ")}`);
  return `${parts.join(" · ")} ข้อมูลนี้สรุปจากสิ่งที่แสดงบนหน้าจอขณะนี้`;
}

export function findConcerns(snapshot: PageSnapshot) {
  const lower = snapshot.text.toLocaleLowerCase("th");
  const foundWarnings = warningTerms.filter((term) => lower.includes(term));
  const foundEmpty = emptyTerms.filter((term) => lower.includes(term));
  const requiredEmpty = snapshot.fields.filter((field) => field.required && !field.value.trim());
  const findings: string[] = [];
  if (foundWarnings.length) findings.push(`พบคำที่ควรตรวจสอบ: ${foundWarnings.slice(0, 5).join(", ")}`);
  if (foundEmpty.length) findings.push(`มีข้อความที่สื่อถึงข้อมูลว่างหรือยังไม่ระบุ (${foundEmpty.slice(0, 3).join(", ")})`);
  if (requiredEmpty.length) findings.push(`ช่องบังคับที่ยังว่าง ${requiredEmpty.length} ช่อง: ${requiredEmpty.slice(0, 5).map((field) => field.label).join(", ")}`);
  if (!snapshot.rowCount && !snapshot.fields.length) findings.push("ไม่พบตารางหรือแบบฟอร์มในส่วนที่กำลังแสดง อาจต้องเลือกตัวกรองหรือเปิดรายละเอียดก่อน");
  return findings.length ? `จุดที่ควรตรวจสอบจากหน้าจอนี้:\n• ${findings.join("\n• ")}\nโปรดเปิดรายการต้นทางเพื่อยืนยันก่อนตัดสินใจ` : "ยังไม่พบสัญญาณผิดปกติที่ตรวจได้จากข้อมูลบนหน้าจอ แต่ควรตรวจรายการสำคัญกับเอกสารต้นทางก่อนดำเนินการ";
}

export function findInsights(snapshot: PageSnapshot) {
  const statuses = topStatuses(snapshot.statusCounts);
  const insights: string[] = [];
  if (statuses.length) {
    const total = statuses.reduce((sum, [, count]) => sum + count, 0);
    const [dominant, count] = statuses[0];
    insights.push(`สถานะที่พบมากที่สุดคือ ${dominant} (${count} จาก ${total} ป้ายสถานะที่ตรวจพบ)`);
    if (statuses.length > 1) insights.push(`มีอย่างน้อย ${statuses.length} สถานะในมุมมองนี้ แสดงว่างานกระจายอยู่หลายขั้นตอน`);
  }
  if (snapshot.rowCount >= 20) insights.push("รายการค่อนข้างมาก ควรจำกัดตัวกรองตามผู้รับผิดชอบ สถานะ หรือช่วงเวลาก่อนจัดลำดับงาน");
  if (snapshot.rowCount > 0 && snapshot.rowCount < 5) insights.push("จำนวนรายการที่แสดงมีน้อย สามารถเปิดตรวจรายละเอียดเป็นรายรายการได้");
  if (snapshot.fields.length) insights.push(`แบบฟอร์มนี้มีช่องบังคับ ${snapshot.fields.filter((field) => field.required).length} จาก ${snapshot.fields.length} ช่อง ควรเตรียมข้อมูลให้ครบก่อนบันทึก`);
  return insights.length ? `Insight จากข้อมูลที่กำลังแสดง:\n• ${insights.join("\n• ")}\nเป็นการสังเกตจากหน้าจอปัจจุบัน ไม่ใช่ข้อสรุปแทนผู้รับผิดชอบ` : "ข้อมูลบนหน้าจอยังไม่เพียงพอสำหรับหา Insight ลองเลือกช่วงเวลา ตัวกรอง หรือเปิดรายละเอียด แล้วกดวิเคราะห์อีกครั้ง";
}
