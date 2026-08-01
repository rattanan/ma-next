# MA Design System

> สถานะเอกสาร: UI source of truth สำหรับ `ma-next`
>
> ขอบเขต: รูปแบบการนำเสนอและการใช้งานเท่านั้น ห้ามใช้เอกสารนี้เปลี่ยน business rules, permissions, workflow, API หรือ database โดยพลการ
>
> หลักฐานที่ตรวจ: App Router pages/layouts, shell, foundation/admin/maintenance components, `app/globals.css`, `components.json`, package dependencies, validation, permissions และ maintenance workflow ณ วันที่ 2026-08-01

## Current-state baseline

ระบบปัจจุบันมี UI อยู่สามแนวพร้อมกัน: shell และหน้าหลักใช้ slate/blue กับ shadcn บางส่วน, หน้า login/profile/admin บางหน้าใช้ CSS ชุดเดิมสีม่วงและข้อความ “atlas”, ส่วน `/maintenance` ใช้ shell และ CSS สีเขียวแยกต่างหาก จึงยังไม่มี visual language เดียว ทั้งยังมี native form controls, custom buttons, custom tables, browser `confirm`, loading แบบข้อความ และ status pill ที่ใช้สี/รูปแบบไม่สม่ำเสมอ

shadcn ถูกตั้งค่าแล้วด้วย style `new-york`, CSS variables, base color `neutral`, RSC และ Lucide แต่มี component จริงเพียง `Badge`, `Button`, `Card`, `Dialog`, `Input`, `Label`, `Separator` หน้า `/maintenance` ไม่ได้ใช้ `AppShell` ขณะที่ protected modules อื่นใช้ shell หลัก การ refactor ต้องคง field, action, permission และ state ทุกอย่างที่มีอยู่

## 1. Design goals

1. ลดความผิดพลาดด้วย label ที่ชัด, validation ใกล้ field, confirmation ตามความเสี่ยง และแสดงผลของ workflow action ก่อนยืนยัน
2. ทำงานประจำให้เร็วขึ้นด้วย search/filter ที่คงค่า, keyboard-friendly controls, primary action ตำแหน่งคงที่ และลดการสลับหน้าโดยไม่จำเป็น
3. ทำให้ status, priority, due date และ asset breakdown มองเห็นได้ใน 1–2 วินาทีด้วย badge + text + icon และลำดับข้อมูลที่สม่ำเสมอ
4. รองรับข้อมูลจำนวนมากด้วย dense-but-readable table, pagination, sticky header, column visibility และ saved view ในหน้าที่ใช้ซ้ำบ่อย
5. คง action สำคัญใน viewport: page action ด้านขวาบน, contextual workflow action ใน sticky action bar และ mobile bottom action bar
6. ใช้ pattern เดียวกันทุก module โดยไม่ลดหรือเปลี่ยน workflow เดิม; UX recommendation ที่กระทบ flow ต้องระบุแยกและผ่าน product/operations review
7. รองรับไทย–อังกฤษ, desktop/laptop/tablet เป็นหลัก และ mobile สำหรับดูข้อมูล, approve, update status, บันทึกงานสั้น ๆ และแนบภาพ

## 2. Design principles

| Principle | วิธีใช้ใน MA |
|---|---|
| Clarity before decoration | ให้เลขงาน, asset, status, priority, due date และผู้รับผิดชอบเด่นกว่า artwork; effect ของแบรนด์อยู่ที่ login/landing ไม่แทรกในตารางงาน |
| One obvious primary action | หนึ่งหน้ามีปุ่ม solid primary เพียง action หลัก เช่น “แจ้งซ่อม”, “บันทึก”, “ส่งตรวจ”; action อื่นเป็น outline/ghost/menu |
| Progressive disclosure | list แสดงข้อมูลตัดสินใจ; detail แสดงสรุปก่อน; technical/audit data อยู่ tab ที่เหมาะสม; advanced filters เปิดจาก Sheet/Popover |
| Consistent terminology | ใช้คำเดียวต่อสถานะ/action ทั้ง badge, filter, notification และ audit; ค่า backend uppercase แปลงผ่าน shared label map ไม่เขียนกระจายตามหน้า |
| Safe destructive actions | lock, disable, revoke, reset, cancel และ archive ใช้ AlertDialog ระบุ record/ผลกระทบ; action ย้อนคืนไม่ได้ต้องให้เหตุผลเมื่อ business rule กำหนด |
| Scannable information | ใช้ section heading, label/value grid, tabular numerals, row density 52–60 px และ whitespace เพื่อแบ่งกลุ่ม ไม่ใช้ card ซ้อน card |
| Visible system feedback | ทุก save/action มี pending state, ป้องกัน submit ซ้ำ, success/error ที่เฉพาะเจาะจง และ refresh เฉพาะข้อมูลที่กระทบ |
| Desktop-first responsive | ออกแบบ workflow เต็มบน ≥1024 px แล้วกำหนด tablet/mobile adaptation โดยไม่ซ่อนข้อมูลสำคัญหรือ action ที่ผู้ใช้มีสิทธิ์ |
| Accessible by default | semantic HTML, keyboard order, focus ring, accessible name, contrast AA, reduced motion และ live region สำหรับ async feedback |
| Permission is explainable | ซ่อน action ที่ไม่เกี่ยวข้อง; ถ้าผู้ใช้เห็น record แต่ทำไม่ได้ให้ disabled พร้อมเหตุผล ไม่ใช้ redirect ไป profile พร้อม query ที่ไม่อธิบาย |

## 3. Visual direction

### 3.1 MA theme

ภาพรวมเป็น “industrial precision”: พื้นหลัง mist/slate อ่อน, surface ขาว, navy สำหรับโครงสร้างและความน่าเชื่อถือ, cobalt สำหรับ action, cyan เป็น accent จำกัด, เส้นขอบบาง, radius ปานกลาง 8–12 px และ shadow ต่ำ เน้นข้อมูลมากกว่าการตกแต่ง ใช้ Lucide ขนาด/น้ำหนักสม่ำเสมอ

ห้ามใช้ glassmorphism, glow, gradient มากจุด, card ขนาดใหญ่เกินข้อมูล หรือภาพโรงงานเป็นพื้นหลังใต้ข้อมูลปฏิบัติงาน Gradient อนุญาตเฉพาะ brand mark, login/landing hero และแถบแบรนด์ขนาดเล็ก

### 3.2 Logo system จากภาพอ้างอิง

ใช้แนวคิดใกล้เคียงภาพ: monogram “MA” ทรงแข็งแรง มีวงโคจร/swoosh สีน้ำเงิน–cyan สื่อถึง maintenance cycle และการทำงานครบวงจร โดยปรับให้เหมาะกับ product UI ดังนี้

- `MA Mark — Flat`: ตัวอักษร navy/white + swoosh cobalt ใช้ใน sidebar, header, favicon และ loading; ไม่มี bevel, glow หรือเงาหนัก
- `MA Mark — Dimensional`: ผิว silver/slate แบบ subtle และ swoosh blue/cyan ใช้เฉพาะ landing/login hero และสื่อการตลาด
- `MA Lockup`: mark + “MA Next — Intelligence Maintenance Management Platform”; Thai descriptor เป็นข้อความ HTML ไม่ฝังในภาพ
- ใช้ไฟล์ SVG เป็นหลัก, PNG/WebP สำหรับ dimensional artwork เท่านั้น; ต้องมี light, dark, monochrome และ icon-only variant
- clear space รอบ mark อย่างน้อย 25% ของความสูง; ขนาดขั้นต่ำ icon 24 px, lockup บนจอ 120 px; ห้ามบีบสัดส่วน, หมุน swoosh, เติม glow ใน shell หรือเปลี่ยนสีตาม status
- โลโก้ในภาพอ้างอิงเป็น direction ไม่ใช่ไฟล์ production ที่นำไป trace โดยอัตโนมัติ ต้องยืนยันสิทธิ์แบรนด์/ทรัพย์สินและอนุมัติ master artwork ก่อน implement

### 3.3 Hero pattern

Landing `/` และ login `/login` ใช้ split hero ที่ใกล้ภาพที่สอง: ฝั่งข้อความมี MA lockup, value proposition และ CTA; ฝั่งภาพเป็นโรงงาน/ช่าง/อุปกรณ์ในโทน blue-white พร้อมเส้น data network บาง ๆ และ product UI preview ที่สร้างจาก component จริงหรือ artwork ที่ได้รับอนุมัติ ไม่ฝังตัวเลข/ข้อความ UI ปลอมไว้ใน raster

- Desktop: content 42–48%, visual 52–58%, max width 1440 px, hero สูง 640–760 px
- Tablet: 50/50 หรือวางภาพด้านหลังเฉพาะครึ่งขวาพร้อม solid scrim ที่ contrast ผ่าน
- Mobile: เก็บ mark, headline, CTA และ crop ช่าง/โรงงานหนึ่ง focal point; ตัด dashboard mockup และ decorative network ที่รบกวน
- ภาพ informative ต้องมี alt text; texture/เส้นตกแต่งใช้ empty alt; foreground text ต้องไม่ทับพื้นที่รายละเอียดสูง
- Authenticated operational pages ห้ามมี hero; ใช้ compact page header เพื่อประหยัดพื้นที่

## 4. Color system

### 4.1 Core semantic tokens

| Token | Light value | Intended use |
|---|---:|---|
| `--background` / `bg-background` | `#F4F7FA` | app canvas |
| `--foreground` / `text-foreground` | `#142033` | primary text |
| `--card` | `#FFFFFF` | card/table/form surface |
| `--card-foreground` | `#142033` | text on card |
| `--muted` | `#EAF0F5` | subtle panels, inactive controls |
| `--muted-foreground` | `#5D6B7C` | secondary/helper text |
| `--border` / `--input` | `#D7E0E8` | borders and controls |
| `--primary` | `#1464D2` | primary action, active navigation |
| `--primary-foreground` | `#FFFFFF` | text on primary |
| `--secondary` | `#E7EEF7` | secondary controls |
| `--secondary-foreground` | `#163A63` | text on secondary |
| `--accent` | `#DDF4FC` | hover/highlight, not CTA |
| `--accent-foreground` | `#075985` | text on accent |
| `--destructive` | `#C9363E` | destructive/error |
| `--success` | `#16835B` | confirmed success/completed |
| `--warning` | `#B86707` | due soon, waiting, backlog |
| `--information` | `#2563A9` | neutral system information |
| `--brand-navy` | `#0B2A4A` | sidebar/brand structure |
| `--brand-cyan` | `#24A9E1` | limited brand accent |
| `--ring` | `#2C7BE5` | visible focus ring |

ใช้ `oklch()` equivalents เมื่อสร้าง Tailwind v4 theme แต่เก็บ HEX reference นี้เป็น approved visual target Dark mode ไม่อยู่ใน current scope; ห้ามเริ่ม dark mode ก่อน operational light theme เสถียร

### 4.2 Workflow status tokens

Badge ทุกอันมี label และ optional icon; dot อย่างเดียวไม่พอ

| Status | Token/presentation | Icon |
|---|---|---|
| Draft | slate neutral | `FilePenLine` |
| Requested / New | blue soft | `Inbox` |
| Open | blue | `CircleDot` |
| Assigned | indigo soft | `UserCheck` |
| In Progress | cobalt filled/strong outline | `PlayCircle` |
| Waiting for Parts | amber | `PackageClock` |
| Waiting for Vendor | amber | `Truck` |
| On Hold / Backlog | orange | `PauseCircle` |
| Completion Pending | cyan/indigo | `ClipboardCheck` |
| Verified | teal | `BadgeCheck` |
| Completed / Closed | green, low emphasis | `CheckCircle2` |
| Returned | orange/red outline | `Undo2` |
| Rejected / Cancelled | red outline | `CircleX` |
| Overdue | red filled only in compact badge | `ClockAlert` |

`Assigned`, waiting statuses, cancelled และ overdue เป็น design vocabulary ที่พร้อมใช้กับ future modules; อย่า map เป็น backend state จน domain รองรับ ค่า current maintenance ที่ต้อง map ตรง ๆ คือ `NEW`, `APPROVED`, `BACKLOG`, `REJECTED`, `COMPLETED`, `OPEN`, `IN_PROGRESS`, `COMPLETION_PENDING`, `VERIFIED`, `CLOSED`

## 5. Typography

ใช้ `Noto Sans Thai` เป็น primary family เพราะอ่านไทยและอังกฤษชัด รองลงมา `IBM Plex Sans Thai`, `Tahoma`, `ui-sans-serif`, `system-ui`, `sans-serif` Current Tahoma files ใช้เป็น fallback ระหว่าง migration ห้ามเปลี่ยน font โดยไม่ทดสอบเลข, Thai marks, table density และ PDF/export

| Role | Size / line-height | Weight |
|---|---|---:|
| Page title | 30/38 desktop, 24/32 mobile | 700 |
| Page description | 15/24 | 400 |
| Section heading | 20/28 | 650–700 |
| Card heading | 16/24 | 600 |
| Table header | 12/16, no forced uppercase for Thai | 600 |
| Table/body | 14/20 | 400–500 |
| Form label | 14/20 | 600 |
| Helper/error | 12/18 | 400/500 |
| KPI value | 28/34, tabular numerals | 700 |
| Badge | 12/16 | 600 |

Headline tracking ใช้เล็กน้อยเฉพาะอังกฤษ; ห้าม letter-spacing กว้างกับข้อความไทย วันที่, duration, cost และ code ใช้ `font-variant-numeric: tabular-nums`

## 6. Spacing and layout

- 4 px base scale: `1, 2, 3, 4, 5, 6, 8, 10, 12, 16`
- Sidebar expanded 256 px; collapsed 72 px; header 64 px; mobile header 56 px
- Content `max-w-[1600px]`; detail/form content reading width 1200 px; page padding 32 px desktop, 24 px tablet, 16 px mobile
- Section gap 24–32 px; card gap 16–24 px; card padding 20–24 px; compact table card paddingอยู่ที่ toolbar/footer ไม่หุ้ม table
- Field vertical gap 6–8 px; row gap 20 px; section gap 28–32 px
- Table row 52 px compact, 60 px default; touch action ไม่ต่ำกว่า 44×44 px
- Breakpoints: `<640` mobile, `640–767` large mobile, `768–1023` tablet, `1024–1279` laptop, `≥1280` desktop
- Two-column form ใช้เมื่อสอง field สัมพันธ์กันและพื้นที่ ≥1024; mobile/tablet แคบเป็น single column

## 7. Application shell

`AppShell` เป็น shell เดียวสำหรับทุก authenticated route รวม `/maintenance`

- Sidebar navy solid ไม่ใช้ gradient หนัก; ด้านบนใช้ MA Flat Mark + “Maintenance” และ instance/environment label
- กลุ่ม navigation: Overview, Maintenance (Notifications, Work Orders, Assets), Planning (future PM), Inventory (future), Organization & Configuration, Administration, Account
- item แสดงตาม permission จาก server; active state ใช้ background + left marker + `aria-current`; collapsed แสดง Tooltip และเก็บ accessible name
- Top header: mobile menu, Breadcrumb, global search/command palette, site selector, notification buttonพร้อม unread count, help, user menu
- Organization/site selector แสดง active scope ชัด; การเปลี่ยน scopeต้องเตือนเมื่อ form มี unsaved data
- Global searchค้น work order/asset/notification เมื่อ backend รองรับ; ระหว่างนั้นซ่อน control อย่าแสดง mock feature
- Desktop collapse preference เก็บใน client; mobile ใช้ `Sheet` ด้านซ้าย ไม่ใช้ `Dialog` เต็มหน้าเหมือน current
- แนะนำ `Sidebar`, `Sheet`, `Breadcrumb`, `Button`, `DropdownMenu`, `Command`, `Popover`, `Avatar`, `Tooltip`, `Separator`, `ScrollArea`

## 8. Page header pattern

Reusable `PageHeader` เรียง: Breadcrumb → title/description → optional status/priority → updated metadata → actions Primary อยู่ขวา desktop และเต็มความกว้าง/ท้ายกลุ่มบน mobile; action เกิน 2 รายการเข้า `DropdownMenu`

| Page | Title/context | Primary | Secondary |
|---|---|---|---|
| Work Orders | count/view/site/date context | Create work order เมื่อ permission รองรับ | Export, saved views |
| Assets | active site + asset count | Register asset | Import/export, hierarchy |
| Preventive Maintenance | plan count + generation state | Create PM plan | Calendar, bulk generate |
| Inventory | warehouse + stock alerts | Add spare part | Movement, export |
| Reports | period/site/filter summary | Run report | Save/export |
| Administration | managed account count | Create user | Login history, audit |

## 9. Dashboard design

Current `/` เป็น public landing ไม่ใช่ operational dashboard ดังนั้น dashboard เป็น future recommendation จนมี route/API ที่รองรับ

- Filter bar: date range, site, department, asset, status; แสดง active filter chips และ clear all
- KPI 4–6 ใบ: value + period/context + comparison + accessible trend text ไม่ใช้ตัวเลขลอย ๆ
- Operational row: work order status stacked bar/donutเพียงหนึ่งแบบ, priority breakdown, overdue/action-required table
- Planning row: PM due/missed และ asset downtime; business dataพร้อมก่อนจึงแสดง
- Cost trendใช้ line/bar chartพร้อม units, legend และ tabular tooltip; recent activityใช้ timeline/table
- critical/action-required อยู่เหนือ general charts; ห้ามใช้สี critical กับ decorative metric
- แนะนำ shadcn `Card`, `Tabs`, `Table`, `Badge`, `Skeleton`, `Tooltip` และ Recharts/shadcn Charts หลังเพิ่ม dependency

## 10. Data table standard

สร้างบน TanStack Table + shadcn `Table`

- toolbar: search 280–360 px, primary filters, active chips, view selector, column visibility, export
- sticky header ใน bounded scroll container; sorting ผ่าน button พร้อม `aria-sort`; server pagination เมื่อ dataset ใหญ่
- checkbox selection เฉพาะเมื่อมี bulk action ที่ปลอดภัย; bulk bar sticky และบอกจำนวนที่เลือก
- row click เปิด detail ได้ แต่ link หลัก/เมนูยัง keyboard accessible; secondary actionอยู่ `DropdownMenu`
- loading ใช้ skeleton ตามจำนวน row; empty แยก zero-data กับ no-results; error มี reason + retry
- saved views ใช้เมื่อ backend/persistence พร้อมเท่านั้น; export ต้องเคารพ filter, permission และ audit requirement
- mobile ใช้ prioritized card rows; horizontal scroll เป็น fallback และต้องมี hint

Work order columns คงไว้: Number, Title, Asset, Site, Type, Priority, Status, Assigned To, Due Date, Updated At, Actions บน laptopซ่อน Type/Site/Updated ก่อน; mobile cardต้องเห็น Number, Title, Asset, Priority, Status, Assignee, Due

## 11. Form design standard

- React Hook Form + Zod เป็น standard; reuse server-compatible schemas เมื่อเหมาะสมและยัง validate server-side เสมอ
- label อยู่เหนือ control, `*` + “จำเป็น” legend อธิบาย required; helper ไม่ใช้ placeholder แทน label
- error ใต้ fieldและ summary ด้านบนเมื่อหลาย error; focus field แรกหลัง submit
- native date/time ต้องแสดง timezone; desktopใช้ Calendar/Popover + time input, mobileเลือก native picker ได้
- Select ใช้รายการสั้น; Combobox สำหรับ asset/employee/location; Multi-select แสดง chips + count
- Textarea มี character count เมื่อมี max length; file uploadระบุชนิด/ขนาด/จำนวนก่อนเลือก
- Asset selectorแสดง code, name, location, status; employeeแสดง name, role/team, availability; locationแสดง hierarchy
- form ยาวแบ่ง `FormSection`; 2 columns เฉพาะ related fields; sticky action barมี Cancel, Save draft (เมื่อ domainรองรับ), Submit
- Tabs ใช้กลุ่ม peer sections ที่ผู้ใช้สลับดู; Accordion ใช้ optional/advanced; Stepper ใช้ sequential create flow ≥3 ขั้นที่ validate แยก; Sheet ใช้ quick edit; Dialog ใช้ formสั้น ≤5 fields; dedicated page ใช้ complex form
- Current notification/asset fieldsทั้งหมดต้องคงไว้: code, name, description, type/category, location, criticality, owner; asset, title, type, priority, supervisor, due date, description, breakdown

## 12. Work order UX

### 12.1 Current controlled flow

`Asset → Notification (NEW) → Review (APPROVED/BACKLOG/REJECTED) → Work Order (OPEN/BACKLOG) → Start → IN_PROGRESS → Tasks + execution → Completion submission → COMPLETION_PENDING → Supervisor VERIFIED or RETURNED to IN_PROGRESS → VERIFIED → Close → CLOSED`

ห้ามทำให้ step rail แสดง BACKLOG เป็น OPEN โดยไม่ label เสริมแบบ current; ให้แสดง stateจริงพร้อม next action Current rules: reviewได้ครั้งเดียวเมื่อ NEW, required tasksต้อง completed ก่อน completion, workไม่มี taskทำ completionได้, returnedย้อนสู่ IN_PROGRESS, closeได้หลัง VERIFIED

### 12.2 Request and order creation

- “แจ้งซ่อม” ใช้ dedicated pageหรือ Sheet เฉพาะ flowสั้น; asset contextอยู่บนสุดและ breakdown toggleทำให้ warningเด่น
- review queue เปิด detail Sheet เพื่ออ่าน description/attachment ก่อนตัดสินใจ; decision formแสดง conditional requirements เช่น assigneeไม่จำเป็นเมื่อ reject ตาม current UI
- Approved/backlog ที่สร้าง work orderอัตโนมัติต้องแจ้งเลขงานและ deep link; ห้ามเสนอ formสร้างซ้ำถ้า business ruleยังไม่มี manual work order

### 12.3 Work order detail

Headerแสดง code/title, status, priority, asset, assignee, due, updated และ contextual primary action Detail sections/tabs: Overview, Tasks, Labor/Execution, Materials, Attachments, Comments, Activity, Approvals; Audit tabเฉพาะผู้มีสิทธิ์

Current execution fieldต้องคง: action description, minutes spent, action time Current completionต้องคง: result, problem, cause, solution, escalation, duration Current verificationต้องคง: decision `VERIFIED/RETURNED`, note และ completion reference Current closeต้องคง closure note

- task action inlineได้; เพิ่ม/แก้ taskใช้ Sheet
- laborใช้ structured row: employee, date/time, hours/minutes, work description; current execution logยังเป็น canonical จน schemaขยาย
- materials/spare parts, attachments, comments, cancel และ reopen เป็น future UX จน API/domainรองรับ; อย่า render active controlsก่อน capabilityพร้อม
- completion actionอยู่ sticky footerและdisabledพร้อมเหตุผลถ้า required taskยังไม่ครบ
- cancel/reopen หากเพิ่มภายหลังต้องมี transition, permission, reason, audit และ notification ที่รับรองก่อน UI

## 13. Asset management UX

Current asset registerมี code, name, description, type, category, location, criticality, status, owner

- List: table + hierarchy toggle; filter site/type/category/criticality/status; QR scan shortcutบน mobileเมื่อ capabilityพร้อม
- Detail header: code/name/status/criticality + location path + owner
- Tabs: Overview, Hierarchy, Maintenance history, Documents, Spare parts, Downtime, Cost, Audit
- Overviewแสดง identity, parent/child, location, warranty และ key condition; unknown fieldsไม่สร้าง UI จน modelรองรับ
- treeใช้ expandable hierarchy + breadcrumb; ห้ามแทน hierarchyด้วย card gridจำนวนมาก
- QR/barcodeต้องมี human-readable code, print size, scan failure recovery และ permission-safe deep link
- Current routeมีเพียง tabภายใน `/maintenance`; target refactorควรแยก `/maintenance/assets` และ `/maintenance/assets/[id]` โดยคง business behavior

## 14. Preventive maintenance UX

โมดูล PM ยังไม่มี page/API ใน current project จึงเป็น future recommendation

- Plan list: code/name, asset scope, frequency, next due, active, generated WO status
- Plan detail: schedule rule, timezone, tolerance window, checklist, parts, labor estimate, assets และ generation history
- รองรับ listเป็น operational default และ calendarเป็น planning view; calendar eventมี text/status ไม่ใช้สีอย่างเดียว
- missed scheduleเด่นใน action-required; bulk generationมี preview, duplicate prevention, result summary และ audit
- frequency builderใช้ plain-language preview เช่น “ทุก 3 เดือน วันที่ 1 เวลา 08:00 Asia/Bangkok”

## 15. Inventory and spare parts UX

Inventory ยังไม่มี page/API ใน current project; ใน work order materialsก็ยังไม่มี implementation จึงเป็น future recommendation

- List: part number, description, warehouse/bin, on-hand, reserved, available, on-order, minimum, reorder state
- `Available = on-hand - reserved` ต้องมาจาก domain service ไม่คำนวณต่างกันแต่ละหน้า
- Stock badges: Available green-neutral, Reserved blue, On order cyan, Below minimum amber, Out of stock red
- Movement ledgerเป็น append-only table: type, quantity, UOM, source/destination, WO, actor, timestamp, note
- issue/return/reserveใช้ focused Dialog/Sheet พร้อม part lookup, available balance, quantity/UOM validation และ confirmation summary
- adjustmentเป็น privileged destructive-equivalent action ต้องมี reason, before/after, audit

## 16. Status, priority, and badges

สร้าง `StatusBadge` และ `PriorityBadge` จาก centralized maps; labelต้องใช้ casing เดียวกันทั่วระบบและรองรับ Thai translationในอนาคต

| Priority | Style | Rule |
|---|---|---|
| Low | slate outline | ไม่แย่งความสนใจ |
| Medium | blue soft | default |
| High | amber | icon `TriangleAlert` optional |
| Critical | red filled/strong outline | ห้าม flash/pulse; แสดง textเสมอ |

Badge tableสูง 22–24 px; detailสูง 26–28 px Completed/Closedใช้ green soft ไม่เด่นกว่า Critical/Overdue แยก “priority” ออกจาก “status” และแยก “overdue” เป็น derived indicatorข้าง due date

## 17. Dialog, sheet, and drawer rules

| Primitive | ใช้เมื่อ | ตัวอย่าง MA |
|---|---|---|
| AlertDialog | actionเสี่ยง/ทำลาย/กระทบ session | lock/disable user, revoke sessions, reset password, cancel future WO |
| Dialog | confirmationหรือ formสั้น | quick status update, mark notification read |
| Sheet | detail/quick editโดยคง list context | notification review detail, asset quick view, table row detail |
| Drawer | bottom interactionบน mobile | mobile filters, quick actions |
| Popover | contextเล็กและไม่ destructive | date picker, column chooser |
| DropdownMenu | secondary row/page actions | open, copy link, export row |

Complex formsไม่อยู่ Dialog Browser `window.confirm` ใน user detailต้องเปลี่ยนเป็น AlertDialog ระหว่าง implementation แต่ action/APIเดิมคงเดิม Focusต้องถูก trap/restore และ close reasonชัดเจน

## 18. Feedback states

- Toast (`Sonner`) ใช้ผลลัพธ์ชั่วคราว เช่น saved/marked read; inline bannerใช้ errorที่ต้องอ่าน/แก้
- Pending buttonแสดง spinner + verb (“กำลังบันทึก…”) และ disable duplicate submit; optimistic updateเฉพาะ reversible low-risk actions
- validationระบุ fieldและวิธีแก้ ไม่แสดง “Invalid form” อย่างเดียว
- page loadingใช้ skeletonตาม layout; background refreshไม่ล้าง contentเดิม
- errorบอก operation/record/retry; no permissionใช้ `ResultState` พร้อมทางกลับ/ขอสิทธิ์
- offline/network failureเก็บ form dataในหน้าและให้ retry; ห้ามบอกว่าสำเร็จจน serverตอบ
- unsaved changesเตือนก่อน navigation/scope change; concurrent conflict (409) แสดง updated-by/time และตัวเลือก reload/copy changes
- successของ workflowระบุ stateใหม่และ next step เช่น “WO-001 ส่งให้หัวหน้าตรวจแล้ว”

## 19. Empty states

| State | Message/action |
|---|---|
| No work orders | อธิบายว่างานจะมาจาก notification ที่อนุมัติ; linkไป review/reportตามสิทธิ์ |
| No assets | “ยังไม่มี asset ที่ใช้งาน”; Register asset หากมีสิทธิ์ |
| No search results | แสดง query/filter chips; Clear filters |
| No assigned work | บอก scope/date; View all permitted work |
| No PM schedule | ระบุว่า PM ยังไม่ถูกตั้งค่า; Create planเมื่อ moduleพร้อม |
| No inventory movement | อธิบายว่าประวัติจะเกิดหลัง issue/receive/adjust |
| No permission | บอกชื่อ capabilityและทางกลับ; ไม่เปิดเผยข้อมูลลับ |
| Dashboard no data | แสดง filter rangeและ setup prerequisite; ไม่แสดง KPIเป็น 0 ที่ทำให้เข้าใจผิด |

Empty stateมี iconเดียว, title, explanationไม่เกิน 2 บรรทัด และ actionไม่เกิน 2 รายการ

## 20. Accessibility

- WCAG 2.2 AA: text contrast ≥4.5:1, large text/UI ≥3:1
- ทุก actionใช้ keyboardได้; skip linkไป `main`; focus ring 2–3 px ไม่ถูกตัดด้วย overflow
- `html lang` ต้องสะท้อนภาษา UI; current `en` ต้องปรับเมื่อ UIไทยเป็นหลักหรือใช้ localized routing
- inputมี `label`/`aria-describedby`; error `role=alert` หรือ live regionเหมาะสม
- icon-only buttonมี `aria-label`; Tooltipเป็นคำช่วยไม่ใช่ชื่อที่ screen readerขาดไม่ได้
- Dialog/Sheetมี title/description, initial focus, Escape behaviorและ focus return
- tableใช้ caption/semantic header/`aria-sort`; responsive cardsยังรักษา label-value semantics
- touch targetอย่างน้อย 44×44; dragไม่เป็น interactionเดียว; animationเคารพ `prefers-reduced-motion`
- status/priorityไม่พึ่งสี; chartมี text summary/table alternative

## 21. Responsive behavior

| Component | Desktop/laptop | Tablet | Mobile |
|---|---|---|---|
| Sidebar | expanded/collapsed fixed | collapsed railหรือ Sheet | Sheetจาก hamburger |
| Page header | title + right actions | wrap 2 rows | stacked; primary full widthหรือ bottom bar |
| Tables | full selected columns | hide optional columns | cardsหรือ controlled horizontal scroll |
| Filters | inline toolbar | wrap/Sheet advanced | Drawer + active chips |
| Forms | 1–2 columns | mostly 1 column | 1 column; sticky bottom actions |
| KPI cards | 4 columns | 2 columns | horizontal snapหรือ 1 column |
| Charts | 2 columns | 1 column | simplified height + summary |
| Tabs | horizontal | scrollable | scrollable/dropdownเมื่อมาก |
| Dialog/Sheet | centered/side | side | Drawer/full-height Sheet |

Mobile priorityคือ view, approve/review, status update, execution quick entry, notification report และ image attachment Primary actionต้องอยู่ใน thumb reach; workflow stepperย่อเป็น “ขั้น 3 จาก 5” + current/next label ไม่บีบห้าขั้นในแถวเล็ก

## 22. Recommended shadcn components

| Component | Intended use |
|---|---|
| Button | primary/secondary/ghost/destructive actions |
| Card | grouped summary/metric, ไม่ใช้ครอบทุก section |
| Badge | status, priority, role, unread |
| Input / Textarea | text controlsพร้อม Form wrapper |
| Select / Combobox / Command | short list / searchable entity picker |
| Checkbox / Radio Group / Switch | multi choice / one decision / persistent binary setting |
| Tabs / Accordion | peer detail sections / optional advanced sections |
| Breadcrumb | location hierarchy |
| Table / Pagination | enterprise datasets |
| Dropdown Menu / Context Menu | secondary actions; context menuไม่เป็นทางเดียว |
| Dialog / Alert Dialog / Sheet / Drawer | ตามกฎ §17 |
| Popover / Tooltip | date/filters/help |
| Calendar | due/schedule/date range |
| Skeleton / Progress | loading และ measurable long process |
| Separator / Scroll Area | structural separation/controlled regions |
| Avatar | assignee/user identityพร้อม fallback |
| Sonner | transient feedback |
| Form | RHF/Zod form semantics |
| Navigation Menu / Sidebar | public nav / authenticated shell |

Current UI มีเพียง Button, Card, Badge, Input, Label, Dialog, Separator; componentsอื่นในตารางเป็น dependencies/componentsที่ต้องเพิ่มตามลำดับงาน ไม่เพิ่มทั้งหมดล่วงหน้า

## 23. Reusable component inventory

| Component | Responsibility |
|---|---|
| `AppSidebar` | grouped permission-aware navigation, collapse/mobile state |
| `AppHeader` | breadcrumbs, scope, search, notifications, user menu |
| `PageHeader` | title/context/status/actions pattern |
| `PageContainer` | max width/padding/readable layout |
| `SectionHeader` | section title, description, local action |
| `DataTable` | TanStack state, table semantics, pagination |
| `DataTableToolbar` | search, filters, views, columns, export |
| `StatusBadge` | centralized workflow state map |
| `PriorityBadge` | centralized priority map |
| `EmptyState` / `ErrorState` / `LoadingState` | consistent feedback with action/retry |
| `ConfirmDialog` | typed safe confirmation replacing browser confirm |
| `FormSection` | title/description/field grid |
| `FilterBar` / `SearchInput` / `DateRangeFilter` | reusable query controls |
| `SiteSelector` | active scope selector with permission constraints |
| `AssetSelector` | searchable asset identity/status/location |
| `EmployeeSelector` | searchable eligible assignee |
| `FileUploader` | validation, queue, progress, retry, preview |
| `ActivityTimeline` | domain events in chronological context |
| `AuditLogTable` | privileged append-only event view |
| `KPIBlock` / `ChartCard` | value context / chart + accessible summary |
| `DetailField` | consistent label/value, copy and fallback |
| `ResponsiveActionBar` | contextual desktop sticky/mobile bottom actions |
| `WorkflowRail` | true current/previous/next state representation |
| `PermissionBoundary` | action visibility/disabled reason; server remains authority |

## 24. Page templates

### List page

`PageHeader → optional KPI summary → FilterBar → DataTable → Pagination`; bulk barปรากฏเมื่อ selection >0 Loading/empty/errorอยู่ใน table frame ไม่ทำให้ headerกระโดด

### Create and edit page

`PageHeader → validation summary → FormSection(s) → sticky ResponsiveActionBar` Current domainsที่ไม่มี draftต้องไม่แสดง Save draft Cancelต้องเตือน unsaved changes Submit labelต้องสื่อ state เช่น “Submit notification”

### Detail page

`PageHeader + status/priority/actions → summary grid → tabs/grouped sections → related records → ActivityTimeline` actionแปรตาม status + permission และ serverตรวจซ้ำ

### Dashboard page

`Global filters → KPI row → action-required → limited charts → operational tables → recent activity` Filtersต้องสะท้อนใน URL/shareable stateหากไม่เปิดเผยข้อมูล

### Settings page

Settings navigationด้านซ้ายบน desktop/Selectบน mobile → section title → form/list → save state Permission restrictionอยู่ระดับ routeและaction

## 25. UX anti-patterns

- สีหลายระบบใน product เดียว, gradient/glowทุก card, glassmorphism
- whitespaceหรือ heroขนาดใหญ่ใน operational page
- modalสำหรับ formยาว, browser `confirm`, generic “Something went wrong”
- textเล็กกว่า 12 px, icon-onlyไม่มี label, primary actionซ่อนใน kebab
- horizontal formที่ label/fieldอ่านข้ามแถวยาก, หน้า formยาวไม่มี section/sticky actions
- tableโชว์ทุก columnและทุก actionใน row, actionทำลายอยู่ติด normal action
- statusคำ/สีไม่ตรงกัน, Completedเด่นกว่า Critical, dotสีโดยไม่มี text
- hard-coded hex/classตาม module, custom primitiveซ้ำสิ่งที่ shadcnทำได้
- fake dashboard data/hero screenshotที่ดูเป็นข้อมูลจริง
- permission controlเฉพาะ client หรือ disabledโดยไม่บอกเหตุผล

## 26. Migration and implementation strategy

1. Freeze route/action/field/state inventory และเพิ่ม visual regression baseline
2. แทนที่ tokenม่วง/เขียว/blueกระจัดกระจายด้วย MA semantic tokensและ typography โดยยังมี compatibility classes
3. สร้าง approved MA logo assetsและ hero treatment; เปลี่ยน “atlas”/“Atlas Maintain”/“MA Next” ให้เป็น namingที่ product ownerอนุมัติ
4. รวมทุก protected routeรวม `/maintenance` เข้า `AppShell`; ทำ sidebar mobile/collapse/scope
5. สร้าง `PageContainer`, `PageHeader`, feedback states, Status/PriorityBadge
6. สร้าง Form primitives + RHF/Zod pattern และ `ConfirmDialog`
7. สร้าง TanStack `DataTable` และ refactor users/audit/work listsทีละหน้า
8. แยก monolithic `MaintenanceWorkspace` เป็น route-aware list/detail/formsโดยคง APIและ transitionเดิม
9. Refactor work order list, detail, task/execution/completion/verification/closeตามลำดับ
10. Refactor asset/notification, organization, master data, notification center, profile/admin
11. เพิ่ม responsive/mobile operation path, loading/empty/error/no-permission/offline/conflict states
12. เมื่อ domainพร้อมจึงเพิ่ม PM, inventory, dashboard—not before
13. ทำ keyboard/screen-reader/contrast review และ visual consistency review

แต่ละ step deployได้เอง Feature flagsหรือ route-by-route replacementต้องคงระบบใช้งานได้ ห้าม refactor UIพร้อมเปลี่ยน schema/workflowใน releaseเดียว

## 27. Definition of done

หน้าเสร็จเมื่อ:

- ใช้ approved tokens/font/logoและ shared components
- ไม่มี field/action/functionเดิมหายหรือเปลี่ยน semantics
- loading, zero-data, no-results, error, no-permission และ save feedbackครบ
- permission-based actionsตรงกับ serverและมี test
- desktop/tabletสมบูรณ์; mobileรองรับ basic view/actionตาม scope
- keyboardครบ, focusชัด, labels/contrast/dialog/table accessible
- primary/secondary/destructive actionsสม่ำเสมอและป้องกัน double submit
- responsiveไม่มีข้อมูล/status/actionสำคัญหาย
- ไม่มี duplicated patternหรือ scattered hard-coded brand colorใหม่
- workflow/API/database/business rulesเดิมผ่าน regression tests
- visual QAทั้งไทย/อังกฤษ, long content, timezone/date, empty/large datasets

## 28. Page-specific recommendations

### 28.1 Existing routes

| Route | Purpose / main role | Current UX problems | Recommended layout & shadcn | Actions | Responsive | Priority / workflow risk |
|---|---|---|---|---|---|---|
| `/` | Public landing / all visitors | generic dark landing, logoเป็นตัวอักษรกล่อง, ไม่ใช้ภาพแบรนด์อ้างอิง, capability copyปน product foundation | MA split hero §3.3 + capability proof strip; `Button`, `Card` จำกัด | Sign in/Open maintenance; secondary capability linksเมื่อ signed in | crop heroและซ่อน product previewบน mobile | P2 / Low; ห้ามทำให้เป็น dashboardโดยไม่มี data |
| `/login` | Authentication / all users | “atlas”, “AI dashboard builder”, analytics copyและม่วงไม่ตรง maintenance; custom controls | MA logo + industrial hero, compact auth card; shadcn `Form`, `Input`, `Checkbox`, `Button`, `Alert` | Sign in | visualลดรูป; formเต็มจอ, keyboard-safe | P0 / Medium; preserve remember-me, errors, redirect |
| `/change-password` | Forced/user password update / authenticated user | custom CSS, current-password optional ruleไม่เด่น, no pending state | centered security form, password requirements checklist; `Form`, `Input`, `Alert`, `Button` | Update password; cancelเฉพาะ flowอนุญาต | single column | P1 / High; preserve temporary-password exceptionและ redirect |
| `/maintenance` | Asset, notification review, work pipeline / viewer through adminตาม permission | shellแยกสีเขียว, monolithic tabs, client role aliases, no URL per tab/detail, dense inline forms, status railไม่แสดง BACKLOGจริง | เข้า AppShell; interim routeยังคง tabแต่ใช้ `Tabs`, `DataTable`, `Sheet`, `Form`, `WorkflowRail`; ระยะถัดไปแยก routes §28.2 | Report notification; New assetตามสิทธิ์; contextual start/complete/verify/close | list→detail stack, mobile bottom action, compact progress | P0 / Very high; ทุก field/transitionต้อง regression test |
| `/organization` | Manage/view organization/site/department / admin manage, others view | create formsสามใบพร้อมกัน, view-only userอาจเห็น controls, no hierarchy, generic select | hierarchy/list + permission-aware create Sheet/dedicated form; `Tree` pattern, `Card`, `Sheet`, `Form`, `Combobox` | Create entityตาม permission | one-column hierarchy, forms full-height Sheet | P2 / High; preserve parent/site scopingและ manage permission |
| `/notifications` | Personal operational inbox / authenticated viewer | cardหนึ่งใบต่อ itemขยายยาว, filter/unread groupingไม่มี, mark-read feedbackจำกัด | Inbox list/table + unread/all tabs + detail Sheet; `Tabs`, `Badge`, `Button`, `Skeleton`, `Sheet` | Open related record; Mark read | compact stacked rows | P1 / Medium; preserve recipient status/action URL |
| `/profile` | Account summary / authenticated user | อยู่ใน simple cardแคบ, query forbiddenไม่มี friendly state, roleเป็น raw alias | standard PageHeader + account sections; `Avatar`, `Card`, `Badge`, `Alert` | Security & sessions | single column | P3 / Low |
| `/profile/security` | Sessions and login history / authenticated user | custom record list, revokeไม่มี confirmation/pending/errorครบ, device iconเป็น M/D | active sessions cards + login table; `AlertDialog`, `Table`, `Badge`, `Button`, `Skeleton` | Logout other devices; revoke session | session cardsบน mobile | P1 / High; session revocationห้ามยิงซ้ำ/ผิด session |
| `/settings/master-data` | Controlled vocabularies / view/manageตาม permission | create formsอยู่บนสุดแม้ browse, native select, valuesเป็น card grid, permission actionไม่ชัด | types list left + values table right; create/edit Sheet; `DataTable`, `Tabs`, `Form`, `Sheet` | Create type/valueตาม manage permission | stacked master/detail | P2 / High; system typesและ code immutabilityต้องคง |
| `/admin/users` | User list/access / admin | fixed pageSize 100, search submit-only, minimal filter/sort, status badgeไม่ semantic | PageHeader + KPIเล็ก + DataTable; `Input`, `Badge`, `DropdownMenu`, `Pagination`, `Skeleton` | Create user | priority columns/card rows | P1 / Medium; preserve query and server pagination contract |
| `/admin/users/new` | Create account / admin | custom form, role namesมาจาก analytics, error globalอย่างเดียว | dedicated `FormSection`, password guidance, sticky actions; shadcn `Form`, `Select`, `Checkbox`, `Textarea` | Create user; Cancel | single column | P2 / High; preserve all fieldsและ must-change-password |
| `/admin/users/[id]` | Edit/secure account / admin | browser confirm, destructive actionsเป็นแถวเท่ากัน, temporary password copyไม่ปลอดภัยพอ | summary + account/access/security sections; `AlertDialog`, `Form`, `Badge`, `Sonner` | Save; lock/unlock, enable/disable, revoke, resetเป็น secondary/danger | sticky save, destructive sectionท้าย | P1 / Very high; self-action/session/password safeguards |
| `/admin/audit-logs` | Append-only admin audit / admin | custom div listไม่ใช่ table, search only, no filters/pagination/detail | immutable DataTable + actor/action/target/date filters + detail Sheet | Exportเมื่อ permission/APIพร้อม | card rows with essential fields | P2 / High; never imply edit/delete |
| `/admin/login-history` | Authentication events / admin (current layout gates MANAGE_USERS) | custom list, raw statuses, no date/status/IP filters, permissionอาจกว้างเกิน `VIEW_LOGIN_HISTORY` | DataTable + filters + event detail; `Badge`, `Popover`, `Calendar`, `Sheet` | Filter/exportเมื่อรองรับ | compact cards | P2 / High; permission mismatchต้อง confirmก่อน UI change |

### 28.2 Recommended route split for current maintenance functions

นี่เป็น information-architecture refactor ไม่ใช่ moduleใหม่ และต้องคง `/maintenance` redirect/compatibility:

- `/maintenance` — operational overview/work queue
- `/maintenance/assets` และ `/maintenance/assets/[id]` — current register/detail foundation
- `/maintenance/notifications` และ `/maintenance/notifications/new` — current notification list/report
- `/maintenance/notifications/[id]/review` — supervisor review pageหรือ review Sheet deep link
- `/maintenance/work-orders` และ `/maintenance/work-orders/[id]` — current pipeline/detail

PM, inventory, reports และ dashboard routesยังเป็น future; ห้ามสร้าง navigation active itemจน feature, permission และ dataพร้อม

## 29. Suggested file structure

```text
app/
  (public)/
    page.tsx
    login/page.tsx
  (app)/
    layout.tsx
    maintenance/
      page.tsx
      assets/
      notifications/
      work-orders/
    organization/
    notifications/
    settings/
    admin/
    profile/

components/
  ui/                       # generated/adapted shadcn primitives
  layout/
    app-shell.tsx
    app-sidebar.tsx
    app-header.tsx
    page-container.tsx
    page-header.tsx
  navigation/
  data-table/
    data-table.tsx
    data-table-toolbar.tsx
    data-table-pagination.tsx
  forms/
    form-section.tsx
    responsive-action-bar.tsx
    selectors/
  feedback/
    empty-state.tsx
    error-state.tsx
    loading-state.tsx
    confirm-dialog.tsx
  maintenance/
    assets/
    notifications/
    work-orders/
  foundation/
  admin/
  dashboard/                # future only when implemented
  preventive-maintenance/   # future only when implemented
  inventory/                # future only when implemented
  shared/

lib/
  design-tokens/
  constants/
    status.ts
    priority.ts
    navigation.ts
  permissions/              # presentation helpers; server auth stays canonical
  formatters/
  validation/

public/
  brand/
    ma-mark-flat.svg
    ma-mark-flat-dark.svg
    ma-lockup.svg
    ma-hero.webp

docs/
  design.md
```

Route groupsเป็นข้อเสนอ; ก่อนย้ายต้องตรวจ Next.js 16 local docsและ deep links Current service/validation/permission filesยังอยู่ใน `lib` ตาม domain อย่าย้ายพร้อม UIโดยไม่จำเป็น

## 30. Final implementation checklist

- [ ] อ่าน sectionปัจจุบันและ page-specific row ของ route
- [ ] ยืนยัน fields, actions, statuses, permissions, API calls และ transitionsก่อนแก้
- [ ] ระบุ current vs future capability; ไม่แสดง controlที่ backendยังไม่รองรับ
- [ ] ใช้ MA tokens, Noto Sans Thai stack, Lucide และ approved logo variant
- [ ] ใช้ AppShell/PageContainer/PageHeader และ shared shadcn primitive
- [ ] มี primary actionเดียว; secondary/destructive placementถูกต้อง
- [ ] ใช้ centralized StatusBadge/PriorityBadgeและไม่พึ่งสีอย่างเดียว
- [ ] formมี label/helper/field error/pending/double-submit guard/unsaved warning
- [ ] destructive/high-impact actionใช้ AlertDialogพร้อม recordและผลกระทบ
- [ ] tableมี search/filter/sort/paginationตาม dataset พร้อม mobile alternative
- [ ] loading, empty, no-results, error, no-permission, offline และ retryได้รับการออกแบบ
- [ ] desktop 1280, laptop 1024, tablet 768 และ mobile 375 ผ่าน visual QA
- [ ] keyboard, focus, screen reader name, contrast, reduced motionและ touch targetผ่าน
- [ ] ไทย/อังกฤษ, long labels, empty/null, timezone, date, number และ large datasetผ่าน
- [ ] ไม่มี hard-coded brand colorใหม่หรือ custom primitiveซ้ำ shadcn
- [ ] regression testsยืนยัน business rules/API/database/workflowไม่เปลี่ยน
- [ ] visual reviewยืนยัน operational pagesไม่มี hero/glow/gradientรบกวน
- [ ] product ownerอนุมัติ MA master logo, hero rights และ namingก่อนนำ assetขึ้น production

## Dependency and consistency notes

รายการนี้เป็น implementation prerequisite ไม่ใช่การอนุมัติให้ติดตั้งในงานเอกสารนี้:

- มี `components.json`, Tailwind CSS 4, Lucide, RHF, Zod และ shadcn primitivesพื้นฐานแล้ว
- ยังไม่มี TanStack Table; ต้องเพิ่ม `@tanstack/react-table` ก่อน DataTable standard
- ยังไม่มี chart packageที่เห็นใน `package.json`; ใช้ Recharts/shadcn Chartsเมื่อ dashboardจริงพร้อม
- shadcn primitivesที่ยังขาดตามแผน: AlertDialog, Sheet, Drawer, Popover, Tooltip, Tabs, Accordion, Select, Checkbox, Radio Group, Switch, Textarea, Calendar, Command, Skeleton, Progress, ScrollArea, Avatar, Form, Pagination, Sonner, Navigation/Sidebar
- native/custom `<select>`, `<button>`, table, modal, toast และ browser confirmยังปะปนกับ shadcn ต้อง migrateทีละ pattern
- Tahoma local fontรองรับปัจจุบัน แต่ font familyที่เสนอคือ Noto Sans Thai; ต้องกำหนดวิธี self-host/licensing/performanceก่อนเปลี่ยน
- `app/globals.css` มี tokenม่วง, maintenanceเขียว และ slate/blue utilityพร้อมกัน ต้อง consolidateโดยมี compatibility window
- role labels `DASHBOARD_CREATOR` และ `DATA_SOURCE_CREATOR` ไม่สอดคล้อง maintenance persona แต่เป็น business/auth identifiersปัจจุบัน ห้าม renameจากงาน UI; แสดง friendly labelได้ผ่าน approved map
