# Database inventory

## Evidence and limits

No DDL, database dump, migration history, or application `config` directory is present in the legacy checkout. This inventory is reconstructed from 193 ActiveRecord `tableName()` declarations, relations, rules, and raw SQL. Column types, indexes, foreign keys, triggers, views, row counts, data quality, and engine settings must be verified against a sanitized schema export.

## Connections

| Yii component | Observed use | Confidence |
|---|---|---|
| `db` | Primary transactional MySQL database | High |
| `db2` | Information-schema/table comments, duplicate lookups, spare-part SQL; may be the same server/schema with a different connection | Medium |
| `dbx` | `RealData`, `Tag`, hourly/minute data; SQL uses `TOP` and bracketed identifiers, suggesting SQL Server telemetry | High on separate telemetry role, medium on vendor |

## ActiveRecord tables by domain

### Alarm (20)

`amimp010`, `amimp020`, `amisu010`, `amisu011`, `amisu012`, `amisu013`, `amisu020`, `amisu030`, `amisu031`, `amisu040`, `amisu050`, `amisu060`, `amisu070`, `amlog010`, `amtrg010`, `amtrg020`, `amtrg030`, `amtrg040`, `amtrg041`, `amtrg050`.

Key relationships form issue configuration (`amisu010`) with condition/action/cause/derivative/effected-tag children, then runtime trigger (`amtrg010`) and alarm log (`amlog010`) records.

### Assets, configuration, contracts, metering (17)

`asast010`, `asast011`, `asast012`, `asast020`, `asast030`, `asast031`, `asbom010`, `asbom020`, `ascnf010`, `ascnf011`, `ascnf020`, `ascnt010`, `ascnt011`, `ascnt020`, `ascnt030`, `asmet010`, `asmet020`.

`asast010` is the asset root. `asbom010` is self/hierarchy-oriented; `asbom020` links stock. Events are `asast030`; meter conditions connect assets and tags through `asmet020`.

### Work and maintenance (27)

`wocau010`, `woesc010`, `woimp010`, `woman010`, `wonof010`, `wonof011`, `wonof012`, `wonof020`, `woord010`, `woord011`, `woord012`, `woord020`, `woord021`, `woord030`, `woord040`, `woord050`, `woord051`, `woord052`, `woord060`, `woord070`, `woprm010`, `wopvm010`, `wopvm020`, `wopvm021`, `wopvm022`, `wopvm023`, `wosol010`.

`wonof010` is the maintenance notification/request; `woord010` is the work-order aggregate. Child tables cover steps, tools, completion, attachments, stage/history, typed information, spare parts, and labor. `wopvm*` models preventive-maintenance programs and tasks.

### Warehouse and inventory (20)

`whbom010`, `whdlv010`, `whinv010`, `whinv020`, `whitm010`, `whitm011`, `whitm012`, `whitm020`, `whitm030`, `whitm031`, `whitm032`, `whitm040`, `whitm041`, `whitm042`, `whitm050`, `whitm051`, `whitm052`, `whvnd010`, `whvnd020`, `sparepart`.

`whitm010` is item master, `whitm012` location, `whinv010` on-hand/value per item/location, and `whinv020` the movement/cost ledger. Issue/receipt/transfer use header-attachment-detail triplets (`030/031/032`, `040/041/042`, `050/051/052`).

### Procurement (10)

`puprd010`, `puprd011`, `puprd020`, `puprd030`, `puprd040`, `pupod010`, `pupod011`, `pupod012`, `pupod020`, `pupod030`.

PR and PO each have header and line tables plus attachments. A PO may reference a PR; PO lines track ordered, received, and issued quantities.

### Finance/common (9)

`fnact010`, `fnact020`, `fnact021`, `fnact030`, `fnact040`, `fnprd010`, `cmcom010`, `cmcom011`, `cmcom020`.

These represent cost centers, expenses, cost elements, budgets, maintenance budgets, products, provinces, districts, and currency/rate.

### Operations/telemetry configuration (18)

`opchr010`, `opdas010`, `opdas020`, `opgrp010`, `opgrp011`, `opgrp020`, `opgrp030`, `optag010`, `optag012`, `optag013`, `optag060`, `optrd010`, `optrd020`, `optrd030`, `RealData`, `Tag`, `HourData`, `MinuteData_`.

The four mixed-case tables are explicitly mapped models using `dbx` or telemetry relations. Their case/trailing underscore must be verified on the source server.

### Projects (9)

`pjprj010`, `pjprj011`, `pjprj012`, `pjprj013`, `pjprj014`, `pjprj020`, `pjprj021`, `pjprj022`, `pjprj023`.

Project header/hierarchy, status, priority, files/comments, activities, activity files/comments, and milestones.

### Sales/customer/survey (16)

`seord010`, `seord011`, `seord020`, `seord030`, `seord040`, `seord050`, `seord060`, `sepay010`, `slcal010`, `slcus010`, `slcus011`, `slsuv010`, `slsuv020`, `slsuv021`, `slsuv022`, `slsuv030`.

### HR and office (12)

`hrdpt010`, `hrexp010`, `hrexp020`, `hrexp030`, `hrpay010`, `hrpay011`, `hrpos010`, `hrreq010`, `hrsta010`, `ofvhc010`, `ofvhc011`, `ofvhc012`.

### Platform, security, reporting, and staging (32)

`auth_assignment`, `auth_item`, `menu`, `user`, `user_profiles`, `user_password`, `sys_api_keys`, `sys_api_tokens`, `sys_approve_details`, `sys_approve_history`, `sys_approves`, `sys_chat_details`, `sys_chats`, `sys_codes`, `sys_configs`, `sys_import`, `sys_lang_translations`, `sys_langs`, `sys_log_details`, `sys_logs`, `sys_notifications`, `sys_report_parameters`, `sys_reports`, `sys_tasks`, `ufile010`, `tmpbudget`, `tmpevent`, `tmpgois`, `tmpgorc`, `tmpinv`, `tmpprpo`, `tbl_product`.

`calcu010` has a controller/model/view family but its model does not declare an ActiveRecord table, so it is excluded from the 193-table count.

Yii RBAC commonly also uses `auth_item_child` and `auth_rule`, but they are not represented by local models; their existence is unconfirmed.

### Knowledge (3)

`arart010`, `arart011`, `arcat010`.

## Important aggregate relationships

| Aggregate | Root | Important children/links |
|---|---|---|
| Maintenance notification | `wonof010` | review `wonof020`, asset `asast010`, eventual `woord010` |
| Work order | `woord010` | steps `woord020`, tools `woord021`, completion `woord030`, files `woord040/070`, stage `woord050`, info `woord051`, parts `woord060`, labor `woman010` |
| Stock item | `whitm010` | per-location balance `whinv010`, movements `whinv020`, document lines, vendors/BOM |
| Inventory issue | `whitm030` | attachment `whitm031`, lines `whitm032`, approval records |
| Inventory receipt | `whitm040` | attachment `whitm041`, lines `whitm042`, PO/ledger updates |
| Inventory transfer | `whitm050` | attachment `whitm051`, lines `whitm052`, paired ledger movements |
| Purchase request | `puprd010` | lines `puprd020`, attachments `puprd030`, comparison `puprd040`, approval records, PO link |
| Purchase order | `pupod010` | lines `pupod020`, attachments `pupod030`, PR/currency/vendor/receipt links |
| Approval | dynamic `mdel` + `rcid` | config `sys_approves`, live steps `sys_approve_details`, history `sys_approve_history` |
| Asset | `asast010` | hierarchy/BOM, configurations, meters/events, contracts, work, inventory location |

## Data-model risks for migration

- Many foreign keys are inferred through ActiveRecord rather than available DDL; some code assumes related rows exist and dereferences them without null checks.
- Approval uses a polymorphic table-name string (`mdel`) and dynamic SQL instead of enforced foreign keys.
- Statuses and transaction types are free text, with English and Thai values and inconsistent spellings.
- IDs and codes are often generated from current timestamps; collision and timezone semantics are unverified.
- Audit hooks serialize attribute values into prose rather than a structured change set.
- File fields store names/relative web paths; storage lifecycle, MIME/size rules, and orphan handling are unknown.
- `tmp*` tables appear to be reporting/import staging but retention and ownership are undocumented.
- The target `ma-next` auth schema uses UUID-like strings and normalized audit/session tables, unlike the legacy integer/user-profile layout; identity mapping will need an explicit crosswalk.
