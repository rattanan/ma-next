# Module inventory

This inventory groups legacy screens and tables into business capabilities. “Observed” means directly named in controllers/views/models; domain boundaries are proposed for migration and are not PHP namespace boundaries.

| Proposed domain | Controllers/entities | Observed capability | Dependencies |
|---|---|---|---|
| Identity and access | `Site`, `UserProfiles`, mdm admin, `Users`, `UserPassword`, `AuthItem`, `AuthAssignment`, `Menu` | Login/logout, profile, roles/menu assignment, password expiry/history/lockout, login audit | HR profile masters, system logs |
| Alarm configuration | `Amisu010`–`Amisu070`, `Amimp010/020` | Issue groups/severity, enablement, conditions, corrective actions, limits, effects, causes, derivatives, regression training, bulk issue import | Tags, users/departments, telemetry |
| Alarm runtime | `Amtrg010`–`Amtrg050`, `Amlog010`, portal `Alarm`, console `Alarm` | Evaluate approved issues against real-time values, infer causes/actions, create triggers/logs, acknowledge active triggers, monitor/summary | Alarm configuration, telemetry, notifications |
| Asset register | `Asast010/011/012/020`, `Asbom010/020` | Asset master/type/category, hierarchy/tree/diagram, image rotation, attachments, asset stock BOM | Locations, contracts, cost centers, users |
| Asset condition/config | `Asast030/031`, `Ascnf010/011/020`, `Asmet010/020` | Events and event types, asset configuration groups/values, metering/conditions | Assets, tags, PM/CBM generation |
| Contracts | `Ascnt010/011/020/030` | Contract register/groups/details/attachments, legal/other list variants | Vendors, assets |
| Maintenance intake | `Wonof010/011/012/020`, API `Notification` | Maintenance notification creation with image, severity/type, manager notification, approval/rejection, job review, conversion to work order | Assets, users, priorities, notifications |
| Work execution | `Woord010/011/012/020/021/030/040/050/051/052/060/070`, `Woman010` | Work-order state lists, assignment, steps/tools, stages/info, labor, spare parts, completion/cause/problem/solution/escalation, attachments and printing | Notifications, assets, inventory, finance, projects, users/vendors |
| Preventive maintenance | `Wopvm010/020/021/022/023`, console `Genevent` | PM programs/projects/tasks/steps/attachments; generate events and work orders by schedule | Assets, work orders, notifications |
| Work-order import | `Woimp010`, `importwo`, console `Import` | Load external work-order CSV files and map status/assets/crew/priority | Work order and master data |
| Inventory | `Whitm010/011/012/020`, `Whinv010/020`, `Whbom010`, `Sparepart` | Item/part classification, locations, freight, on-hand and ledger, stock BOM, spare-part reporting | Procurement, work orders, finance |
| Warehouse documents | `Whitm030/031/032`, `Whitm040/041/042`, `Whitm050/051/052`, `Whdlv010` | Issue, receipt, transfer headers/details/attachments and delivery bills | Approval engine, inventory ledger, PO |
| Vendors | `Whvnd010/020` | Vendors and vendor models | Contracts, stock, procurement |
| Purchase requests | `Puprd010/011/020/030/040` | PR header/type/lines/attachments, comparison details, budget checks, release/approve/cancel, PDFs | Budgets, vendors, currency, approval engine |
| Purchase orders | `Pupod010/011/012/020/030` | PO header/delivery/payment terms/lines/attachments, copy from PR, release/approve/cancel, receipt status | PR, vendors, currency, approvals, receipts |
| Approval engine | `SysApproves`, `SysApproveDetails`, `SysApproveHistory`, component `approvelist` | Per-model sequential approval rules, waiting/on-hold steps, approve/return/reject, history and notifications | Users and each approvable document |
| Finance/budget | `Fnact010/020/021/030/040`, `Fnprd010`, `Cmcom020` | Cost centers/elements, expenses, budgets and balance calculations, maintenance budgets, products/currency | Procurement, work orders, contracts, departments/assets |
| Operations dashboard | `Opdas010/020`, `Opgrp010/011/020/030`, `Opchr010`, portal `Dashboard`, `Stream` | Configurable dashboards/graphics, positions/labels/tags, chart types, presentation and live values | Tags, reports, telemetry |
| Tags and trends | `Optag010/012/013/060`, `Optrd010/020/030`, `RealData`, `Tag`, `HourData`, `MinuteData_` | Tag registry/groups/details/manual key-in, trends and reference lines, real-time/history data | External telemetry database |
| Projects | `Pjprj010`–`Pjprj023` | Project hierarchy, status/priority, activities/subtasks, status update, board/Gantt/data feed, comments, milestones, attachments | Users/assets |
| Customers/orders | `Slcus010/011`, `Seord010/011/020/030/040/050/060`, API customer/order/detail | Customers/types; order header/status/detail/closed/cancel/assets/files and PDF | Province/district, products/assets, payments |
| Payments | `Sepay010` | Payment record and approval | Sales orders, users |
| Surveys/calls | `Slcal010`, `Slsuv010/020/021/022/030` | Call history, survey/question/group/answer/response | Customers/orders/work completion/employee requests |
| HR | `Hrdpt010`, `Hrpos010`, `Hrsta010`, `Hrexp010/020/030`, `Hrpay010/011/020/021`, `Hrreq010` | Department/position/status, experience, training/certificates/plans, pay records/types, employee requests and processing | Users, approvals/surveys |
| Vehicle booking | `Ofvhc010/011/012` | Vehicle booking, objectives, vehicle types | Users |
| Knowledge | `Arart010/011`, `Arcat010` | Articles/categories/attachments and previews | Users/files |
| Reporting and platform | `SysReports`, `SysReportParameters`, `SysCodes`, `SysConfigs`, `SysImport`, `SysLangs`, `SysLangTranslations`, `SysLogs`, `SysLogDetails`, `SysNotifications`, `SysTasks`, `SysChats`, `SysChatDetails`, `Ufile010` | Configurable reports, numbering, settings, import, i18n, audit, notifications, tasks, chat, uploads | Cross-cutting |
| Portal analytics | portal `Analytics`, `Data`, `Default`, `Logs`, `Ml`, `Notifications`, `Tasks`, `UserProfiles` | Maintenance/sales/inventory/process/map/calendar analytics, lookup feeds, files, logs, ML test, notification/task/profile UX | Nearly all domains |
| Mobile/API | API controllers for identity, assets, locations, parts, customers, meters/key-ins, work, notification, orders, vendors, users | Token-authenticated JSON CRUD, uploads, work/notification approval, order PDF/status | Same tables as browser modules |
| Logbook | logbook `Default` | A module shell with an index view; no additional domain behavior found | Unknown |

## Prefix legend

- `am`: alarm management; `as`: asset; `wo`: work/maintenance; `wh`: warehouse; `pu`: purchasing.
- `op`: operations/tag/dashboard; `pj`: project; `fn`: finance; `hr`: human resources.
- `sl`/`se`: customer/survey and sales/order; `sys`: platform services; `cm`: common masters.
- `ar`: articles; `of`: office/vehicle; `tmp`: temporary/reporting staging.

## Generic versus domain-specific surface

Most controllers repeat `index`, `print`, `view`, `printview`, `create`, `copy`, `update`, `delete`, and `deleteall`. These are scaffolding, not separate modules. Domain behavior is signaled by additional actions such as `approve`, `release`, `convert`, `execute`, `ackall`, `createsubtask`, `updatestatus`, inventory movement actions, dashboard feeds, and console jobs.

