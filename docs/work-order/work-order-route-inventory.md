# Work Order route inventory

Status: legacy evidence plus target inventory present at analysis time. Target routes are not declared complete by this document.

## Legacy web routes

Yii routes use `?r=<controller>/<action>`.

| Controller | Routes/actions | Purpose |
|---|---|---|
| `Woord010Controller` | `index`, `open`, `execute`, `closed`, `backlog`, `assigned`, `view`, `create`, `copy`, `convert`, `update`, `delete`, `deleteall`, `print`, `printview`, `printtool`, `printstock` | WO register, source conversion, header CRUD, print forms. |
| `Woord011Controller` | standard CRUD/list/print, `line` | Backlog/status-reason master. |
| `Woord012Controller` | standard CRUD/list/print | Priority master. |
| `Woord020Controller` | `index`, `view`, `create`, `line`, `copy`, `update`, `delete`, `deleteall`, `print`, `printview` | Job steps/sub-work and multi-row entry. |
| `Woord021Controller` | standard CRUD/list/print | Related tool/asset records. |
| `Woord030Controller` | standard CRUD/list/print; `create?id=<wo>` | Completion record plus nested checklist, attachment, labor, material and expense capture. |
| `Woord040Controller` | standard CRUD/list/print | Generic WO files. |
| `Woord050Controller` | `index`, `prepare`, `execute`, `view`, `create`, `copy`, `update`, `delete`, `deleteall`, `print`, `printview` | Stage/process records and stage-specific information. `prepare`/`execute` redirect to create with a status. |
| `Woord051Controller` | standard CRUD/list/print | Typed stage/document information with upload. |
| `Woord052Controller` | standard CRUD/list/print | Stage/document information type master. |
| `Woord060Controller` | standard CRUD/list/print, `addtool` | Spare-part/material rows and alternate tool-entry UI. |
| `Woord070Controller` | standard CRUD/list/print | Work-order attachment/image rows. |
| `Woman010Controller` | standard CRUD/list/print, `createuser` | Man-hour/OT and bulk employee entry. |
| `Wonof010Controller` | `index`, `new`, `mm`, `me`, `mi`, `view`, `approve`, `notapprove`, CRUD/list/print | Notification review and conversion source. |
| `Wopvm010Controller` | `createwo` (observed generator block), other PM CRUD | Generate PM WOs and associated children from events/templates. |
| `Woimp010Controller` | import CRUD/action surface | Upload/import orchestration for WO spreadsheet input. |

Supporting masters: `Wocau010`, `Woprm010`, `Wosol010`, `Woesc010`; expense/inventory/contract links are reached through their own modules.

## Legacy API routes

| Route | Verb | Behavior |
|---|---|---|
| `/api/work/index?tokn=&asto=` | GET | Creator-or-assignee WO list with priority, asset, notification and users. |
| `/api/work/view?tokn=&id=` | GET | Single raw WO model. |
| `/api/work/create?tokn=` | POST | Creates WO, Open stage and assignee notification. |
| `/api/work/update?tokn=` | POST | Updates a WO, including any posted status field. |
| `/api/work/delete?tokn=` | POST | Deletes a WO without the web controller's Completed guard. |
| `/api/work/upload?tokn=` | POST | Generic file upload helper. |
| `/api/notification/approve?tokn=` | POST | Approves notification and attempts WO conversion; contains suspected wrong-ID defects. |
| `/api/workprior/*` | mixed | Work-priority lookup CRUD API. |

All are protected by API-token validity, not a confirmed route-specific RBAC decision.

## Other entry points

- PM/event generation: `Wopvm010Controller` and `commands/GeneventController.php`.
- Bulk import: `components/importwo.php`, invoked by import controller/UI.
- Asset history: `Asast010Controller` queries `woord010` and related job steps.
- Portal analytics: `modules/portal/views/analytics/doc.php` links Open, Backlog and Completed counts and lists.

## Target routes already present before this analysis

| Target route | Method | Current scope | Gap to full baseline |
|---|---|---|---|
| `/maintenance` | GET UI | Corrective flow workspace | Dedicated WO register, full legacy fields, all sources/types, print and mobile execution remain to be assessed. |
| `/api/maintenance/overview` | GET | Combined assets/notifications/WOs reference data | Pagination, complete filters and tenant isolation require confirmation. |
| `/api/maintenance/notifications` | POST | Corrective notification creation | Not a general manual/PM/shutdown WO creation route. |
| `/api/maintenance/notifications/:id/review` | POST | Approve/backlog/reject and conversion | Covers only notification source. |
| `/api/maintenance/work-orders/:id` | GET | Work-order aggregate detail | Does not expose all legacy child entities/fields. |
| `/api/maintenance/work-orders/:id/:action` | POST | `start`, `tasks`, `task-status`, `execution`, `spare-parts`, `completion`, `verification`, `close` | No manual creation, update, assignment/reassignment, backlog/resume, tool loan, execution acceptance, print/export. |
| `/api/attachments/upload` | POST | Notification and before/after photo uploads | General WO document categories and retention rules incomplete. |
| `/api/attachments/:id/content` | GET | Attachment content | Confirm authorization ownership/tenant boundary. |
| `/api/notifications`, `/api/notifications/:id/read` | GET/POST | In-app notifications | Event coverage incomplete. |
| `/api/admin/audit-logs` | GET | Global audit viewer | Work-order-scoped timeline/reporting must be preserved separately. |

## Proposed route families for Phase 3 design

These names are placeholders, not approved implementation decisions: `/work-orders`, `/work-orders/:id`, `/api/work-orders`, `/api/work-orders/:id`, `/api/work-orders/:id/commands/:command`, `/api/work-orders/:id/{assignments,steps,checklist,materials,tools,labor,documents,history,reports}`. Final naming and compatibility aliases are `NEEDS_CONFIRMATION`.
