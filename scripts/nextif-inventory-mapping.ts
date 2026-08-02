export type InventorySourceMapping = {
  table: string;
  id: string;
  [field: string]: string;
};

/**
 * Adjust this mapping for the deployed Nextif extract. The migration runner
 * only knows these semantic fields; it does not depend on legacy table names.
 */
export const nextifInventoryMapping: Record<string, InventorySourceMapping> = {
  stockItems: { table: "whitm010", id: "id", code: "code", name: "name", description: "description", category: "category", unit: "unit", manufacturer: "manufacturer", partNumber: "part_number", barcode: "barcode", minimumStock: "minimum_stock", maximumStock: "maximum_stock", reorderPoint: "reorder_point", defaultUnitCost: "default_unit_cost", active: "active" },
  locations: { table: "whitm020", id: "id", code: "code", name: "name", plant: "plant", warehouse: "warehouse", zone: "zone", rack: "rack", shelf: "shelf", bin: "bin", description: "description", active: "active" },
  vendors: { table: "whvnd010", id: "id", code: "code", name: "name", taxId: "tax_id", address: "address", country: "country", province: "province", phone: "phone", email: "email", website: "website", active: "active" },
  vendorContacts: { table: "whvnd020", id: "id", vendorId: "vendor_id", name: "name", position: "position", department: "department", phone: "phone", mobile: "mobile", email: "email", lineId: "line_id", primaryContact: "primary_contact", active: "active" },
  balances: { table: "whinv010", id: "id", stockItemId: "stock_item_id", locationId: "location_id", quantity: "quantity_on_hand", movingAverageCost: "moving_average_cost" },
  receipts: { table: "whitm030", id: "id", number: "document_number", date: "document_date", itemId: "stock_item_id", locationId: "location_id", quantity: "quantity", unitCost: "unit_cost", vendorId: "vendor_id", expectedDate: "expected_delivery_date", actualDate: "actual_delivery_date" },
  issues: { table: "whitm040", id: "id", number: "document_number", date: "document_date", itemId: "stock_item_id", locationId: "location_id", quantity: "quantity", unitCost: "unit_cost" },
  transfers: { table: "whitm050", id: "id", number: "document_number", date: "document_date", itemId: "stock_item_id", sourceLocationId: "source_location_id", destinationLocationId: "destination_location_id", quantity: "quantity", unitCost: "unit_cost", quantityBefore: "quantity_before", quantityAfter: "quantity_after", sourceQuantityBefore: "source_quantity_before", sourceQuantityAfter: "source_quantity_after", destinationQuantityBefore: "destination_quantity_before", destinationQuantityAfter: "destination_quantity_after", movingAverageCostBefore: "moving_average_cost_before", movingAverageCostAfter: "moving_average_cost_after" },
};
