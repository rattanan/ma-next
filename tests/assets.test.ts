import { describe, expect, it } from "vitest";
import { assertNoHierarchyCycle, assetListQuerySchema, normalizeLegacyAssetStatus } from "../lib/assets/validation";
import { assetSchema } from "../lib/maintenance/validation";

const typeId = "11111111-1111-4111-8111-111111111111";
const parentId = "22222222-2222-4222-8222-222222222222";
const assetId = "33333333-3333-4333-8333-333333333333";

describe("asset management baseline", () => {
  it("preserves every legacy asset field in the target input", () => {
    const asset = assetSchema.parse({
      code: " 10mka10ap001 ", name: "Boiler feed pump", description: "Main pump", assetTypeId: typeId,
      parentAssetId: parentId, structureLevel: "EQUIPMENT", location: "Turbine hall", status: "OFFLINE",
      primaryImagePath: "legacy/pump.png", unit: "EA", serialNumber: "SN-9", maintenanceInterval: 90,
      runningHourCode: "10MKA10CF001", budgetId: "ME18248", gpsCoordinates: "14.05, 100.61",
      costCenterLegacyId: 4, budgetReferenceLegacyId: 1, inventoryLocationLegacyId: 22, inventoryLocationName: "Warehouse A",
    });
    expect(asset).toMatchObject({ code: "10MKA10AP001", status: "OFFLINE", serialNumber: "SN-9", maintenanceInterval: 90, runningHourCode: "10MKA10CF001", budgetId: "ME18248", inventoryLocationLegacyId: 22 });
  });

  it("maps all evidenced legacy statuses without collapsing them", () => {
    expect(normalizeLegacyAssetStatus("Active")).toBe("ACTIVE");
    expect(normalizeLegacyAssetStatus("Offline")).toBe("OFFLINE");
    expect(normalizeLegacyAssetStatus("Reserved")).toBe("RESERVED");
  });

  it("parses composable list filters and rejects unsupported values", () => {
    expect(assetListQuerySchema.parse({ q: "pump", status: "ACTIVE", level: "COMPONENT", type: typeId })).toMatchObject({ q: "pump", status: "ACTIVE", level: "COMPONENT", type: typeId });
    expect(assetListQuerySchema.safeParse({ status: "PLACEMENT" }).success).toBe(false);
  });

  it("accepts an acyclic parent and rejects a direct or indirect cycle", () => {
    const parents = new Map<string, string | null>([[parentId, null], ["44444444-4444-4444-8444-444444444444", assetId]]);
    expect(assertNoHierarchyCycle(assetId, parentId, parents)).toBe(true);
    expect(() => assertNoHierarchyCycle(assetId, assetId, parents)).toThrow(/cycle/);
    expect(() => assertNoHierarchyCycle(assetId, "44444444-4444-4444-8444-444444444444", parents)).toThrow(/cycle/);
  });
});
