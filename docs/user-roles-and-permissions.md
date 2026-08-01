# User roles and permissions

## Existing foundation

MA Next uses an opaque `atlas_session` cookie. Only the SHA-256 token hash is stored in `sessions`; inactive, locked, archived, expired, or revoked sessions are rejected. A user can have normalized `UserRole` assignments scoped globally or to an organization, site, or department. The legacy `users.role` value remains as a compatibility fallback.

## Governed roles

| Capability | Operator | Maintenance Manager | Technician | Administrator |
|---|---:|---:|---:|---:|
| Create/edit own draft and submit Notification | Yes | Yes | No | Existing full-access behavior retained |
| Review/request information/reject/approve Notification | No | Yes | No | Configurable through normalized role grants |
| Create, assign, or reassign Work Order | No | Yes | No | Configurable |
| Accept assignment/start/update/submit completion | No | No | Assigned technician only | Configurable |
| Approve or return completion | No | Yes | No | Configurable |
| Accept or reject maintenance result | Reporter or permitted department | No | No | Configurable |
| Close Work Order | No | Yes | No | Configurable |
| Close Notification | Reporter or permitted department | No | No | Configurable |
| Manage users and roles | No | No | No | Yes |

Fine-grained permission codes are declared in `lib/auth/permissions.ts`. Route handlers require a session; services repeat permission, organization/site/department scope, ownership, assignment, and status checks inside the mutation boundary. UI visibility is convenience only and is never the authorization boundary.

Legacy roles map conservatively during transition: `VIEWER` receives Operator workflow permissions, `DATA_SOURCE_CREATOR` receives manager workflow permissions, and `DASHBOARD_CREATOR` receives technician workflow permissions. New users should receive `OPERATOR`, `MAINTENANCE_MANAGER`, or `TECHNICIAN` normalized roles.

Administrators retain the repository's pre-existing full operational fallback. Remove operational role-permission rows from a custom Administrator role if segregation is required after migration.

## Scope rules

- Global grants can access every organization.
- Organization grants require the record's `organization_id` to match.
- Site grants require `site_id` to match.
- Department grants require `department_id` to match.
- Operators may additionally access their own Notifications.
- Technicians only receive Work Orders currently assigned to them in their queue, and execution commands repeat that assignment check.
- New governed Notifications require an unambiguous organization. Legacy null-scoped rows remain visible only to global administrators until classified.

