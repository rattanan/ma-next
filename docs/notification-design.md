# MA Next notification design

## Objectives

Notifications inform users of committed domain events without coupling business transactions to delivery providers. In-app delivery is foundational; email and push are adapters enabled per tenant only after provider and policy approval.

A notification is not a maintenance notification. This document uses `system notification` for user-facing messages and `maintenance notification` for the maintenance intake aggregate.

## Architecture

1. An application use case commits domain changes, audit event and an outbox message atomically.
2. A worker claims the outbox message with idempotent locking.
3. A registered notification policy resolves recipients from event facts and current organizational configuration.
4. The service creates one system notification and recipient records with a deterministic deduplication key.
5. In-app records become visible immediately after creation.
6. Optional delivery jobs render the approved locale/channel template and call an adapter.
7. Attempts, provider references, retry schedules and terminal failures are stored.

External provider failure never rolls back a committed maintenance/work/inventory transaction.

## Data model

| Entity | Purpose |
|---|---|
| `Notification` | tenant, event type/version, severity, template code/version, safe parameters, relative deep link, source entity, dedupe key, created/expiry time |
| `NotificationRecipient` | user, read/archive state and timestamps, chosen locale, per-recipient visibility |
| `NotificationDelivery` | recipient/channel, destination reference, status, attempt count, next attempt, provider message ID, redacted error |
| `NotificationPreference` | optional per-user event/category/channel preferences within mandatory-policy limits |
| `OutboxMessage` | durable source event awaiting processing |

Message prose is rendered from versioned Thai/English templates. Stored parameters are identifiers and safe display facts, not arbitrary HTML, secrets or full domain snapshots.

## Recipient resolution

Recipient rules are registered, typed policies, for example:

- responsible manager after maintenance-notification creation;
- reporter/requester after review;
- assignee/crew after work-order creation or reassignment;
- supervisor when completion awaits verification;
- technician after returned verification;
- work assignees waiting for a newly received part;
- ordered approver when an approval step becomes waiting;
- administrators/operators for failed scheduled generation or integration health.

The exact responsible-manager relationship, substitutes/escalation, mandatory recipients and scope rules require approved organizational data. Do not hard-code customer user IDs, department IDs or role names.

## Deep links and content safety

- Store application-relative allow-listed routes such as `/maintenance/work-orders/<id>`; reject external schemes/hosts.
- The destination page performs normal authorization. Possession of a notification or URL grants no access.
- Escape all template parameters; no arbitrary HTML from domain fields.
- Localize template, dates and numbers using recipient locale with tenant fallback.
- Avoid sensitive details in email/push lock-screen content; use a generic summary and authenticated deep link when classification requires it.

## State and delivery

Recipient states are `UNREAD`, `READ`, `ARCHIVED`; deleting legacy notifications maps to archive or retention deletion only after approval. Read/archive changes are server-authorized, idempotent and recipient-isolated.

Delivery states are `PENDING`, `SENDING`, `DELIVERED`, `RETRYABLE_FAILED`, `PERMANENT_FAILED`, `SUPPRESSED`. Workers use bounded exponential backoff with jitter and a dead-letter/operations view. Provider callbacks are authenticated and idempotent.

Deduplication keys include tenant, event ID, recipient, channel and template version. Reprocessing an outbox event does not create duplicate recipient messages.

## Preferences and mandatory events

Tenants may configure enabled channels and templates. Users may opt out of optional informational channels, but security, approval/action-required, and safety-critical events may be mandatory subject to approval. Quiet hours and timezone behavior require product decision; they must not delay urgent in-app visibility.

## Administration and privacy

- Notification administrators may inspect delivery metadata, not impersonate recipient read state or read sensitive content without explicit permission.
- Destinations such as email/phone are resolved at send time or stored encrypted/masked according to privacy policy.
- Provider credentials are deployment secrets, never master data.
- Retention applies independently to notification content, delivery attempts and operational logs.
- Bulk operations are tenant-scoped, bounded and audited.

## Tests

- domain transaction rollback produces no outbox message; commit produces exactly one;
- retries and duplicate events create one logical recipient notification;
- recipient resolver fixtures cover manager, assignee, supervisor and approver cases;
- wrong-tenant/non-recipient read/archive access denied;
- relative link allow-list and XSS/template escaping;
- Thai/English rendering and fallback;
- channel preference/mandatory-event behavior;
- provider timeout, retry, permanent failure and callback idempotency;
- no secrets or sensitive payloads in outbox, logs or push preview.

## Notification decisions requiring approval

Approve ADR-010, ADR-015, ADR-017 and ADR-021 in the [architecture decision register](./target-architecture.md#architecture-decisions-requiring-approval), the event/recipient matrix, manager resolution, channels/providers, mandatory versus optional events, templates and translations, deep-link base URLs, preference/quiet-hour rules, retry/dead-letter operations, content classification and retention/archive/delete semantics.

