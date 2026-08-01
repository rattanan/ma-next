import { describe, expect, it } from "vitest";
import { resolveDatabaseUrl, serverEnvSchema } from "../lib/env";
import { organizationSchema, siteSchema } from "../lib/organization/validation";
import { masterDataValueSchema } from "../lib/master-data/validation";
import { notificationSchema } from "../lib/notifications/validation";
import { attachmentMetadataSchema, attachmentUpdateSchema, validateAttachmentSize } from "../lib/attachments/validation";

describe("foundation validation", () => {
  it("accepts only MariaDB/MySQL URLs", () => { expect(serverEnvSchema.safeParse({ DATABASE_URL: "mysql://user:pass@localhost:3306/ma" }).success).toBe(true); expect(serverEnvSchema.safeParse({ DATABASE_URL: "postgres://localhost/ma" }).success).toBe(false); });
  it("uses DEV_DATABASE_URL only for the development runtime", () => {
    const values = { DATABASE_URL: "mysql://host/primary", DEV_DATABASE_URL: "mysql://host/dev" };
    expect(resolveDatabaseUrl({ ...values, NODE_ENV: "development" })).toBe(values.DEV_DATABASE_URL);
    expect(resolveDatabaseUrl({ ...values, NODE_ENV: "test" })).toBe(values.DATABASE_URL);
    expect(resolveDatabaseUrl({ ...values, NODE_ENV: "production" })).toBe(values.DATABASE_URL);
  });
  it("normalizes organization codes", () => { expect(organizationSchema.parse({ code: "plant-a", name: "Plant A" }).code).toBe("PLANT-A"); });
  it("requires a valid organization for sites", () => { expect(siteSchema.safeParse({ organizationId: "bad", code: "HQ", name: "Headquarters" }).success).toBe(false); });
  it("coerces master-data sort order", () => { const parsed = masterDataValueSchema.parse({ masterDataTypeId: "6ba7b810-9dad-11d1-80b4-00c04fd430c8", code: "one", label: "One", sortOrder: "5" }); expect(parsed.sortOrder).toBe(5); });
  it("requires relative notification actions", () => { expect(notificationSchema.safeParse({ type: "WORK", title: "Ready", message: "Review", actionUrl: "https://example.com", recipientIds: ["6ba7b810-9dad-11d1-80b4-00c04fd430c8"] }).success).toBe(false); });
  it("enforces attachment metadata and size", () => { expect(attachmentMetadataSchema.safeParse({ entityType: "WORK_ORDER", entityId: "1", originalName: "report.pdf", contentType: "application/pdf", byteSize: 42, storageKey: "work/1/report.pdf" }).success).toBe(true); expect(() => validateAttachmentSize(11, 10)).toThrow(/exceeds/); });
  it("validates editable attachment notes", () => { expect(attachmentUpdateSchema.parse({ note: "Inspection certificate" }).note).toBe("Inspection certificate"); expect(attachmentUpdateSchema.safeParse({ note: "x".repeat(2001) }).success).toBe(false); });
});
