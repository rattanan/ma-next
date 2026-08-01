# MA Next permission model

## Security objective

MA Next uses deny-by-default, tenant-scoped RBAC with contextual policy checks. Server-side authorization is mandatory for every protected read, mutation, file action, report, job administration action and integration endpoint. Hidden buttons and filtered navigation are not authorization.

The approved discovery did not include production RBAC assignments. This document therefore defines the mechanism and permission vocabulary, not customer role grants.

## Identity separation

- `User` is the authenticated principal and owns sessions/credentials.
- `Employee` represents organizational assignment and maintenance labor identity.
- A User may link to zero or one Employee in Phase 1; an Employee may exist before an account is created.
- Authorization uses User assignments. Business eligibility may additionally require an Employee relationship, department, skill, or assignment.
- Service accounts and integration clients are principals with explicit credential type and scopes; they are not fake employees.

## Authorization model

An authorization decision evaluates:

`principal + permission + tenant + assignment scope + resource context + workflow state → allow/deny`

| Concept | Meaning |
|---|---|
| Permission | stable application capability such as `asset.read` or `work_order.verify` |
| Role | configurable named collection of permissions |
| Assignment | User-to-Role grant within tenant/organization/site/department scope and effective dates |
| Policy | code-owned contextual rule, such as assignee-only execution or current-reviewer approval |
| Resource scope | tenant and organizational coordinates on the target record |
| Decision reason | stable allow/deny code recorded for diagnostics/audit where appropriate |

Permissions are additive. Explicit deny rules are deferred because overlapping deny/allow semantics are operationally difficult; exceptional restrictions should be modeled as contextual policy or account status until approved otherwise.

## Scope hierarchy

Proposed containment is:

`TENANT → ORGANIZATION → SITE → DEPARTMENT`

A grant applies only to resources within its verified scope. Department relationships that are organization-only or span sites must be defined before scope inheritance is implemented. Tenant context comes from a trusted session/host mapping, never an arbitrary request field.

Cross-tenant support access requires a separate, time-bound, reason-recorded elevation flow and must never be implied by a normal tenant role.

## Permission catalog convention

Use `<resource>.<action>` stable codes. Suggested initial catalog:

| Area | Permissions |
|---|---|
| Assets | `asset.read`, `asset.create`, `asset.update`, `asset.archive`, `asset.hierarchy.manage`, `asset.custom_fields.manage` |
| Notifications | `maintenance_notification.read`, `.create`, `.update`, `.review`, `.convert` |
| Work orders | `work_order.read`, `.create`, `.plan`, `.execute`, `.complete`, `.verify`, `.close`, `.reopen`, `.cancel` |
| PM/CBM | `maintenance_program.read`, `.manage`, `.generate`, `condition_rule.manage` |
| Inventory | `inventory.read`, `stock_document.create`, `.submit`, `.approve`, `.post`, `stock_adjustment.create` |
| Commercial | `vendor.read`, `.manage`, `contract.read`, `.manage` |
| Attachments | `attachment.upload`, `.download`, `.delete`; always combined with parent-resource access |
| Reports | `report.<registered_code>.run` or approved category permission |
| Administration | `user.manage`, `role.manage`, `master_data.manage`, `audit.read`, `notification.admin`, `job.admin` |

Stable permission codes can be seeded by the application. Role names, role membership, scope assignments, and translated permission descriptions are configurable. Deleting a permission used by code is prohibited; it may be retired through a controlled release.

## Example role templates, not approved grants

The following are onboarding templates only and must not be seeded as customer authority until the role/action matrix is approved:

| Template | Typical intent |
|---|---|
| Reporter | create/view own or scoped notifications and assets |
| Maintenance planner | review/convert notifications and plan work |
| Technician | view assigned work and record execution |
| Supervisor | complete verification and close within scope |
| Store operator | manage stock documents; posting separation may apply |
| Inventory approver | approve/post inventory documents within scope |
| Asset administrator | maintain asset register/hierarchy/master data |
| Auditor | read audit/workflow/ledger histories without mutation |
| Tenant administrator | manage users, roles and configuration within one tenant |

Separation-of-duties rules—requester versus approver, technician versus verifier, stock creator versus poster—require business approval and must be enforced as policies, not assumed from template names.

## Enforcement points

### Pages and queries

React Server Components call an authorized query service. The service applies tenant and resource filters before querying. It returns `not found` when revealing existence would leak inaccessible records, or `forbidden` when product policy permits disclosure.

### Mutations

Route Handlers and Server Actions:

1. authenticate and resolve tenant;
2. parse Zod input;
3. load the resource within tenant;
4. call `authorize()` with permission and context;
5. execute the application use case;
6. record important successful changes and security-relevant failures.

The use case repeats or owns authorization for calls that may originate from UI, API or worker. Direct repository export to routes is prohibited.

### Background jobs

Jobs run as a named service principal with an allow-listed job capability and tenant scope. A job cannot inherit the privileges of the user who scheduled it. User-triggered work records both initiator and executing service principal.

### Attachments and reports

Attachment access requires both attachment action permission and current access to its parent entity; a presigned URL is short-lived and single-purpose. Reports authorize the registered report and every scope/filter boundary server-side.

## Policy context examples

| Action | Required checks beyond permission |
|---|---|
| Review notification | current state is reviewable; actor is eligible reviewer; same tenant/scope |
| Execute work order | actor is assigned/crew member or has scoped override; state allows execution |
| Verify work order | actor is eligible supervisor; completion exists; separation-of-duties if approved |
| Post stock document | final approval complete; actor posting authority; locations in scope |
| Download attachment | attachment available and parent resource readable; classification permits download |
| Read audit | explicit audit permission; sensitive fields masked by viewer level |

## Administration and audit

- Role and assignment changes require `role.manage`, strong reauthentication if approved, Zod validation, and audit before/after snapshots.
- A user cannot grant permissions they are not allowed to administer within the target scope.
- Prevent removal of the last viable tenant administrator through a transaction-safe invariant.
- Session revocation follows account disabling and high-risk permission changes according to approved policy.
- Authorization decision logs are sampled for successful reads but retained for denials and important mutations without exposing sensitive resource content.

## Tests required for every protected capability

- anonymous denied;
- authenticated without permission denied;
- correct permission but wrong tenant denied without leakage;
- correct tenant but outside organizational scope denied;
- valid scoped grant allowed;
- inactive/expired assignment denied;
- contextual workflow policy enforced;
- UI, API and worker entry points reach the same policy/use case;
- attachment/report secondary authorization enforced;
- role/permission mutation audited.

## Permission decisions requiring approval

Approve ADR-004, ADR-006 and ADR-007 in the [architecture decision register](./target-architecture.md#architecture-decisions-requiring-approval), plus the production actor/action matrix, scope containment rules, cross-tenant support model, separation of duties, self-access rules, delegation/substitution, emergency elevation, session-revocation policy and audit masking levels.

