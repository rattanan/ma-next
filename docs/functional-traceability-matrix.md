# Functional traceability matrix

This matrix is the migration backlog index. Evidence paths are relative to `aes02/`. Priority is suggested sequencing, not business criticality.

| ID | Capability | Legacy evidence | Data | Key acceptance behavior | Suggested phase |
|---|---|---|---|---|---|
| IAM-01 | Browser login/logout | `controllers/SiteController.php`, `components/Password.php` | `user`, `user_profiles`, `user_password`, `sys_log_details` | Enabled user can log in; failures lock per policy; expiry forces password change; logout audited | Existing target foundation; reconcile first |
| IAM-02 | RBAC/menu | mdm dependency, `models/AuthItem.php`, `AuthAssignment.php`, `Menu.php` | `auth_*`, `menu` | Permissions restrict routes/actions and menu reflects grants | Phase 0 |
| IAM-03 | API key/token auth | `components/auth.php`, `modules/api/controllers/IdentityController.php` | `sys_api_keys`, `sys_api_tokens` | Key gates identity; token expires/disables; API methods enforced | Later/API |
| AST-01 | Asset register | `controllers/Asast010Controller.php`, `models/Asast010.php`, `views/asast010/` | `asast010/011/012/020` | CRUD/search, ownership/status, images/attachments, category/type | Phase 1 candidate |
| AST-02 | Asset hierarchy/BOM | `Asast010Controller` tree/diagram, `Asbom010`, `Asbom020` | `asbom010/020` | Parent/tree structure and stock BOM render consistently | Phase 1 |
| AST-03 | Asset config/contracts/meters | `Ascnf*`, `Ascnt*`, `Asmet*` | `ascnf*`, `ascnt*`, `asmet*` | Config values, contract links, meter/tag conditions | Phase 2 |
| NTF-01 | Maintenance notification | `controllers/Wonof010Controller.php`, `models/Wonof010.php` | `wonof010/011/012/020` | Create with defaults/image; duplicate warning; notify manager; approve/reject | Implemented in CM slice; DEV migration pending |
| WO-01 | Work-order aggregate | `controllers/Woord010Controller.php`, `models/Woord010.php`, `views/woord010/` | `woord010/011/012` | Search/filter/sort/paginate; manual and approved-notification creation; assignment/source/status ownership | Implemented in dedicated Work Order module; migration 0004 deployed to DEV |
| WO-02 | Work planning/execution | `Woord020/021/050/051/052/060`, `Woman010` | corresponding tables | Steps/checklists/tools/backlog/acceptance/parts/labor attach to WO; required steps complete before submission | Implemented with append-only events, material adapter boundary and responsive execution UI; exact inventory/OT legacy rules need confirmation |
| WO-03 | Work completion | `controllers/Woord030Controller.php`, `models/Woord030.php` | `woord030`, cause/problem/solution/escalation | Photo-supported completion, authorized supervisor verify/return, command-only closure and history | Implemented and deployed to DEV; legacy print signature layout needs acceptance |
| WO-04 | PM generation | `Wopvm*`, `commands/GeneventController.php` | `wopvm*`, `asast030`, `woord*` | Due schedule creates one work order/event notification and acknowledges source | Phase 3 |
| WO-05 | Work import | `Woimp010Controller`, `components/importwo.php`, `commands/ImportController.php` | `woimp010`, asset/work tables | Parse source file, map statuses/master data, provide truthful per-row result | Later |
| ALM-01 | Issue configuration | `Amisu*Controller`, `models/Amisu*.php` | `amisu*` | Define issue/condition/cause/action/limits/effects; approval controls eligibility | Phase 4 |
| ALM-02 | Alarm runtime | `components/alarm.php`, `commands/AlarmController.php` | `amtrg*`, `amlog010`, telemetry | In-window approved rules detect problem, infer details, log recovery, avoid duplicate active trigger | Phase 4 |
| ALM-03 | Acknowledge/monitor | `Amtrg010Controller`, `modules/portal/controllers/AlarmController.php` | `amtrg010/020` | Operator sees active alarms and acknowledgment is auditable | Phase 4 |
| ALM-04 | Issue import | `components/importissue.php`, `Amimp010Controller` | `amimp*`, `amisu*`, tags | Preview/validate and atomically replace/import configuration | Later after redesign |
| INV-01 | Item/location masters | `Whitm010/011/012Controller`, models/views | `whitm010/011/012`, vendors | Searchable item/location/classification; stock thresholds | Phase 3 |
| INV-02 | On-hand and ledger | `components/inventory.php`, `Whinv010/020` | `whinv010/020` | Every posting creates ledger and consistent item/location quantity/value | Phase 3 |
| INV-03 | Issue | `Whitm030/032`, `approvelist`, `inventory::issue` | `whitm030/031/032`, approval, ledger | Approval; prevent shortage; FIFO-like lot costing; atomic post | Phase 3 |
| INV-04 | Receipt | `Whitm040/042`, `inventory::receive` | `whitm040/041/042`, PO, ledger | Post receipt, update PO quantities/status, notify waiting WO users | Phase 3 |
| INV-05 | Transfer | `Whitm050/052`, `inventory::transfer` | `whitm050/051/052`, ledger | Validate source and atomically post paired movements | Phase 3 |
| INV-06 | Stock classification | `commands/InventoryController.php`, `inventory::calStatus` | `whinv010/020`, `whitm010` | Reorder/excess plus slow/fast/expired results match approved rules | Phase 3 |
| APR-01 | Approval configuration | `SysApprovesController`, `models/SysApproves.php` | `sys_approves` | Ordered approvers and conditions configured safely | Phase 2/3 prerequisite |
| APR-02 | Approval execution/history | `components/approvelist.php`, `SysApproveDetailsController` | `sys_approve_details/history`, notifications | Waiting/on-hold sequence, decision, notification, immutable history, atomic domain callback | Phase 2/3 prerequisite |
| PR-01 | Purchase request | `Puprd010Controller`, `purchaseRules.php` | `puprd010/011/020/030/040`, budget | Positive lines, converted totals, budget/purchase rules, release/approval/PDF | Phase 3 |
| PO-01 | Purchase order | `Pupod010Controller` | `pupod010/011/012/020/030`, PR | Copy from PR, amount cap, approval, receive tracking, PDF | Phase 3 |
| FIN-01 | Cost/budget masters | `Fnact*` models/controllers | `fnact*` | Budget, pending, expense and balance calculations are reproducible | Phase 2/3 |
| OPS-01 | Tag registry/key-in | `Optag*` | `optag*`, telemetry `Tag` | Tag mapping/grouping/manual values | Phase 4 |
| OPS-02 | Dashboard/graphics/trends | `Opdas*`, `Opgrp*`, `Optrd*`, portal dashboard/stream | `op*`, telemetry | Configured charts and live/history streams match representative dashboards | Phase 4 |
| PJ-01 | Projects/tasks | `Pjprj010/020Controller` | `pjprj*` | Hierarchy, activities/subtasks, status, board/Gantt, milestones/files/comments | Later |
| CRM-01 | Customer/order API | `modules/api/controllers/CustomerController.php`, `OrderController.php`, `OrderdetailController.php` | `slcus*`, `seord*` | Authenticated CRUD, line-total recalculation, status change, PDF | Later |
| HR-01 | HR masters/profile | `Hr*Controller`, `UserProfilesController` | `hr*`, `user_profiles` | Profile/department/position/status and HR records | Later |
| HR-02 | Employee request | `Hrreq010Controller`, `components/hr.php` | `hrreq010`, surveys/approval | Request approval and completion processing | Later |
| SYS-01 | Audit logging | model hooks, `SysLogs`, `SysLogDetails` | `sys_logs/details` | Structured actor/action/before/after log without sensitive fields | Existing target foundation; extend |
| SYS-02 | Notifications | `SysNotifications`, portal/API notification controllers | `sys_notifications` | Create/read/list/delete semantics and deep links | Phase 2 |
| SYS-03 | Reports | `SysReportsController`, portal analytics, print views | `sys_reports/parameters`, domain tables | Parameterized reports reproduce agreed samples | Per module |
| SYS-04 | Files | upload helpers and attachment tables | many attachment tables, `ufile010` | Validate/store/download/delete securely with ownership | Phase 1 foundation |
| SYS-05 | Config/i18n/import/tasks/chat | `Sys*Controller` | corresponding `sys_*` | Migrate only after product confirms active use | Later |

## Traceability gates for every migrated row

Before implementation, each capability needs: sanitized schema/constraints, representative data, actor/permission matrix, status-transition table, validation/error cases, side effects, audit requirements, reports/exports, file behavior, and parity scenarios. A legacy code path is evidence, not automatically the desired specification.

## MA Next foundation implementation — 2026-08-01

| Foundation capability | Implemented evidence | Legacy trace | Verification status |
|---|---|---|---|
| App Router, strict TypeScript, Tailwind and shadcn/ui conventions | `app/`, `tsconfig.json`, `components.json`, `components/ui/` | Platform prerequisite | Lint, typecheck, unit tests, production build |
| Prisma and MariaDB | `prisma/schema.prisma`, `prisma.config.ts`, `prisma/migrations/0001_foundation/` | Sanitized target schema; no production connection | Prisma validate/generate; migration SQL generated from empty schema |
| Authentication, normalized Role and Permission | `lib/auth/session.ts`, `lib/auth/permissions.ts`, `Role`, `Permission`, `UserRole`, `RolePermission` | IAM-01, IAM-02 | Server session and permission checks; legacy role fallback retained during migration |
| Organization, Site, Department | `app/organization/`, `app/api/organizations/`, `app/api/sites/`, `app/api/departments/` | HR-01 and platform scoping prerequisite | Functional directory and Zod-validated audited creation |
| Configurable master data | `app/settings/master-data/`, `app/api/master-data/` | SYS-05 subset | Functional type/value management with uniqueness and audit |
| Audit logging | `lib/audit/service.ts`, existing audit administration | SYS-01 | Actor/request context, masked before/after values, transactional writes |
| Attachment abstraction | `Attachment`, `lib/attachments/`, `app/api/attachments/` | SYS-04 | Driver/storage-key metadata, size validation, server permissions, audit |
| Notification center | `Notification`, `NotificationRecipient`, `app/notifications/`, `app/api/notifications/` | SYS-02 | Per-user inbox, read/archive state, relative deep links, audited mutation |
| Application shell and landing page | `components/shell/`, `app/page.tsx` | Product navigation prerequisite | Responsive sidebar drawer, breadcrumbs, skip link, permission-filtered navigation |
| Global errors and structured logging | `app/error.tsx`, `app/global-error.tsx`, `lib/logger.ts`, `lib/http.ts` | SYS-01 operational support | Recoverable boundaries and credential redaction tests |
| Seed and automated tests | `prisma/seed.ts`, `tests/foundation-*`, `tests/integration/` | Representative local data | Unit suite always runs; integration suite requires disposable `TEST_DATABASE_URL` |

The foundation does not claim parity for deferred domain rows. Attachment storage-provider upload/download mechanics beyond registered metadata remain provider-specific work under SYS-04, and email delivery remains deferred under SYS-02; the in-application notification channel is implemented.
