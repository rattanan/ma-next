# Production UAT: UAT-20260905-A

สถานะ: ผู้ใช้อนุมัติขอบเขตนี้ด้วยข้อความ “ทำได้” แล้ว รัน production UAT สำเร็จวันที่ 5 กันยายน 2026 เวลา 14:01 น. (Asia/Bangkok) ดูผลจริงใน `production-uat-report-20260905.md` และหลักฐาน `production-uat-result-20260905.json` ข้อความด้านล่างเป็นขอบเขตที่ใช้ในการรัน

เป้าหมาย: `https://ma.rattanan.dev`, เซิร์ฟเวอร์ `ntop`, `/opt/apps/ma-next` ใช้ `.env` ที่มีอยู่

## สิ่งที่ตรวจแล้วแบบอ่านอย่างเดียว

- HTTPS หน้า login ตอบ 200 และ commit production คือ `af992c9`
- ตาราง roles มีเฉพาะ ADMIN ที่ active
- มีองค์กร DEMO และประเภทสินทรัพย์เดิม
- ยังไม่มี approval workflow ของ PR/PO

## บัญชีที่จะสร้าง

บัญชีทั้งหมดมี prefix `uat.20260905.` และอีเมลลงท้าย `@example.test` รหัสผ่านสุ่มแยกรายบัญชี ไม่เก็บใน Git หรือพิมพ์ออก console

| Username | Role | หน้าที่ทดสอบ |
|---|---|---|
| uat.20260905.admin | ADMIN | จัดการบัญชีและเส้นทางอนุมัติ |
| uat.20260905.data_source_creator | DATA_SOURCE_CREATOR | สร้าง Asset ตามสิทธิ์เดิมของแอป |
| uat.20260905.dashboard_creator | DASHBOARD_CREATOR | Login และตรวจ role จาก session |
| uat.20260905.viewer | VIEWER | Login และตรวจ role จาก session |
| uat.20260905.operator | OPERATOR | แจ้งซ่อม รับงาน และปิด Notification |
| uat.20260905.maintenance | MAINTENANCE | สร้าง PR เบิกของ และย้ายของ |
| uat.20260905.maintenance_manager | MAINTENANCE_MANAGER | อนุมัติ PR/PO และคลัง มอบหมาย/ตรวจ/ปิด WO |
| uat.20260905.warehouse_manager | WAREHOUSE_MANAGER | สร้าง PO รับของ และอนุมัติคลังขั้นสุดท้าย |
| uat.20260905.plant_manager | PLANT_MANAGER | Login และตรวจ role จาก session |
| uat.20260905.technician | TECHNICIAN | รับมอบหมาย เริ่มงาน และส่งผลซ่อม |

เพิ่มนิยาม role ที่ขาดตาม `lib/auth/permissions.ts` โดยไม่แก้ permission ของ role เดิม มอบหมาย scope เฉพาะองค์กร/แผนก UAT ให้บัญชีใหม่ ทั้งนี้ ADMIN ยังเป็นสิทธิ์ผู้ดูแลทั้งระบบตามพฤติกรรมแอป ไม่ใช่ admin ที่จำกัดได้ด้วย scope

การ bootstrap บัญชี ADMIN ทดสอบใช้ user service ผ่าน SSH พร้อม audit ระบุ UAT; หลังจากนั้นการสร้างบัญชีและธุรกรรมใช้ HTTPS API พร้อม login แยกแต่ละ role การจัดตั้ง role/scope ใช้ Prisma transaction พร้อม audit เพราะ API ผู้ใช้ปัจจุบันไม่มีคำสั่งมอบหมาย scope

## ข้อมูลที่จะเพิ่มและผลกระทบ

- องค์กร 1, site 1, แผนก 1 ชื่อ `UAT-20260905-A`
- คลัง A/B 2 แห่ง, สินค้าจำลอง 1 รายการ, ผู้ขายจำลอง 1 ราย, Asset จำลอง 1 ราย
- approval workflow 2 ชุด จำกัดเฉพาะแผนก UAT และผู้อนุมัติ UAT ที่ระบุไว้
- PR 1 ฉบับ และ PO 1 ฉบับ จำนวน 10 หน่วย × 1 บาท = 10 บาท ไม่มี VAT
- รับของ 10 หน่วยเข้าคลัง A, เบิก 2 หน่วยอ้างอิง WO, ย้าย 3 หน่วยจาก A ไป B
- Notification 1 รายการและ Work Order 1 รายการจนสถานะ CLOSED

**นี่เป็นการบันทึกธุรกรรมจริงในฐานข้อมูล production** แม้เป็นข้อมูลจำลอง รายการจะมีผลต่อรายงานรวม เลขเอกสาร audit ประวัติ login และการแจ้งเตือนในแอป สินค้า/คลัง/Asset บางส่วนเป็นทะเบียนร่วม จึงแยกด้วยรหัส UAT ไม่ใช่ฐานข้อมูลแยก ไม่ส่ง PO ให้ผู้ขายหรือส่งอีเมลภายนอก

## ลำดับและเกณฑ์ตรวจ

1. สร้างบัญชี Login ตรวจ role และเปลี่ยนรหัสผ่านเริ่มต้นของบัญชีที่กำหนดไว้
2. MAINTENANCE สร้าง/ส่ง PR → MAINTENANCE_MANAGER อนุมัติ
3. WAREHOUSE_MANAGER สร้าง PO อ้างอิง PR → ส่งอนุมัติ → MAINTENANCE_MANAGER อนุมัติ → ออก PO
4. WAREHOUSE_MANAGER สร้างและยืนยันรับของจาก PO → ใบรับ POSTED และ PO RECEIVED
5. DATA_SOURCE_CREATOR สร้าง Asset → OPERATOR สร้าง/ส่ง Notification → MAINTENANCE_MANAGER ตรวจและอนุมัติ
6. MAINTENANCE_MANAGER สร้าง WO และมอบหมาย TECHNICIAN → ช่างรับงานและเริ่มงาน
7. MAINTENANCE เบิก 2 หน่วยอ้างอิงใบรับและ WO → ผู้จัดการซ่อมอนุมัติ → ผู้จัดการคลังอนุมัติ → POSTED
8. MAINTENANCE ย้าย 3 หน่วย → ผู้จัดการทั้งสองอนุมัติ → POSTED
9. TECHNICIAN ส่งผลซ่อมจำลอง → ผู้จัดการอนุมัติ → OPERATOR รับงาน → ผู้จัดการปิด WO → OPERATOR ปิด Notification
10. อ่านฐานข้อมูลกลับเพื่อตรวจ A = 5 หน่วย, B = 3 หน่วย, PO = RECEIVED, WO/Notification = CLOSED
11. ตรวจกรณีปฏิเสธ: OPERATOR สร้าง PR ไม่ได้, ผู้มีสิทธิ์ช่างแต่ไม่ได้รับมอบหมายรับ WO ไม่ได้, ปิด WO ก่อนรับงานไม่ได้

หลังสำเร็จ ปิดใช้งานเฉพาะ workflow UAT บังคับเปลี่ยนรหัสผ่านเมื่อ login ครั้งต่อไป และ logout session ของสคริปต์ เก็บธุรกรรมไว้เป็นหลักฐาน ไม่ลบ audit หรือแก้ยอดสต็อกตรง ๆ บัญชี UAT ยังคง active เพื่อให้ผู้ใช้ตรวจรับต่อ

## สคริปต์และหลักฐาน

ไฟล์: `ops/uat/production-uat.cjs` ตรวจ syntax และรันผ่าน production API แล้ว การทดสอบนี้เป็น API/integration UAT ไม่ใช่การตรวจทุกหน้าจอใน browser

เมื่อได้รับอนุมัติแล้ว จึงนำสคริปต์ไปยังเซิร์ฟเวอร์และรันจากโฟลเดอร์โปรเจกต์:

```bash
node_modules/.bin/tsx ops/uat/production-uat.cjs --run-production-uat
```

บันทึกสถานะและข้อมูลเข้าระบบที่ `storage/uat/UAT-20260905-A/state.json` สิทธิ์ 600 ภายในโฟลเดอร์ 700; รายงานที่ไม่รวมรหัสผ่านอยู่ใน `report.json` ถ้าขั้นใดไม่สำเร็จ สคริปต์หยุดและเก็บ pending step ต้องตรวจรายการจริงก่อน retry เพื่อป้องกันธุรกรรมซ้ำ

## ขอบเขตที่ขออนุมัติ

สร้างบัญชี 10 บทบาทรวม ADMIN ทดสอบ เพิ่มนิยาม role/scope ที่ขาด และรันธุรกรรมจำลองตามจำนวนด้านบนบน production โดยยอมรับว่ารายงานรวมและ audit จะมีชุด UAT นี้อยู่ ไม่รวมการเปลี่ยนสิทธิ์บัญชีเดิม การ migrate schema หรือการลบข้อมูล
