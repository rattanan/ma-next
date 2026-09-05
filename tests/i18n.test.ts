import { describe, expect, it } from "vitest";
import { DEFAULT_LOCALE, isLocale, translateUiText, translationPairs } from "@/lib/i18n/translations";

describe("site language translations", () => {
  it("uses Thai as the product default", () => {
    expect(DEFAULT_LOCALE).toBe("th");
  });

  it("translates shared interface copy in both directions", () => {
    expect(translateUiText("ภาพรวมงาน", "en")).toBe("Operations overview");
    expect(translateUiText("Welcome back", "th")).toBe("ยินดีต้อนรับกลับ");
  });

  it("preserves layout whitespace around translated text", () => {
    expect(translateUiText("  บันทึก  ", "en")).toBe("  Save  ");
  });

  it("handles dynamic count and pagination labels", () => {
    expect(translateUiText("พบ 18 บทความ", "en")).toBe("Found 18 articles");
    expect(translateUiText("Page 2 of 7", "th")).toBe("หน้า 2 จาก 7");
  });

  it("does not change identifiers or user-entered content", () => {
    expect(translateUiText("WO-2026-0042", "en")).toBe("WO-2026-0042");
    expect(translateUiText("อาคารสำนักงานใหญ่", "en")).toBe("อาคารสำนักงานใหญ่");
  });

  it("contains no duplicate source labels", () => {
    expect(new Set(translationPairs.map(([thai]) => thai)).size).toBe(translationPairs.length);
    expect(new Set(translationPairs.map(([, english]) => english)).size).toBe(translationPairs.length);
  });

  it("accepts only supported locales", () => {
    expect(isLocale("th")).toBe(true);
    expect(isLocale("en")).toBe(true);
    expect(isLocale("ja")).toBe(false);
  });
});
