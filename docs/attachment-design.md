# MA Next attachment design

## Objectives

Attachments use an object-storage abstraction backed by private S3-compatible storage. No domain module stores provider URLs, local filesystem paths, credentials, or binary data. Attachment authorization always derives from tenant and parent-resource access.

Legacy web-path files are migration inputs only. They are not copied into public Next.js directories.

## Components

| Component | Responsibility |
|---|---|
| Attachment application service | authorize intent, create upload session, complete/link/unlink/download/delete |
| ObjectStorage port | put/get/head/delete/copy and presigned request operations using storage keys |
| S3 adapter | provider SDK configuration, retries, checksums, server-side encryption metadata |
| Attachment repository | metadata, state, ownership, links, versions and retention |
| Scanner adapter | malware/content scan submission and result callback/polling |
| Worker | scan, thumbnail/preview generation, orphan cleanup and physical deletion |
| Policy service | MIME/size/classification/parent access and retention rules |

Domain and React components call attachment use cases only. Provider SDK calls are confined to infrastructure adapters.

## Data model

Proposed `Attachment` fields include tenant, opaque object key, storage provider/bucket, original display name, normalized extension, declared and detected MIME, byte size, checksum, lifecycle status, classification, uploader, timestamps, scan result, image dimensions, and optional legacy source metadata.

`AttachmentLink` contains tenant, attachment ID, allow-listed parent type/ID, purpose, display order and link actor/time. A single object may link to multiple records only if product policy approves shared ownership; otherwise enforce one parent.

Lifecycle states:

`PENDING_UPLOAD → UPLOADED → QUARANTINED → AVAILABLE`

Failure/terminal paths are `REJECTED`, `DELETED_PENDING`, and `DELETED`. Whether scanning is synchronous, asynchronous, or waived for trusted migrated files requires approval.

## Upload workflow

1. Client requests an upload intent with parent type/ID, purpose, name, size and declared content type.
2. Server authenticates, authorizes `attachment.upload` plus parent update access, and validates a Zod policy schema.
3. Server creates `PENDING_UPLOAD` metadata and an unpredictable tenant-prefixed storage key.
4. Server returns a short-lived, size/content-constrained presigned upload request or proxies small uploads if approved.
5. Client uploads directly to private object storage.
6. Client calls complete; server verifies object existence, exact size and checksum, then marks it `QUARANTINED` and enqueues scanning.
7. Worker detects MIME, scans content and creates safe previews. A clean object becomes `AVAILABLE`; rejected content remains inaccessible and creates an audit/notification event.
8. Domain link is created only when the object and parent still pass policy. Upload completion, link and important failures are audited.

Presigned completion is idempotent. Abandoned pending uploads and unlinked clean objects are removed after an approved grace period.

## Download and preview

- Authenticate and authorize tenant, `attachment.download`, parent read access, classification and `AVAILABLE` status.
- Return a short-lived content-disposition-specific presigned URL or stream through the application when policy requires stronger control.
- Force download for untrusted active formats; never inline arbitrary HTML/SVG.
- Image/PDF previews use generated derivatives with separate keys and metadata. Original objects are immutable.
- Do not expose bucket names, internal keys or permanent provider URLs in UI records.
- Audit sensitive downloads and all official exports according to policy.

## Deletion and retention

Unlink is a domain mutation and may leave an object linked elsewhere. When no links remain, apply retention/legal-hold policy before scheduling physical deletion. Mark metadata `DELETED_PENDING`, delete object/derivatives idempotently, then mark `DELETED`; retain the non-sensitive audit trail.

Replacing an attachment creates a new object/link and retires the old link. Never overwrite an existing storage key, because it breaks auditability, caching and checksum evidence.

## Object key and bucket policy

Proposed object keys are opaque, for example `tenant/<tenant-id>/<year>/<random-id>/original`. User filenames remain metadata only and undergo display/header sanitization.

- Buckets are private; public ACLs are blocked.
- TLS and provider-side encryption are mandatory; customer-managed keys require approval.
- Web and worker use least-privilege identities and bucket-prefix restrictions where supported.
- CORS allows only approved origins and methods.
- Versioning/lifecycle policy must align with application deletion and backup policy.
- Logs redact signed URLs and credentials.

## Legacy migration

Migration runs from an approved, read-only file snapshot and metadata extract, never directly from public production paths during application requests.

For each source reference:

1. resolve safely under an allow-listed snapshot root;
2. classify missing, duplicate, unsafe-path and unreadable records;
3. hash and MIME-detect the file;
4. upload with migration batch metadata;
5. scan or mark an explicitly approved legacy quarantine state;
6. create crosswalk and parent link;
7. reconcile source count, bytes, checksum, links and rejects.

Do not infer ownership from a filename alone. Missing files remain explicit migration exceptions.

## Tests

- storage-port contract suite shared by MinIO and the selected production provider;
- permission and wrong-tenant denial for intent, complete, preview, download, unlink and delete;
- MIME mismatch, extension tricks, oversize, checksum mismatch and path/header injection;
- interrupted/retried upload completion and worker scan idempotency;
- unavailable/quarantined objects cannot be downloaded;
- orphan cleanup respects grace period, links, retention and legal holds;
- migration checksum/count/rejection reconciliation;
- no provider SDK imports outside the adapter boundary.

## Attachment decisions requiring approval

Approve ADR-011 and ADR-021 in the [architecture decision register](./target-architecture.md#architecture-decisions-requiring-approval), storage provider/region/data residency, bucket topology, size/MIME limits, malware service and failure mode, allowed inline previews, shared links/versioning, checksum algorithm, retention/legal holds, encryption key ownership, download-audit coverage, and treatment of unscannable legacy files.

