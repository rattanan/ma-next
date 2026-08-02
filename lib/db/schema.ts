import {
  boolean,
  datetime,
  decimal,
  index,
  int,
  longtext,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const roleValues = ["ADMIN", "DATA_SOURCE_CREATOR", "DASHBOARD_CREATOR", "VIEWER", "OPERATOR", "MAINTENANCE", "MAINTENANCE_MANAGER", "WAREHOUSE_MANAGER", "PLANT_MANAGER", "TECHNICIAN"] as const;
export const statusValues = ["ACTIVE", "INACTIVE", "LOCKED", "ARCHIVED"] as const;
export type Role = (typeof roleValues)[number];
export type UserStatus = (typeof statusValues)[number];

export const users = mysqlTable("users", {
  id: varchar("id", { length: 36 }).primaryKey(),
  fullName: varchar("full_name", { length: 160 }).notNull(),
  username: varchar("username", { length: 80 }).notNull(),
  email: varchar("email", { length: 190 }).notNull(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: mysqlEnum("role", roleValues).notNull().default("VIEWER"),
  status: mysqlEnum("status", statusValues).notNull().default("ACTIVE"),
  adminNotes: text("admin_notes"),
  failedLoginAttempts: int("failed_login_attempts").notNull().default(0),
  failedLoginWindowStartedAt: datetime("failed_login_window_started_at", { mode: "date", fsp: 3 }),
  lockedUntil: datetime("locked_until", { mode: "date", fsp: 3 }),
  mustChangePassword: boolean("must_change_password").notNull().default(true),
  lastLoginAt: datetime("last_login_at", { mode: "date", fsp: 3 }),
  passwordChangedAt: datetime("password_changed_at", { mode: "date", fsp: 3 }),
  createdAt: datetime("created_at", { mode: "date", fsp: 3 }).notNull(),
  updatedAt: datetime("updated_at", { mode: "date", fsp: 3 }).notNull(),
  createdBy: varchar("created_by", { length: 36 }),
  updatedBy: varchar("updated_by", { length: 36 }),
  archivedAt: datetime("archived_at", { mode: "date", fsp: 3 }),
}, (table) => [
  uniqueIndex("users_email_uq").on(table.email),
  uniqueIndex("users_username_uq").on(table.username),
  index("users_status_idx").on(table.status),
  index("users_role_idx").on(table.role),
]);

export const sessions = mysqlTable("sessions", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
  sessionTokenHash: varchar("session_token_hash", { length: 64 }).notNull(),
  ipAddress: varchar("ip_address", { length: 64 }),
  userAgent: text("user_agent"),
  lastActiveAt: datetime("last_active_at", { mode: "date", fsp: 3 }).notNull(),
  expiresAt: datetime("expires_at", { mode: "date", fsp: 3 }).notNull(),
  revokedAt: datetime("revoked_at", { mode: "date", fsp: 3 }),
  createdAt: datetime("created_at", { mode: "date", fsp: 3 }).notNull(),
}, (table) => [
  uniqueIndex("sessions_token_uq").on(table.sessionTokenHash),
  index("sessions_user_idx").on(table.userId),
  index("sessions_expires_idx").on(table.expiresAt),
]);

export const loginHistory = mysqlTable("login_history", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
  loginIdentifier: varchar("login_identifier", { length: 190 }).notNull(),
  eventType: mysqlEnum("event_type", ["LOGIN", "LOGOUT", "SESSION"]).notNull(),
  status: mysqlEnum("status", ["SUCCESS", "FAILED", "LOCKED", "LOGOUT", "SESSION_EXPIRED"]).notNull(),
  ipAddress: varchar("ip_address", { length: 64 }),
  userAgent: text("user_agent"),
  browser: varchar("browser", { length: 80 }),
  operatingSystem: varchar("operating_system", { length: 80 }),
  deviceType: varchar("device_type", { length: 40 }),
  failureReason: varchar("failure_reason", { length: 160 }),
  loggedInAt: datetime("logged_in_at", { mode: "date", fsp: 3 }),
  loggedOutAt: datetime("logged_out_at", { mode: "date", fsp: 3 }),
  createdAt: datetime("created_at", { mode: "date", fsp: 3 }).notNull(),
}, (table) => [
  index("login_history_user_idx").on(table.userId),
  index("login_history_created_idx").on(table.createdAt),
  index("login_history_status_idx").on(table.status),
]);

export const auditLogs = mysqlTable("audit_logs", {
  id: varchar("id", { length: 36 }).primaryKey(),
  actorUserId: varchar("actor_user_id", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
  actorName: varchar("actor_name", { length: 160 }),
  actorRole: varchar("actor_role", { length: 80 }),
  organizationId: varchar("organization_id", { length: 36 }),
  action: varchar("action", { length: 100 }).notNull(),
  category: varchar("category", { length: 60 }).notNull(),
  targetType: varchar("target_type", { length: 60 }),
  targetId: varchar("target_id", { length: 80 }),
  targetName: varchar("target_name", { length: 190 }),
  result: mysqlEnum("result", ["SUCCESS", "FAILED"]).notNull(),
  description: text("description"),
  previousValues: longtext("previous_values"),
  newValues: longtext("new_values"),
  ipAddress: varchar("ip_address", { length: 64 }),
  userAgent: text("user_agent"),
  requestId: varchar("request_id", { length: 36 }).notNull(),
  createdAt: datetime("created_at", { mode: "date", fsp: 3 }).notNull(),
}, (table) => [
  index("audit_actor_idx").on(table.actorUserId),
  index("audit_action_idx").on(table.action),
  index("audit_target_idx").on(table.targetType, table.targetId),
  index("audit_created_idx").on(table.createdAt),
]);

export const attachments = mysqlTable("attachments", {
  id: varchar("id", { length: 36 }).primaryKey(),
  entityType: varchar("entity_type", { length: 80 }).notNull(),
  entityId: varchar("entity_id", { length: 80 }).notNull(),
  driver: mysqlEnum("driver", ["LOCAL", "S3", "AZURE"]).notNull().default("LOCAL"),
  storageKey: varchar("storage_key", { length: 500 }).notNull(),
  originalName: varchar("original_name", { length: 255 }).notNull(),
  contentType: varchar("content_type", { length: 120 }).notNull(),
  byteSize: int("byte_size").notNull(),
  checksum: varchar("checksum", { length: 128 }),
  uploadedBy: varchar("uploaded_by", { length: 36 }).notNull(),
  createdAt: datetime("created_at", { mode: "date", fsp: 3 }).notNull(),
  deletedAt: datetime("deleted_at", { mode: "date", fsp: 3 }),
}, (table) => [index("attachments_entity_idx").on(table.entityType, table.entityId), index("attachments_uploader_idx").on(table.uploadedBy)]);

export const passwordHistory = mysqlTable("password_history", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  createdAt: datetime("created_at", { mode: "date", fsp: 3 }).notNull(),
}, (table) => [index("password_history_user_idx").on(table.userId, table.createdAt)]);

export const loginRateLimits = mysqlTable("login_rate_limits", {
  ipHash: varchar("ip_hash", { length: 64 }).notNull(),
  windowStartedAt: datetime("window_started_at", { mode: "date", fsp: 3 }).notNull(),
  attempts: int("attempts").notNull().default(0),
  blockedUntil: datetime("blocked_until", { mode: "date", fsp: 3 }),
  updatedAt: datetime("updated_at", { mode: "date", fsp: 3 }).notNull(),
}, (table) => [primaryKey({ columns: [table.ipHash] })]);

export const assetCriticalityValues = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export const assetStatusValues = ["ACTIVE", "OFFLINE", "RESERVED", "INACTIVE", "RETIRED"] as const;
export const assetStructureLevelValues = ["SYSTEM", "EQUIPMENT", "COMPONENT"] as const;
export const assetCustomFieldTypeValues = ["STRING", "NUMBER", "ARRAY", "DATE"] as const;
export const notificationPriorityValues = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export const maintenanceSeverityValues = ["MINOR", "MODERATE", "MAJOR", "CRITICAL"] as const;
export const equipmentOperatingStatusValues = ["RUNNING", "STOPPED", "DEGRADED", "UNKNOWN"] as const;
export const notificationTypeValues = ["CORRECTIVE", "BREAKDOWN", "INSPECTION"] as const;
export const notificationStatusValues = ["NEW", "BACKLOG", "COMPLETED", "DRAFT", "SUBMITTED", "UNDER_REVIEW", "RETURNED", "NEEDS_INFORMATION", "REJECTED", "APPROVED", "CONVERTED_TO_WORK_ORDER", "IN_MAINTENANCE", "WAITING_FOR_OPERATOR_ACCEPTANCE", "OPERATOR_REJECTED", "OPERATOR_ACCEPTED", "READY_TO_CLOSE", "CLOSED", "CANCELLED"] as const;
export const notificationDecisionValues = ["APPROVED", "BACKLOG", "REJECTED", "NEEDS_INFORMATION"] as const;
export const workOrderStatusValues = ["OPEN", "BACKLOG", "COMPLETION_PENDING", "VERIFIED", "CREATED", "ASSIGNED", "TECHNICIAN_ACCEPTED", "IN_PROGRESS", "WAITING_FOR_PARTS", "WAITING_FOR_VENDOR", "WAITING_FOR_ACCESS", "ON_HOLD", "TECHNICIAN_COMPLETED", "UNDER_MANAGER_REVIEW", "RETURNED_TO_TECHNICIAN", "MANAGER_APPROVED", "WAITING_FOR_OPERATOR_ACCEPTANCE", "OPERATOR_REJECTED", "OPERATOR_ACCEPTED", "CLOSED", "CANCELLED"] as const;
export const workOrderSourceTypeValues = ["MANUAL", "NOTIFICATION", "PREVENTIVE_EVENT", "SHUTDOWN_TASK", "IMPORT"] as const;
export const workOrderTypeValues = ["PREVENTIVE", "CORRECTIVE", "SHUTDOWN", "OTHER_ASSIGNMENT"] as const;
export const workOrderBacklogScopeValues = ["WORK_ORDER", "JOB_STEP"] as const;
export const workOrderToolLoanStatusValues = ["PLANNED", "ISSUED", "RETURNED", "CANCELLED"] as const;
export const workTaskStatusValues = ["OPEN", "IN_PROGRESS", "BACKLOG", "COMPLETED"] as const;
export const workTaskKindValues = ["JOB_STEP", "CHECKLIST"] as const;
export const verificationDecisionValues = ["VERIFIED", "RETURNED"] as const;
export const managerDecisionValues = ["PENDING", "APPROVED", "RETURNED"] as const;
export const recheckStatusValues = ["OPEN", "IN_PROGRESS", "RESUBMITTED", "APPROVED", "RETURNED_AGAIN", "CANCELLED"] as const;
export const operatorDecisionValues = ["ACCEPTED", "REJECTED"] as const;
export const approvalTypeValues = ["NOTIFICATION", "WORK_ORDER", "WORK_COMPLETION", "MATERIAL_REQUEST", "PURCHASE_REQUEST", "PREVENTIVE_MAINTENANCE", "INVENTORY"] as const;
export const approvalStatusValues = ["PENDING", "IN_REVIEW", "APPROVED", "RETURNED", "REJECTED", "CANCELLED"] as const;
export const approvalActionValues = ["SUBMITTED", "OPENED", "APPROVED", "RETURNED", "REJECTED", "RESUBMITTED", "CANCELLED"] as const;

export type NotificationStatus = (typeof notificationStatusValues)[number];
export type NotificationDecision = (typeof notificationDecisionValues)[number];
export type WorkOrderStatus = (typeof workOrderStatusValues)[number];
export type WorkOrderSourceType = (typeof workOrderSourceTypeValues)[number];
export type WorkOrderType = (typeof workOrderTypeValues)[number];
export type WorkTaskStatus = (typeof workTaskStatusValues)[number];
export type VerificationDecision = (typeof verificationDecisionValues)[number];
export type AssetStatus = (typeof assetStatusValues)[number];
export type AssetStructureLevel = (typeof assetStructureLevelValues)[number];

export const assetTypes = mysqlTable("asset_types", {
  id: varchar("id", { length: 36 }).primaryKey(),
  code: varchar("code", { length: 40 }).notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  description: text("description"),
  active: boolean("active").notNull().default(true),
  createdAt: datetime("created_at", { mode: "date", fsp: 3 }).notNull(),
  updatedAt: datetime("updated_at", { mode: "date", fsp: 3 }).notNull(),
  createdBy: varchar("created_by", { length: 36 }).notNull().references(() => users.id),
  updatedBy: varchar("updated_by", { length: 36 }).notNull().references(() => users.id),
}, (table) => [uniqueIndex("asset_types_code_uq").on(table.code), index("asset_types_active_idx").on(table.active)]);

export const assetCategories = mysqlTable("asset_categories", {
  id: varchar("id", { length: 36 }).primaryKey(),
  code: varchar("code", { length: 40 }).notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  description: text("description"),
  active: boolean("active").notNull().default(true),
  createdAt: datetime("created_at", { mode: "date", fsp: 3 }).notNull(),
  updatedAt: datetime("updated_at", { mode: "date", fsp: 3 }).notNull(),
  createdBy: varchar("created_by", { length: 36 }).notNull().references(() => users.id),
  updatedBy: varchar("updated_by", { length: 36 }).notNull().references(() => users.id),
}, (table) => [uniqueIndex("asset_categories_code_uq").on(table.code), index("asset_categories_active_idx").on(table.active)]);

export const contracts = mysqlTable("contracts", {
  id: varchar("id", { length: 36 }).primaryKey(),
  code: varchar("code", { length: 60 }).notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  contractNumber: varchar("contract_number", { length: 60 }),
  description: text("description"),
  vendorName: varchar("vendor_name", { length: 160 }),
  contactName: varchar("contact_name", { length: 120 }),
  telephone: varchar("telephone", { length: 60 }),
  signedAt: datetime("signed_at", { mode: "date", fsp: 3 }),
  startsAt: datetime("starts_at", { mode: "date", fsp: 3 }),
  endsAt: datetime("ends_at", { mode: "date", fsp: 3 }),
  amount: decimal("amount", { precision: 18, scale: 2 }),
  terms: text("terms"),
  legacySourceId: int("legacy_source_id"),
}, (table) => [uniqueIndex("contracts_code_uq").on(table.code), uniqueIndex("contracts_legacy_source_uq").on(table.legacySourceId)]);

export const assets = mysqlTable("assets", {
  id: varchar("id", { length: 36 }).primaryKey(),
  code: varchar("code", { length: 60 }).notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  description: text("description"),
  assetTypeId: varchar("asset_type_id", { length: 36 }).notNull().references(() => assetTypes.id),
  assetCategoryId: varchar("asset_category_id", { length: 36 }).references(() => assetCategories.id),
  parentAssetId: varchar("parent_asset_id", { length: 36 }),
  structureLevel: mysqlEnum("structure_level", assetStructureLevelValues).notNull().default("EQUIPMENT"),
  location: varchar("location", { length: 190 }).notNull(),
  criticality: mysqlEnum("criticality", assetCriticalityValues).notNull().default("MEDIUM"),
  status: mysqlEnum("status", assetStatusValues).notNull().default("ACTIVE"),
  ownerUserId: varchar("owner_user_id", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
  contractId: varchar("contract_id", { length: 36 }).references(() => contracts.id, { onDelete: "set null" }),
  primaryImagePath: varchar("primary_image_path", { length: 500 }),
  unit: varchar("unit", { length: 45 }),
  serialNumber: varchar("serial_number", { length: 45 }),
  maintenanceInterval: int("maintenance_interval"),
  runningHourCode: varchar("running_hour_code", { length: 45 }),
  budgetId: varchar("budget_id", { length: 45 }),
  gpsCoordinates: varchar("gps_coordinates", { length: 90 }),
  costCenterLegacyId: int("cost_center_legacy_id"),
  budgetReferenceLegacyId: int("budget_reference_legacy_id"),
  inventoryLocationLegacyId: int("inventory_location_legacy_id"),
  inventoryLocationName: varchar("inventory_location_name", { length: 190 }),
  legacySourceId: int("legacy_source_id"),
  createdAt: datetime("created_at", { mode: "date", fsp: 3 }).notNull(),
  updatedAt: datetime("updated_at", { mode: "date", fsp: 3 }).notNull(),
  createdBy: varchar("created_by", { length: 36 }).notNull().references(() => users.id),
  updatedBy: varchar("updated_by", { length: 36 }).notNull().references(() => users.id),
}, (table) => [
  uniqueIndex("assets_code_uq").on(table.code),
  uniqueIndex("assets_legacy_source_uq").on(table.legacySourceId),
  index("assets_name_idx").on(table.name),
  index("assets_location_idx").on(table.location),
  index("assets_status_idx").on(table.status),
  index("assets_type_idx").on(table.assetTypeId),
  index("assets_parent_idx").on(table.parentAssetId),
  index("assets_level_idx").on(table.structureLevel),
  index("assets_contract_idx").on(table.contractId),
]);

export const assetHierarchyLinks = mysqlTable("asset_hierarchy_links", {
  id: varchar("id", { length: 36 }).primaryKey(),
  sequence: int("sequence").notNull().default(10),
  assetId: varchar("asset_id", { length: 36 }).notNull().references(() => assets.id, { onDelete: "cascade" }),
  parentAssetId: varchar("parent_asset_id", { length: 36 }).references(() => assets.id, { onDelete: "set null" }),
  rootAssetId: varchar("root_asset_id", { length: 36 }).references(() => assets.id, { onDelete: "set null" }),
  enabled: boolean("enabled").notNull().default(true),
  quantity: decimal("quantity", { precision: 14, scale: 4 }).notNull().default("1"),
  note: text("note"),
  legacySourceId: int("legacy_source_id"),
}, (table) => [index("asset_hierarchy_parent_idx").on(table.parentAssetId, table.sequence), uniqueIndex("asset_hierarchy_legacy_uq").on(table.legacySourceId)]);

export const spareParts = mysqlTable("spare_parts", {
  id: varchar("id", { length: 36 }).primaryKey(),
  code: varchar("code", { length: 80 }).notNull(),
  name: varchar("name", { length: 190 }).notNull(),
  description: text("description"),
  unit: varchar("unit", { length: 45 }),
  availableQuantity: decimal("available_quantity", { precision: 14, scale: 4 }),
  legacySourceId: int("legacy_source_id"),
}, (table) => [uniqueIndex("spare_parts_code_uq").on(table.code), uniqueIndex("spare_parts_legacy_uq").on(table.legacySourceId)]);

export const assetSpareParts = mysqlTable("asset_spare_parts", {
  id: varchar("id", { length: 36 }).primaryKey(),
  sequence: int("sequence").notNull().default(10),
  assetId: varchar("asset_id", { length: 36 }).notNull().references(() => assets.id, { onDelete: "cascade" }),
  sparePartId: varchar("spare_part_id", { length: 36 }).notNull().references(() => spareParts.id, { onDelete: "cascade" }),
  enabled: boolean("enabled").notNull().default(true),
  requiredQuantity: decimal("required_quantity", { precision: 14, scale: 4 }).notNull().default("1"),
  note: text("note"),
  legacySourceId: int("legacy_source_id"),
}, (table) => [index("asset_spare_parts_asset_idx").on(table.assetId, table.sequence), uniqueIndex("asset_spare_parts_legacy_uq").on(table.legacySourceId)]);

export const assetCustomFieldGroups = mysqlTable("asset_custom_field_groups", {
  id: varchar("id", { length: 36 }).primaryKey(),
  name: varchar("name", { length: 80 }).notNull(),
  sortOrder: int("sort_order").notNull().default(10),
  legacySourceId: int("legacy_source_id"),
}, (table) => [uniqueIndex("asset_custom_field_groups_name_uq").on(table.name), uniqueIndex("asset_custom_field_groups_legacy_uq").on(table.legacySourceId)]);

export const assetCustomFieldDefinitions = mysqlTable("asset_custom_field_definitions", {
  id: varchar("id", { length: 36 }).primaryKey(),
  assetCategoryId: varchar("asset_category_id", { length: 36 }).references(() => assetCategories.id, { onDelete: "cascade" }),
  groupId: varchar("group_id", { length: 36 }).notNull().references(() => assetCustomFieldGroups.id),
  name: varchar("name", { length: 80 }).notNull(),
  label: varchar("label", { length: 190 }).notNull(),
  description: text("description"),
  fieldType: mysqlEnum("field_type", assetCustomFieldTypeValues).notNull(),
  placeholder: varchar("placeholder", { length: 190 }),
  defaultValue: varchar("default_value", { length: 190 }),
  availableValues: text("available_values"),
  unit: varchar("unit", { length: 45 }),
  sortOrder: int("sort_order").notNull().default(10),
  active: boolean("active").notNull().default(true),
  legacySourceId: int("legacy_source_id"),
}, (table) => [index("asset_custom_def_category_idx").on(table.assetCategoryId, table.groupId, table.sortOrder), uniqueIndex("asset_custom_def_legacy_uq").on(table.legacySourceId)]);

export const assetCustomFieldValues = mysqlTable("asset_custom_field_values", {
  id: varchar("id", { length: 36 }).primaryKey(),
  assetId: varchar("asset_id", { length: 36 }).notNull().references(() => assets.id, { onDelete: "cascade" }),
  definitionId: varchar("definition_id", { length: 36 }).notNull().references(() => assetCustomFieldDefinitions.id, { onDelete: "cascade" }),
  value: varchar("value", { length: 500 }).notNull(),
  legacySourceId: int("legacy_source_id"),
}, (table) => [uniqueIndex("asset_custom_values_asset_definition_uq").on(table.assetId, table.definitionId), uniqueIndex("asset_custom_values_legacy_uq").on(table.legacySourceId)]);

export const assetDocumentMetadata = mysqlTable("asset_document_metadata", {
  attachmentId: varchar("attachment_id", { length: 36 }).primaryKey(),
  note: text("note"),
  legacySourceId: int("legacy_source_id"),
}, (table) => [uniqueIndex("asset_document_metadata_legacy_uq").on(table.legacySourceId)]);

export const maintenanceNotifications = mysqlTable("maintenance_notifications", {
  id: varchar("id", { length: 36 }).primaryKey(),
  code: varchar("code", { length: 60 }).notNull(),
  organizationId: varchar("organization_id", { length: 36 }),
  siteId: varchar("site_id", { length: 36 }),
  assetId: varchar("asset_id", { length: 36 }).notNull().references(() => assets.id),
  title: varchar("title", { length: 190 }).notNull(),
  description: text("description").notNull(),
  symptoms: text("symptoms"),
  problemCategory: varchar("problem_category", { length: 120 }),
  operationalImpact: text("operational_impact"),
  safetyImpact: text("safety_impact"),
  productionImpact: text("production_impact"),
  incidentAt: datetime("incident_at", { mode: "date", fsp: 3 }),
  responsibleGroup: varchar("responsible_group", { length: 160 }),
  remarks: text("remarks"),
  requestedUrgency: varchar("requested_urgency", { length: 80 }),
  contactPerson: varchar("contact_person", { length: 160 }),
  contactPhone: varchar("contact_phone", { length: 60 }),
  type: mysqlEnum("type", notificationTypeValues).notNull().default("CORRECTIVE"),
  priority: mysqlEnum("priority", notificationPriorityValues).notNull().default("MEDIUM"),
  severity: mysqlEnum("severity", maintenanceSeverityValues).notNull().default("MODERATE"),
  equipmentOperatingStatus: mysqlEnum("equipment_operating_status", equipmentOperatingStatusValues).notNull().default("UNKNOWN"),
  status: mysqlEnum("status", notificationStatusValues).notNull().default("DRAFT"),
  breakdown: boolean("breakdown").notNull().default(false),
  requestedBy: varchar("requested_by", { length: 36 }).notNull().references(() => users.id),
  departmentId: varchar("department_id", { length: 36 }),
  assignedPersonId: varchar("assigned_person_id", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
  supervisorId: varchar("supervisor_id", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
  photoAttachmentIds: longtext("photo_attachment_ids"),
  dueAt: datetime("due_at", { mode: "date", fsp: 3 }),
  reviewedAt: datetime("reviewed_at", { mode: "date", fsp: 3 }),
  submittedAt: datetime("submitted_at", { mode: "date", fsp: 3 }),
  reviewedBy: varchar("reviewed_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
  informationRequest: text("information_request"),
  rejectionReason: text("rejection_reason"),
  operatorAcceptedBy: varchar("operator_accepted_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
  operatorAcceptedAt: datetime("operator_accepted_at", { mode: "date", fsp: 3 }),
  operatorRejectionReason: text("operator_rejection_reason"),
  closedBy: varchar("closed_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
  closedAt: datetime("closed_at", { mode: "date", fsp: 3 }),
  completedAt: datetime("completed_at", { mode: "date", fsp: 3 }),
  createdAt: datetime("created_at", { mode: "date", fsp: 3 }).notNull(),
  updatedAt: datetime("updated_at", { mode: "date", fsp: 3 }).notNull(),
  createdBy: varchar("created_by", { length: 36 }).notNull().references(() => users.id),
  updatedBy: varchar("updated_by", { length: 36 }).notNull().references(() => users.id),
}, (table) => [uniqueIndex("maintenance_notifications_code_uq").on(table.code), index("maintenance_notifications_org_idx").on(table.organizationId, table.status), index("maintenance_notifications_asset_idx").on(table.assetId), index("maintenance_notifications_status_idx").on(table.status)]);

export const notificationReviews = mysqlTable("notification_reviews", {
  id: varchar("id", { length: 36 }).primaryKey(),
  notificationId: varchar("notification_id", { length: 36 }).notNull().references(() => maintenanceNotifications.id, { onDelete: "cascade" }),
  decision: mysqlEnum("decision", notificationDecisionValues).notNull(),
  note: text("note").notNull(),
  reviewedBy: varchar("reviewed_by", { length: 36 }).notNull().references(() => users.id),
  reviewedAt: datetime("reviewed_at", { mode: "date", fsp: 3 }).notNull(),
}, (table) => [index("notification_reviews_history_idx").on(table.notificationId, table.reviewedAt)]);

export const approvalTasks = mysqlTable("approval_tasks", {
  id: varchar("id", { length: 36 }).primaryKey(),
  approvalType: mysqlEnum("approval_type", approvalTypeValues).notNull(),
  referenceId: varchar("reference_id", { length: 36 }).notNull(),
  referenceNumber: varchar("reference_number", { length: 80 }).notNull(),
  title: varchar("title", { length: 190 }).notNull(),
  requestedById: varchar("requested_by_id", { length: 36 }).notNull().references(() => users.id),
  requestedAt: datetime("requested_at", { mode: "date", fsp: 3 }).notNull(),
  assignedApproverId: varchar("assigned_approver_id", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
  assignedRole: varchar("assigned_role", { length: 80 }),
  status: mysqlEnum("status", approvalStatusValues).notNull().default("PENDING"),
  priority: mysqlEnum("priority", notificationPriorityValues),
  organizationId: varchar("organization_id", { length: 36 }),
  siteId: varchar("site_id", { length: 36 }),
  departmentId: varchar("department_id", { length: 36 }),
  reviewedAt: datetime("reviewed_at", { mode: "date", fsp: 3 }),
  completedAt: datetime("completed_at", { mode: "date", fsp: 3 }),
  decisionById: varchar("decision_by_id", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
  decisionComment: text("decision_comment"),
  returnReason: text("return_reason"),
  approvalRound: int("approval_round").notNull().default(1),
  createdAt: datetime("created_at", { mode: "date", fsp: 3 }).notNull(),
  updatedAt: datetime("updated_at", { mode: "date", fsp: 3 }).notNull(),
}, (table) => [
  uniqueIndex("approval_tasks_reference_round_uq").on(table.approvalType, table.referenceId, table.approvalRound),
  index("approval_tasks_assignee_status_idx").on(table.assignedApproverId, table.status),
  index("approval_tasks_role_status_idx").on(table.assignedRole, table.status),
  index("approval_tasks_scope_idx").on(table.organizationId, table.siteId, table.departmentId),
  index("approval_tasks_requested_idx").on(table.requestedAt),
]);

export const approvalHistory = mysqlTable("approval_history", {
  id: varchar("id", { length: 36 }).primaryKey(),
  approvalTaskId: varchar("approval_task_id", { length: 36 }).notNull().references(() => approvalTasks.id, { onDelete: "cascade" }),
  action: mysqlEnum("action", approvalActionValues).notNull(),
  actionById: varchar("action_by_id", { length: 36 }).notNull().references(() => users.id),
  comment: text("comment"),
  createdAt: datetime("created_at", { mode: "date", fsp: 3 }).notNull(),
}, (table) => [index("approval_history_task_idx").on(table.approvalTaskId, table.createdAt)]);

export const workOrders = mysqlTable("work_orders", {
  id: varchar("id", { length: 36 }).primaryKey(),
  code: varchar("code", { length: 60 }).notNull(),
  organizationId: varchar("organization_id", { length: 36 }),
  siteId: varchar("site_id", { length: 36 }),
  notificationId: varchar("notification_id", { length: 36 }).references(() => maintenanceNotifications.id),
  sourceType: mysqlEnum("source_type", workOrderSourceTypeValues).notNull().default("MANUAL"),
  sourceRecordId: varchar("source_record_id", { length: 80 }),
  workType: mysqlEnum("work_type", workOrderTypeValues).notNull().default("CORRECTIVE"),
  assetId: varchar("asset_id", { length: 36 }).notNull().references(() => assets.id),
  title: varchar("title", { length: 190 }).notNull(),
  description: text("description").notNull(),
  priority: mysqlEnum("priority", notificationPriorityValues).notNull().default("MEDIUM"),
  severity: mysqlEnum("severity", maintenanceSeverityValues).notNull().default("MODERATE"),
  equipmentOperatingStatus: mysqlEnum("equipment_operating_status", equipmentOperatingStatusValues).notNull().default("UNKNOWN"),
  status: mysqlEnum("status", workOrderStatusValues).notNull().default("CREATED"),
  departmentId: varchar("department_id", { length: 36 }),
  crewName: varchar("crew_name", { length: 160 }),
  leadUserId: varchar("lead_user_id", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
  vendorName: varchar("vendor_name", { length: 190 }),
  customerName: varchar("customer_name", { length: 190 }),
  reporterName: varchar("reporter_name", { length: 160 }),
  reporterPhone: varchar("reporter_phone", { length: 60 }),
  reportedAt: datetime("reported_at", { mode: "date", fsp: 3 }),
  plannedStartAt: datetime("planned_start_at", { mode: "date", fsp: 3 }),
  plannedFinishAt: datetime("planned_finish_at", { mode: "date", fsp: 3 }),
  estimatedMinutes: int("estimated_minutes"),
  actualFinishAt: datetime("actual_finish_at", { mode: "date", fsp: 3 }),
  checklistTemplateId: varchar("checklist_template_id", { length: 36 }),
  maintenanceTemplateId: varchar("maintenance_template_id", { length: 36 }),
  notes: longtext("notes"),
  legacyId: int("legacy_id"),
  legacyType: varchar("legacy_type", { length: 80 }),
  legacyStatus: varchar("legacy_status", { length: 80 }),
  backlogReason: text("backlog_reason"),
  assignedTo: varchar("assigned_to", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
  supervisorId: varchar("supervisor_id", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
  dueAt: datetime("due_at", { mode: "date", fsp: 3 }),
  startedAt: datetime("started_at", { mode: "date", fsp: 3 }),
  assignedAt: datetime("assigned_at", { mode: "date", fsp: 3 }),
  assignedBy: varchar("assigned_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
  technicianAcceptedAt: datetime("technician_accepted_at", { mode: "date", fsp: 3 }),
  technicianCompletedAt: datetime("technician_completed_at", { mode: "date", fsp: 3 }),
  managerApprovedAt: datetime("manager_approved_at", { mode: "date", fsp: 3 }),
  operatorAcceptedAt: datetime("operator_accepted_at", { mode: "date", fsp: 3 }),
  verifiedAt: datetime("verified_at", { mode: "date", fsp: 3 }),
  closedAt: datetime("closed_at", { mode: "date", fsp: 3 }),
  createdAt: datetime("created_at", { mode: "date", fsp: 3 }).notNull(),
  updatedAt: datetime("updated_at", { mode: "date", fsp: 3 }).notNull(),
  createdBy: varchar("created_by", { length: 36 }).notNull().references(() => users.id),
  updatedBy: varchar("updated_by", { length: 36 }).notNull().references(() => users.id),
}, (table) => [uniqueIndex("work_orders_code_uq").on(table.code), uniqueIndex("work_orders_source_uq").on(table.sourceType, table.sourceRecordId), uniqueIndex("work_orders_legacy_uq").on(table.legacyId), index("work_orders_org_idx").on(table.organizationId, table.status), index("work_orders_notification_idx").on(table.notificationId), index("work_orders_status_idx").on(table.status), index("work_orders_asset_idx").on(table.assetId), index("work_orders_assignee_idx").on(table.assignedTo), index("work_orders_type_priority_idx").on(table.workType, table.priority), index("work_orders_department_due_idx").on(table.departmentId, table.dueAt)]);

export const workOrderTasks = mysqlTable("work_order_tasks", {
  id: varchar("id", { length: 36 }).primaryKey(),
  workOrderId: varchar("work_order_id", { length: 36 }).notNull().references(() => workOrders.id, { onDelete: "cascade" }),
  sequence: int("sequence").notNull(),
  title: varchar("title", { length: 190 }).notNull(),
  description: text("description"),
  required: boolean("required").notNull().default(true),
  kind: mysqlEnum("kind", workTaskKindValues).notNull().default("JOB_STEP"),
  status: mysqlEnum("status", workTaskStatusValues).notNull().default("OPEN"),
  assignedTo: varchar("assigned_to", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
  assetId: varchar("asset_id", { length: 36 }).references(() => assets.id, { onDelete: "set null" }),
  dueAt: datetime("due_at", { mode: "date", fsp: 3 }),
  estimatedMinutes: int("estimated_minutes"),
  actualMinutes: int("actual_minutes"),
  result: longtext("result"),
  notes: longtext("notes"),
  responseType: varchar("response_type", { length: 40 }),
  responseValue: longtext("response_value"),
  remarks: longtext("remarks"),
  evidenceAttachmentId: varchar("evidence_attachment_id", { length: 36 }),
  legacyId: int("legacy_id"),
  completedBy: varchar("completed_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
  completedAt: datetime("completed_at", { mode: "date", fsp: 3 }),
  createdAt: datetime("created_at", { mode: "date", fsp: 3 }).notNull(),
  updatedAt: datetime("updated_at", { mode: "date", fsp: 3 }).notNull(),
}, (table) => [uniqueIndex("work_order_tasks_sequence_uq").on(table.workOrderId, table.sequence), uniqueIndex("work_order_tasks_legacy_uq").on(table.legacyId), index("work_order_tasks_status_idx").on(table.workOrderId, table.status)]);

export const workOrderAssets = mysqlTable("work_order_assets", {
  id: varchar("id", { length: 36 }).primaryKey(), workOrderId: varchar("work_order_id", { length: 36 }).notNull().references(() => workOrders.id, { onDelete: "cascade" }), assetId: varchar("asset_id", { length: 36 }).notNull().references(() => assets.id), role: varchar("role", { length: 40 }).notNull().default("RELATED"), sequence: int("sequence").notNull().default(10), notes: longtext("notes"), createdAt: datetime("created_at", { mode: "date", fsp: 3 }).notNull(),
}, (table) => [uniqueIndex("work_order_assets_role_uq").on(table.workOrderId, table.assetId, table.role), index("work_order_assets_order_idx").on(table.workOrderId, table.sequence)]);

export const workOrderAssignments = mysqlTable("work_order_assignments", {
  id: varchar("id", { length: 36 }).primaryKey(), workOrderId: varchar("work_order_id", { length: 36 }).notNull().references(() => workOrders.id, { onDelete: "cascade" }), departmentId: varchar("department_id", { length: 36 }), userId: varchar("user_id", { length: 36 }).references(() => users.id, { onDelete: "set null" }), teamName: varchar("team_name", { length: 160 }), positionName: varchar("position_name", { length: 160 }), assignmentType: varchar("assignment_type", { length: 40 }).notNull().default("TECHNICIAN"), assignedAt: datetime("assigned_at", { mode: "date", fsp: 3 }).notNull(), endedAt: datetime("ended_at", { mode: "date", fsp: 3 }), assignedBy: varchar("assigned_by", { length: 36 }).notNull().references(() => users.id), note: longtext("note"),
}, (table) => [index("work_order_assignments_order_idx").on(table.workOrderId, table.assignedAt), index("work_order_assignments_user_idx").on(table.userId, table.endedAt)]);

export const workOrderBacklogEvents = mysqlTable("work_order_backlog_events", {
  id: varchar("id", { length: 36 }).primaryKey(), workOrderId: varchar("work_order_id", { length: 36 }).notNull().references(() => workOrders.id, { onDelete: "cascade" }), taskId: varchar("task_id", { length: 36 }).references(() => workOrderTasks.id, { onDelete: "cascade" }), scope: mysqlEnum("scope", workOrderBacklogScopeValues).notNull().default("WORK_ORDER"), previousStatus: mysqlEnum("previous_status", workOrderStatusValues), reasonCode: varchar("reason_code", { length: 60 }), reason: longtext("reason").notNull(), category: varchar("category", { length: 80 }), expectedResumeAt: datetime("expected_resume_at", { mode: "date", fsp: 3 }), enteredBy: varchar("entered_by", { length: 36 }).notNull().references(() => users.id), enteredAt: datetime("entered_at", { mode: "date", fsp: 3 }).notNull(), resumedBy: varchar("resumed_by", { length: 36 }).references(() => users.id), resumedAt: datetime("resumed_at", { mode: "date", fsp: 3 }), resolution: longtext("resolution"),
}, (table) => [index("work_order_backlog_order_idx").on(table.workOrderId, table.enteredAt), index("work_order_backlog_task_idx").on(table.taskId, table.resumedAt)]);

export const workOrderToolLoans = mysqlTable("work_order_tool_loans", {
  id: varchar("id", { length: 36 }).primaryKey(), workOrderId: varchar("work_order_id", { length: 36 }).notNull().references(() => workOrders.id, { onDelete: "cascade" }), toolCode: varchar("tool_code", { length: 80 }).notNull(), toolName: varchar("tool_name", { length: 190 }).notNull(), quantity: decimal("quantity", { precision: 14, scale: 4 }).notNull(), usageCondition: longtext("usage_condition"), status: mysqlEnum("status", workOrderToolLoanStatusValues).notNull().default("PLANNED"), issuedAt: datetime("issued_at", { mode: "date", fsp: 3 }), returnedAt: datetime("returned_at", { mode: "date", fsp: 3 }), issuedBy: varchar("issued_by", { length: 36 }).references(() => users.id), returnedBy: varchar("returned_by", { length: 36 }).references(() => users.id), notes: longtext("notes"), createdAt: datetime("created_at", { mode: "date", fsp: 3 }).notNull(), updatedAt: datetime("updated_at", { mode: "date", fsp: 3 }).notNull(),
}, (table) => [index("work_order_tool_loans_order_idx").on(table.workOrderId, table.status)]);

export const workOrderAcceptances = mysqlTable("work_order_acceptances", {
  id: varchar("id", { length: 36 }).primaryKey(), workOrderId: varchar("work_order_id", { length: 36 }).notNull().references(() => workOrders.id, { onDelete: "cascade" }), acceptedAt: datetime("accepted_at", { mode: "date", fsp: 3 }).notNull(), acceptedBy: varchar("accepted_by", { length: 36 }).notNull().references(() => users.id), details: longtext("details").notNull(), notes: longtext("notes"), lotoReference: varchar("loto_reference", { length: 190 }), isolationPoints: longtext("isolation_points"), permitNumber: varchar("permit_number", { length: 120 }), safetyInstructions: longtext("safety_instructions"), hazards: longtext("hazards"), operatingConditions: longtext("operating_conditions"), logSheetReference: varchar("log_sheet_reference", { length: 190 }), testResult: longtext("test_result"), handoverDetails: longtext("handover_details"), attachmentIds: longtext("attachment_ids"), createdAt: datetime("created_at", { mode: "date", fsp: 3 }).notNull(),
}, (table) => [index("work_order_acceptances_order_idx").on(table.workOrderId, table.acceptedAt)]);

export const workExecutionEntries = mysqlTable("work_execution_entries", {
  id: varchar("id", { length: 36 }).primaryKey(),
  workOrderId: varchar("work_order_id", { length: 36 }).notNull().references(() => workOrders.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  departmentId: varchar("department_id", { length: 36 }),
  employeeId: varchar("employee_id", { length: 36 }),
  positionName: varchar("position_name", { length: 160 }),
  workType: varchar("work_type", { length: 80 }),
  minutesSpent: int("minutes_spent").notNull(),
  overtimeMinutes: int("overtime_minutes").notNull().default(0),
  overtimeMultiplier: decimal("overtime_multiplier", { precision: 4, scale: 2 }).notNull().default("1"),
  actionAt: datetime("action_at", { mode: "date", fsp: 3 }).notNull(),
  actorUserId: varchar("actor_user_id", { length: 36 }).notNull().references(() => users.id),
  createdAt: datetime("created_at", { mode: "date", fsp: 3 }).notNull(),
}, (table) => [index("work_execution_entries_order_idx").on(table.workOrderId, table.actionAt)]);

export const workOrderCompletions = mysqlTable("work_order_completions", {
  id: varchar("id", { length: 36 }).primaryKey(),
  workOrderId: varchar("work_order_id", { length: 36 }).notNull().references(() => workOrders.id, { onDelete: "cascade" }),
  revisionNumber: int("revision_number").notNull().default(1),
  result: varchar("result", { length: 190 }).notNull(),
  problem: text("problem"),
  cause: text("cause"),
  rootCauseUnknownReason: text("root_cause_unknown_reason"),
  solution: text("solution").notNull(),
  escalation: text("escalation"),
  notes: text("notes"),
  testProcedure: text("test_procedure"),
  testResult: text("test_result"),
  remainingIssue: text("remaining_issue"),
  recommendation: text("recommendation"),
  managerDecision: mysqlEnum("manager_decision", managerDecisionValues).notNull().default("PENDING"),
  managerId: varchar("manager_id", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
  managerComment: text("manager_comment"),
  managerReviewedAt: datetime("manager_reviewed_at", { mode: "date", fsp: 3 }),
  durationMinutes: int("duration_minutes").notNull(),
  beforePhotoAttachmentIds: longtext("before_photo_attachment_ids"),
  afterPhotoAttachmentIds: longtext("after_photo_attachment_ids"),
  completedBy: varchar("completed_by", { length: 36 }).notNull().references(() => users.id),
  completedAt: datetime("completed_at", { mode: "date", fsp: 3 }).notNull(),
  createdAt: datetime("created_at", { mode: "date", fsp: 3 }).notNull(),
}, (table) => [uniqueIndex("work_order_completions_revision_uq").on(table.workOrderId, table.revisionNumber), index("work_order_completions_order_idx").on(table.workOrderId, table.completedAt)]);

export const workOrderSpareParts = mysqlTable("work_order_spare_parts", {
  id: varchar("id", { length: 36 }).primaryKey(),
  workOrderId: varchar("work_order_id", { length: 36 }).notNull().references(() => workOrders.id, { onDelete: "cascade" }),
  sparePartId: varchar("spare_part_id", { length: 36 }).notNull().references(() => spareParts.id),
  quantity: decimal("quantity", { precision: 14, scale: 4 }).notNull(),
  transactionType: varchar("transaction_type", { length: 40 }).notNull().default("CONSUMED"),
  warehouse: varchar("warehouse", { length: 120 }),
  storageLocation: varchar("storage_location", { length: 120 }),
  unitSnapshot: varchar("unit_snapshot", { length: 40 }),
  referenceDocument: varchar("reference_document", { length: 190 }),
  note: text("note"),
  usedBy: varchar("used_by", { length: 36 }).notNull().references(() => users.id),
  usedAt: datetime("used_at", { mode: "date", fsp: 3 }).notNull(),
}, (table) => [index("work_order_spare_parts_order_idx").on(table.workOrderId, table.usedAt)]);

export const workOrderVerifications = mysqlTable("work_order_verifications", {
  id: varchar("id", { length: 36 }).primaryKey(),
  workOrderId: varchar("work_order_id", { length: 36 }).notNull().references(() => workOrders.id, { onDelete: "cascade" }),
  completionId: varchar("completion_id", { length: 36 }).notNull().references(() => workOrderCompletions.id, { onDelete: "cascade" }),
  decision: mysqlEnum("decision", verificationDecisionValues).notNull(),
  note: text("note").notNull(),
  verifiedBy: varchar("verified_by", { length: 36 }).notNull().references(() => users.id),
  verifiedAt: datetime("verified_at", { mode: "date", fsp: 3 }).notNull(),
}, (table) => [uniqueIndex("work_order_verifications_completion_uq").on(table.completionId), index("work_order_verifications_order_idx").on(table.workOrderId)]);

export const workOrderEvents = mysqlTable("work_order_events", {
  id: varchar("id", { length: 36 }).primaryKey(),
  workOrderId: varchar("work_order_id", { length: 36 }).notNull().references(() => workOrders.id, { onDelete: "cascade" }),
  eventType: varchar("event_type", { length: 60 }).notNull(),
  fromStatus: mysqlEnum("from_status", workOrderStatusValues),
  toStatus: mysqlEnum("to_status", workOrderStatusValues),
  note: text("note"),
  actorUserId: varchar("actor_user_id", { length: 36 }).notNull().references(() => users.id),
  actorRole: varchar("actor_role", { length: 80 }),
  metadata: longtext("metadata"),
  createdAt: datetime("created_at", { mode: "date", fsp: 3 }).notNull(),
}, (table) => [index("work_order_events_order_idx").on(table.workOrderId, table.createdAt)]);

export const notificationEvents = mysqlTable("maintenance_notification_events", {
  id: varchar("id", { length: 36 }).primaryKey(), notificationId: varchar("notification_id", { length: 36 }).notNull().references(() => maintenanceNotifications.id, { onDelete: "cascade" }), eventType: varchar("event_type", { length: 80 }).notNull(), fromStatus: mysqlEnum("from_status", notificationStatusValues), toStatus: mysqlEnum("to_status", notificationStatusValues), note: text("note"), actorUserId: varchar("actor_user_id", { length: 36 }).notNull().references(() => users.id), actorRole: varchar("actor_role", { length: 80 }), metadata: longtext("metadata"), createdAt: datetime("created_at", { mode: "date", fsp: 3 }).notNull(),
}, (table) => [index("maintenance_notification_events_idx").on(table.notificationId, table.createdAt)]);

export const workOrderRechecks = mysqlTable("work_order_rechecks", {
  id: varchar("id", { length: 36 }).primaryKey(), workOrderId: varchar("work_order_id", { length: 36 }).notNull().references(() => workOrders.id, { onDelete: "cascade" }), completionId: varchar("completion_id", { length: 36 }).references(() => workOrderCompletions.id, { onDelete: "set null" }), cycleNumber: int("cycle_number").notNull(), requestedByUserId: varchar("requested_by_user_id", { length: 36 }).notNull().references(() => users.id), requestedByRole: varchar("requested_by_role", { length: 80 }).notNull(), returnReason: text("return_reason").notNull(), requiredActions: longtext("required_actions").notNull(), attachmentIds: longtext("attachment_ids"), assignedTechnicianId: varchar("assigned_technician_id", { length: 36 }).references(() => users.id, { onDelete: "set null" }), returnedAt: datetime("returned_at", { mode: "date", fsp: 3 }).notNull(), dueAt: datetime("due_at", { mode: "date", fsp: 3 }), status: mysqlEnum("status", recheckStatusValues).notNull().default("OPEN"), resolvedAt: datetime("resolved_at", { mode: "date", fsp: 3 }),
}, (table) => [uniqueIndex("work_order_rechecks_cycle_uq").on(table.workOrderId, table.cycleNumber), index("work_order_rechecks_status_idx").on(table.workOrderId, table.status)]);

export const workOrderOperatorDecisions = mysqlTable("work_order_operator_decisions", {
  id: varchar("id", { length: 36 }).primaryKey(), workOrderId: varchar("work_order_id", { length: 36 }).notNull().references(() => workOrders.id, { onDelete: "cascade" }), notificationId: varchar("notification_id", { length: 36 }).notNull().references(() => maintenanceNotifications.id), decision: mysqlEnum("decision", operatorDecisionValues).notNull(), reason: text("reason"), remainingProblem: text("remaining_problem"), attachmentIds: longtext("attachment_ids"), decidedBy: varchar("decided_by", { length: 36 }).notNull().references(() => users.id), decidedAt: datetime("decided_at", { mode: "date", fsp: 3 }).notNull(),
}, (table) => [index("work_order_operator_decisions_idx").on(table.workOrderId, table.decidedAt)]);
