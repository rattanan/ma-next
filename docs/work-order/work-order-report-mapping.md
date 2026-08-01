# Work Order report and print mapping

## Confirmed outputs

| Report ID | Legacy route/template | Purpose and data | Target output | Status |
|---|---|---|---|---|
| WO-R01 | `woord010/print`, `views/woord010/print.php` | Printable WO register using search/print data provider. | Filter-consistent register print/export. | Baseline confirmed; exact layout/columns `NEEDS_CONFIRMATION`. |
| WO-R02 | `woord010/printview`, `views/woord010/printview.php` | Single WO header/detail. | Versioned WO detail print/PDF. | Baseline confirmed. |
| WO-R03 | `woord010/printtool`, `views/woord010/printtool.php`; related `woord021/print*` | Equipment/tool loan form from WO and related tools. | Equipment loan form with issue/return/signatures. | FDS + template confirmed; storage mapping unclear. |
| WO-R04 | `woord010/printstock`, `views/woord010/printstock.php`; `woord060/printview.php` | Stock/material issue form; template includes checked/approved signature areas. | Goods/material issue document. | Confirmed; inventory transaction linkage unclear. |
| WO-R05 | `woord020/print`, `printview` | Job-step register/detail. | Job card/step print where operationally needed. | Legacy confirmed; future necessity `NEEDS_CONFIRMATION`. |
| WO-R06 | `woord030/print`, `printview` | Completion record and checklist responses. | Completion/verification report. | Confirmed; approval block must align with FDS. |
| WO-R07 | `woord050/print`, `printview` | Work process/stage history. | Workflow timeline print/export. | Confirmed. |
| WO-R08 | `woord051`, `woord070`, `woman010`, `woord060` print/list templates | Supporting documents, attachment list, man-hour and spare-part registers/details. | Detail tabs and optional exports. | Legacy confirmed; exact retained outputs `NEEDS_CONFIRMATION`. |
| WO-R09 | `modules/portal/views/analytics/doc.php` | Open/Backlog/Completed counts, last-30-day volume, top users/assets and recent orders. | Operations dashboard/report. | Query evidence confirmed; metric definitions need correction/confirmation. |
| WO-R10 | FDS §2.2.5 / §4.5 | LOTO/Fast Tag, Log Sheet, Test Result and Hand Over records/forms. | Execution pack documents. | Required by FDS; exact templates/data not found. |

## Print behavior

- Legacy print actions switch to a `print` layout and render HTML in a separate window; no authoritative server-side PDF generator was found.
- Search print uses a dedicated `search_print` provider, so target output must use the same filters and deterministic ordering as the on-screen list.
- Files and images are rendered/referenced from `images/uploads`; target reports must use authorized attachment access, not public raw paths.
- Material/tool forms include manual signature areas. Whether digital approval replaces or supplements those signatures is `NEEDS_CONFIRMATION`.

## Report rules to preserve

- Display the immutable WO number, type, source, asset code/description, priority, status, planning and completion identities/dates.
- Preserve job-step order, checklist question/response/note, labor/OT, materials/quantities/units, expenses/contracts, documents and workflow history as applicable.
- Printed historical reports should use stored transaction/snapshot values, not silently recompute names, prices or instructions from changed master data.
- Apply the same record-scope permissions to view, print and export.
- Audit report generation/download if required by policy; watermark or classification requirements are `NEEDS_CONFIRMATION`.

## Analytics query caveats

Portal analytics contains literal status filters and terminology inconsistencies (`Completed` link can filter `Complete`). Metrics use database `now()` and direct SQL. Define timezone, late/overdue logic, status normalization, cancelled/backlog inclusion and organization/site scope before migration.

## Acceptance baseline

For each confirmed report, compare a representative legacy record and migrated record for fields, totals, order, signatures and attachment references. Business owners must approve any redesigned layout. No report is “migrated” until its query/data contract, permission behavior, printable UX and regression fixture pass.
