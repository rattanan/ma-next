# Legacy system overview

## Scope and source assumption

The requested `./legacy-php` path does not exist in the workspace. `./aes02` is the only PHP application and matches the supplied description, so this analysis treats `./aes02` as the read-only legacy reference. No legacy files were changed. All conclusions are static-code observations; no application or database was run.

## What the system is

AES02 identifies itself as **Alarm Expert System**, a web application for monitoring, alarming, maintenance, and related enterprise workflows (`README.md`). It is a Yii 2 Basic application targeting PHP 7 and MySQL, with AdminLTE, Yii RBAC/admin, reporting/export libraries, charts, calendars, QR codes, image processing, and a machine-learning package (`composer.json`).

The code base has:

- 189 top-level web controllers, 189 top-level view directories, and 382 model PHP files. Most business entities have an ActiveRecord model, a search model, a controller, and generated CRUD/print views.
- Three Yii modules: `api`, `portal`, and `logbook`.
- Seven console controllers for alarm evaluation, condition-based maintenance, event generation, HR reset, imports, and inventory classification.
- Shared components for alarms, approval routing, inventory valuation/movement, purchase rules, imports, authentication, passwords, HR processing, notifications, and file operations.
- Three observed database connections: the default application database (`db`), a secondary/metadata connection (`db2`), and a telemetry/time-series connection (`dbx`). Configuration files are not present, so connection topology cannot be confirmed.

## Architectural shape

The application is a server-rendered Yii monolith. Browser routes normally use `index.php?r=<controller>/<action>`. CRUD actions render PHP views and ActiveRecord search models build list filters. The API module returns JSON but still uses Yii controllers and ActiveRecord directly. The portal module provides dashboards, charts, calendar feeds, lookup endpoints, notifications, chat, and live data streams.

Business logic is not confined to one layer:

- controllers set defaults, calculate totals, change statuses, send notifications, and orchestrate child records;
- model `beforeSave`/`beforeDelete` hooks write audit records;
- components implement approval, inventory, alarm inference, import, and password policies;
- console commands execute time-driven processes;
- some views issue queries for analytics;
- API controllers duplicate selected browser workflows.

This distribution is a migration constraint: behavior should be reconstructed as explicit domain services/state transitions, not translated file-for-file.

## Major capability areas

| Area | Legacy identifiers | Purpose |
|---|---|---|
| Alarm expert system | `amimp*`, `amisu*`, `amtrg*`, `amlog010` | Define issues, conditions, causes, actions, limits, evaluate telemetry, record/acknowledge alarms. |
| Asset management | `asast*`, `asbom*`, `ascnf*`, `ascnt*`, `asmet*` | Asset register, hierarchy, categories/types, attachments, configuration, contracts, meters, condition events, stock BOM. |
| Maintenance | `wonof*`, `woord*`, `wopvm*`, `woman010`, `wocau010`, `woprm010`, `wosol010`, `woesc010` | Notifications, work orders, PM programs, job steps, labor, parts, completion, escalation, attachments. |
| Warehouse/inventory | `whitm*`, `whinv*`, `whbom010`, `whvnd*`, `whdlv010` | Stock master, locations, receipt/issue/transfer, inventory ledger/on-hand, vendors, delivery. |
| Procurement | `puprd*`, `pupod*` | Purchase requests/orders, approval, attachments, line items, receipt linkage. |
| Finance | `fnact*`, `fnprd010`, `cmcom020` | Cost centers/elements, expense, budgets, maintenance budgets, currencies. |
| Operations/monitoring | `opdas*`, `opgrp*`, `optrd*`, `optag*`, `opchr010`, telemetry tables | Dashboards, graphics, trends, tags, manual key-ins, live streams. |
| Project management | `pjprj*` | Projects, activities/subtasks, board/Gantt, priorities/statuses, comments, milestones, attachments. |
| Sales/customer/survey | `seord*`, `sepay010`, `slcus*`, `slcal010`, `slsuv*` | Customers, orders, payments, assets, calls, surveys and responses. |
| HR and office | `hr*`, `ofvhc*` | Profiles, departments/positions/status, experience/training/pay, employee requests, vehicle booking. |
| Platform services | `sys_*`, `user*`, `auth_*`, `menu`, `ufile010` | Users/RBAC, API credentials, approvals, logs, reports, configuration, languages, imports, notifications, tasks, chat, files. |

## Authentication, authorization, and auditing

- Browser login uses `mdm\admin` login, then applies profile enablement, failed-attempt lockout, password age, optional complexity, and password-history rules (`SiteController`, `Password`). Login/logout attempts are stored in `sys_log_details`.
- Authorization appears to use Yii RBAC (`auth_item`, `auth_assignment`, `menu`) and the mdm admin package, but the missing web configuration prevents verification of the global access filter and route permissions.
- API bootstrap uses an API key; normal API calls use database-backed expiring tokens. CSRF is disabled for authenticated API controllers.
- Many ActiveRecord models conditionally write insert/update/delete descriptions to `sys_log_details`, controlled by `sys_logs`. Logging coverage is model-specific and includes concatenated attribute values.

## Integration and runtime dependencies

- MySQL application data and information-schema queries through `db`/`db2`.
- Telemetry tables resembling SQL Server (`RealData`, `Tag`, `HourData`, `MinuteData_`) through `dbx`.
- Email via a configured mailer; LINE/SMS/push helpers are present.
- File uploads under the web tree, PDF generation with mPDF, spreadsheet import/export, QR/image processing, chart/dashboard libraries.
- Console scheduling is required for alarms, generated maintenance events, imports, and inventory aging/movement classification, but the actual scheduler configuration is absent.

## Existing target baseline

`ma-next` already contains a Next.js authentication/admin foundation with users, sessions, login history, audit logs, password history, rate limits, profile pages, and admin user/audit screens (`drizzle/0000_phase1_auth.sql`). This is application foundation rather than a migrated maintenance module.

## Analysis coverage

Inspected directory/file inventories across `aes02/controllers`, `models`, `views`, `modules`, `components`, `commands`, `assets`, and `web`; read the project metadata and targeted implementations for authentication, alarm evaluation, notifications/work orders, inventory, procurement, approvals, API behavior, portal analytics/data, and scheduled jobs. Configuration values and credentials were neither available nor copied.

