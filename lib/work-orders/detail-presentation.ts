export const workOrderTabs = {
  overview: "ภาพรวม", planning: "วางแผนและมอบหมาย", "job-steps": "ขั้นตอนปฏิบัติงาน", checklist: "รายการตรวจสอบ", labor: "บันทึกเวลาและ OT", materials: "วัสดุและอะไหล่", tools: "เครื่องมือ", "safety-loto": "ความปลอดภัย / LOTO", documents: "รูปและเอกสาร", acceptance: "การรับงาน", completion: "ส่งตรวจและปิดงาน", history: "ประวัติ",
} as const;
export type WorkOrderTab = keyof typeof workOrderTabs;
export function validWorkOrderTab(value: string | null): WorkOrderTab {
  return value && Object.hasOwn(workOrderTabs, value) ? value as WorkOrderTab : "overview";
}
export function localDateTimeValue(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
