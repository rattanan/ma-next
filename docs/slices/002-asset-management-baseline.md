# Asset Management — first vertical slice baseline

This inventory is the implementation gate for the Asset Management slice. It preserves the behavior evidenced by the legacy PHP application and keeps every `asast010` field. Legacy names are recorded beside target names so migration can be reconciled record by record.

## 1. Legacy PHP references

### Asset register and API

- `aes02/controllers/Asast010Controller.php` — list, category shortcuts (`action1`–`action6`), detail, tree/diagram, create/copy/update/delete/bulk delete, print, primary-image rotation, assignment notifications, dynamic configuration persistence.
- `aes02/models/Asast010.php` — asset fields, validation, relationships, generated code hook, audit hooks.
- `aes02/models/Asast010Search.php` — exact and partial search/filter rules and print query.
- `aes02/views/asast010/index.php`, `_search.php`, `_form.php`, `view.php`, `tree.php`, `diagram.php`, `print.php`, `printview.php` — register, filters, detail, QR, hierarchy, image, print, and category-driven fields.
- `aes02/modules/api/controllers/AssetController.php` — mobile/API CRUD and image upload.
- `aes02/modules/api/controllers/AssettypeController.php`, `AssetcategoryController.php`, `AssetpartController.php` — mobile lookup endpoints.

### Hierarchy, fields, files, parts, contracts, and work

- `aes02/models/Asast011.php`, `Asast012.php` and matching controllers/views — type and category masters.
- `aes02/models/Asbom010.php`, `Asbom020.php` and matching controllers/views — asset-to-asset BOM and asset-to-stock BOM.
- `aes02/views/asast010/_asbom010.php`, `_asbom020.php`, `_whbom010.php` — recursive child assets and expandable spare-part BOM.
- `aes02/models/Ascnf010.php`, `Ascnf011.php`, `Ascnf020.php` and matching controllers/views — category-scoped custom field definitions, ordered groups, and values.
- `aes02/views/asast010/_ascnf020.php` — grouped custom field display.
- `aes02/models/Asast020.php` and matching controller/views; `aes02/views/asast010/_asast020.php` — asset documents and notes.
- `aes02/models/Ascnt010.php` and `aes02/views/ascnt010/_asast010.php` — linked contract.
- `aes02/views/asast010/_woord010.php` and `Asast010Controller::actionView()` union query — work orders directly linked to the asset or through a work-order job/detail.
- `aes02/models/SysLogDetails.php`, `SysLogs.php` and the `Asast010` lifecycle hooks — audit history.
- `aes02/themes/adminlte/layouts/qr.php` and QR generation in `views/asast010/view.php` — QR presentation.
- `aes02/web/images/nneg.20230208.sql` — authoritative legacy table/column/FK evidence and representative values.

## 2. Business rules

1. Asset code/KKS code and name are required. Code is limited to 45 legacy characters, is searched by partial match, and must be unique; when `sys_codes` is configured the generated code supersedes the entered code.
2. Legacy status values are `Active`, `Offline`, and `Reserved`. They remain distinct target statuses. Existing target-only `Inactive` and `Retired` statuses remain supported without rewriting migrated values.
3. The primary image defaults to `nopic.png`; legacy image uploads allow JPEG, JPG, GIF, or PNG up to 5 MB. Detail supports preview and 90-degree rotation in both directions.
4. Legacy documents allow JPEG/JPG/GIF/PNG/PDF/DOC/DOCX/XLS/XLSX/PPT/PPTX/TXT/CSV and retain document name, stored path/name, and note. The effective documented limit is 30 MB even though the legacy error text says 5 MB.
5. Type, category, contract, assigned user, cost center, parent asset, inventory location, created/updated users, and custom-field definition references must resolve when populated.
6. Category controls which custom field definitions apply. Groups are ordered by `ascnf011.orby`; definitions support `string`, `number`, `array`, and `date`, plus placeholder, default, available values, and unit.
7. On legacy update, all existing custom values are replaced with submitted non-empty values for the selected category. The target keeps equivalent round-trip semantics transactionally and retains values during reads even if a definition later becomes inactive.
8. The direct parent (`asast010.asast010_id`) and Asset BOM (`asbom010`) are separate legacy relationships. The target uses direct parent for the canonical System → Equipment → Component tree and preserves BOM sequence, root, enabled, quantity, and note independently.
9. Every accessible asset appears once in the canonical hierarchy. Orphans remain visible as roots. Cycles are rejected by target validation because the legacy has no reliable cycle guard.
10. Asset-to-stock links preserve sequence, enabled flag, required quantity, and note. Nested stock BOM remains a spare-part concern and is not flattened into the asset tree.
11. Detail work history is the union of work orders whose header asset is the current asset and work orders with a job/detail linked to it. The target exposes all related target work orders and preserves legacy provenance for migrated rows.
12. Create, update, status, hierarchy, custom-field, attachment, and delete/archive operations are audited with actor and timestamp. History is ordered newest first and is read-only.
13. Legacy hard delete succeeds only when database relationships permit it. This slice exposes non-destructive archive/status behavior; no dependent legacy relationship is silently removed.
14. Creating or updating an assigned asset emits an assignee notification in the legacy application. Notification delivery is retained as a migration rule but is outside this read-focused slice’s mutation UI.
15. QR encodes the canonical absolute asset-detail URL. Mobile users can open a large code, share/copy its link, and invoke the device camera scanner where browser support exists.

## 3. Database mappings

| Legacy mapping | Target mapping | Notes |
| --- | --- | --- |
| `asast010.id` | `assets.legacy_source_id` + UUID `assets.id` | Stable migration identity. |
| `pimg` | `assets.primary_image_path` / `attachments` | Original reference retained; managed image may also be an attachment. |
| `code` | `assets.code` | KKS/asset code; unique and normalized for new records. |
| `name`, `dsca`, `stat` | `assets.name`, `description`, `status` | `Active`, `Offline`, `Reserved` map losslessly. |
| `asast011_id`, `asast012_id` | `assets.asset_type_id`, `asset_category_id` | `asast011` → `asset_types`; `asast012` → `asset_categories`. |
| `ascnt010_id` | `assets.contract_id` → `contracts` | Contract code/name/number, description, contact, dates, amount, terms preserved by contract migration. |
| `asto` | `assets.owner_user_id` | Assigned-to owner. |
| `crdt`, `lmdt`, `crby`, `lmby` | `created_at`, `updated_at`, `created_by`, `updated_by` | Original audit metadata retained. |
| `asast010_id` | `assets.parent_asset_id` | Canonical hierarchy parent. |
| `invl`, `unit`, `trhc`, `idbj`, `sn`, `gpsc` | `maintenance_interval`, `unit`, `running_hour_code`, `budget_id`, `serial_number`, `gps_coordinates` | Direct, nullable preservation. |
| `fnact010_id`, `fnact040_id` | `cost_center_legacy_id`, `budget_reference_legacy_id` | IDs preserved even before finance masters migrate. |
| `whitm012_id` | `inventory_location_legacy_id`, `inventory_location_name` | Legacy ID plus display snapshot. |
| `asbom010` | `asset_hierarchy_links` | Sequence, child, parent, root, enabled, quantity, note. |
| `asbom020` | `asset_spare_parts` | Sequence, asset, spare part, enabled, required quantity, note. |
| `whitm010` | `spare_parts` | Legacy ID, code, name, description, unit, current quantity snapshot. |
| `ascnf011` | `asset_custom_field_groups` | Ordered presentation groups. |
| `ascnf010` | `asset_custom_field_definitions` | Category, group, key/name, label/description, type, placeholder, default, options, unit. |
| `ascnf020` | `asset_custom_field_values` | Asset + definition + string value; typed interpretation comes from definition. |
| `asast020` | `attachments` | `entity_type = ASSET`; original name/storage key/content type/size plus asset-document note. |
| `sys_log_details` | `audit_logs` | `target_type = ASSET`, `target_id = assets.id`. |
| `woord010` / `woord020` | `work_orders.asset_id` and migrated relation provenance | Related work-order tab. |

## 4. Prisma entities

- Existing, extended: `Asset`, `AssetType`, `AssetCategory`, `Attachment`, `AuditLog`, `WorkOrder`, `User`.
- New: `Contract`, `SparePart`, `AssetSparePart`, `AssetHierarchyLink`, `AssetCustomFieldGroup`, `AssetCustomFieldDefinition`, `AssetCustomFieldValue`, `AssetDocumentMetadata`.
- New enum: `AssetStructureLevel` (`SYSTEM`, `EQUIPMENT`, `COMPONENT`) and `AssetCustomFieldType` (`STRING`, `NUMBER`, `ARRAY`, `DATE`).
- Extended enum: `AssetStatus` adds `OFFLINE` and `RESERVED` to the existing target states.

## 5. Routes

| Route | Purpose |
| --- | --- |
| `GET /assets` | Responsive register and searchable hierarchy workspace. |
| `GET /assets/[id]` | Canonical detail URL used by QR codes and deep links. |
| `GET /assets/[id]?tab=general|hierarchy|spare-parts|documents|history|work-orders` | Stable tab deep links. |
| `GET /api/assets` | Search/filter/list/tree payload (`q`, `status`, `type`, `category`, `level`, `parentId`). |
| `GET /api/assets/[id]` | Full asset detail with all tab relationships. |
| `GET /api/assets/[id]/qr` | QR SVG for canonical detail URL. |
| `GET /api/attachments?entityType=ASSET&entityId=:id` | Authorized asset attachment metadata. |
| `POST /api/attachments` | Authorized attachment registration using the shared attachment service. |

The existing `GET/POST /api/maintenance/assets` remains compatible for the corrective-maintenance slice; new asset reads use the dedicated routes.

## 6. Permissions

- `ASSET_READ` — list, search, filter, hierarchy, detail, images, custom values, linked spares/contracts/work orders.
- `ASSET_CREATE` — create asset records (future mutation UI; service-ready permission).
- `ASSET_UPDATE` — edit fields/status/image/assignment/contract (future mutation UI).
- `ASSET_ARCHIVE` — archive rather than silently cascade dependent data.
- `ASSET_HIERARCHY_MANAGE` — change direct parent and BOM links.
- `ASSET_CUSTOM_FIELDS_MANAGE` — manage definitions/groups and asset values.
- `VIEW_ATTACHMENTS` / `MANAGE_ATTACHMENTS` — read/register asset documents through the shared file boundary.
- `VIEW_AUDIT_LOGS` — global audit console; asset users with `ASSET_READ` may see the selected asset’s own history in context.
- Legacy-role fallback: every authenticated role gets `ASSET_READ`; `ADMIN` gets all asset permissions; `DATA_SOURCE_CREATOR` gets create/update/hierarchy/custom-field permissions; the remaining roles are read-only.

## 7. Acceptance tests

1. A search for any substring of code/KKS, name, description, serial number, location, or custom value returns matching assets without case sensitivity.
2. Status, type, category, and System/Equipment/Component filters compose and can be cleared; legacy `Active`, `Offline`, and `Reserved` records remain distinguishable.
3. The hierarchy search retains matching nodes plus their ancestor path; each canonical asset is rendered once, and orphan assets remain selectable roots.
4. Selecting a System, Equipment, or Component updates the clear header, status badge, code, type/category, image, and canonical URL.
5. General displays every legacy `asast010` field, including empty values as an explicit em dash, reorganized into identity, classification/location, maintenance/commercial, and record metadata sections.
6. Category-driven custom fields render in configured group/order with label, value, and unit; all four definition types round-trip without losing the stored legacy string.
7. Hierarchy shows ancestors, selected node, direct children, and preserved BOM metadata; no cycle can be introduced by target validation.
8. Spare Parts shows linked part code/name, enabled state, required quantity, sequence, unit, and note; its empty state is explicit.
9. Documents shows the primary image preview plus allowed attachment metadata and notes; missing images use a stable placeholder, and unsupported previews offer download/open metadata.
10. History is newest-first, read-only, attributable, and includes legacy-created/updated metadata even when there are no detailed audit events.
11. Work Orders lists every directly or indirectly related migrated order with code, title, priority, status, assignee, due/updated dates, and a deep link.
12. Contract displays code/name/number, dates, vendor/contact, amount, terms, and description without dropping nullable legacy fields.
13. QR resolves to `/assets/[id]`, is scannable, has a large mobile presentation, and its link can be copied/shared. Camera scan is offered only when supported and has a permission/error fallback.
14. At 320 px the hierarchy opens in a touch-friendly sheet, tabs horizontally scroll, the detail is single-column, controls meet a 44 px target, and no content requires page-level horizontal scrolling.
15. Loading uses skeletons; zero results, absent tab relations, fetch failure/retry, missing asset, and insufficient permission each have distinct accessible states.
16. API reads return 401 without a session and 403 without `ASSET_READ`; the protected pages never expose asset data before authorization.
17. Schema/validation tests prove the complete legacy field set is accepted and code normalization, status mapping, hierarchy cycles, filter parsing, and custom values behave as documented.
