import { datetime, decimal, index, int, longtext, mysqlEnum, mysqlTable, text, uniqueIndex, varchar } from "drizzle-orm/mysql-core";
import { projectStatuses, taskStatuses } from "../planning/domain";

// Foreign keys are declared by the matching migration. Keeping this module
// independent avoids circular schema initialization with work_orders.
const identity = () => ({ id: varchar("id", { length: 36 }).primaryKey(), organizationId: varchar("organization_id", { length: 36 }).notNull(), siteId: varchar("site_id", { length: 36 }).notNull(), departmentId: varchar("department_id", { length: 36 }), createdBy: varchar("created_by", { length: 36 }).notNull(), createdAt: datetime("created_at", { mode: "date", fsp: 3 }).notNull(), updatedAt: datetime("updated_at", { mode: "date", fsp: 3 }).notNull(), version: int("version").notNull().default(1) });
export const maintenanceProjects = mysqlTable("maintenance_projects", {
  ...identity(), code: varchar("code", { length: 60 }).notNull(), name: varchar("name", { length: 190 }).notNull(), description: text("description").notNull(),
  ownerId: varchar("owner_id", { length: 36 }).notNull(), operatorId: varchar("operator_id", { length: 36 }).notNull(),
  status: mysqlEnum("status", projectStatuses).notNull().default("DRAFT"), priority: mysqlEnum("priority", ["LOW", "MEDIUM", "HIGH", "CRITICAL"]).notNull().default("MEDIUM"),
  plannedStartAt: datetime("planned_start_at", { mode: "date", fsp: 3 }).notNull(), plannedFinishAt: datetime("planned_finish_at", { mode: "date", fsp: 3 }).notNull(),
  actualFinishAt: datetime("actual_finish_at", { mode: "date", fsp: 3 }), progress: decimal("progress", { precision: 5, scale: 2 }).notNull().default("0"), closureNote: text("closure_note"), baseline: longtext("baseline"),
}, t => [uniqueIndex("maintenance_projects_code_uq").on(t.organizationId, t.code), index("maintenance_projects_scope_idx").on(t.organizationId, t.siteId, t.status)]);
export const maintenanceProjectTasks = mysqlTable("maintenance_project_tasks", {
  ...identity(), projectId: varchar("project_id", { length: 36 }).notNull(), parentId: varchar("parent_id", { length: 36 }), name: varchar("name", { length: 190 }).notNull(), description: text("description").notNull(),
  kind: mysqlEnum("kind", ["EXECUTION", "SUMMARY", "MILESTONE"]).notNull(), phase: mysqlEnum("phase", ["PREPARATION", "SHUTDOWN", "RESTORATION"]).notNull(), status: mysqlEnum("status", taskStatuses).notNull().default("DRAFT"),
  assetId: varchar("asset_id", { length: 36 }), assignedTo: varchar("assigned_to", { length: 36 }), plannedStartAt: datetime("planned_start_at", { mode: "date", fsp: 3 }).notNull(), plannedFinishAt: datetime("planned_finish_at", { mode: "date", fsp: 3 }).notNull(), estimatedMinutes: int("estimated_minutes").notNull(),
  workOrderId: varchar("work_order_id", { length: 36 }), steps: longtext("steps").notNull(), reason: text("reason"), actualFinishAt: datetime("actual_finish_at", { mode: "date", fsp: 3 }),
}, t => [index("project_tasks_project_idx").on(t.projectId, t.status), uniqueIndex("project_tasks_wo_uq").on(t.workOrderId)]);
export const projectTaskDependencies = mysqlTable("project_task_dependencies", { id: varchar("id", { length: 36 }).primaryKey(), projectId: varchar("project_id", { length: 36 }).notNull(), predecessorId: varchar("predecessor_id", { length: 36 }).notNull(), successorId: varchar("successor_id", { length: 36 }).notNull() }, t => [uniqueIndex("project_dependency_uq").on(t.predecessorId, t.successorId), index("project_dependency_project_idx").on(t.projectId)]);
export const maintenanceTemplates = mysqlTable("maintenance_templates", { ...identity(), name: varchar("name", { length: 190 }).notNull(), steps: longtext("steps").notNull() });
export const preventivePrograms = mysqlTable("preventive_programs", {
  priority: mysqlEnum("priority", ["LOW", "MEDIUM", "HIGH", "CRITICAL"]).notNull().default("MEDIUM"), estimatedMinutes: int("estimated_minutes").notNull().default(60),
  ...identity(), name: varchar("name", { length: 190 }).notNull(), assetId: varchar("asset_id", { length: 36 }).notNull(), templateId: varchar("template_id", { length: 36 }).notNull(), templateVersion: int("template_version").notNull(), steps: longtext("steps").notNull(),
  assignedTo: varchar("assigned_to", { length: 36 }).notNull(), operatorId: varchar("operator_id", { length: 36 }).notNull(),
  status: mysqlEnum("status", ["ACTIVE", "PAUSED", "EXPIRED"]).notNull().default("PAUSED"),
  startDate: varchar("start_date", { length: 10 }).notNull(), expiryDate: varchar("expiry_date", { length: 10 }).notNull(), frequency: mysqlEnum("frequency", ["DAY", "WEEK", "MONTH"]).notNull(), interval: int("interval_value").notNull(), timezone: varchar("timezone", { length: 80 }).notNull(), localTime: varchar("local_time", { length: 5 }).notNull(), leadTimeDays: int("lead_time_days").notNull().default(0),
}, t => [index("preventive_programs_scope_idx").on(t.organizationId, t.siteId, t.status)]);
export const pmOccurrences = mysqlTable("pm_occurrences", {
  id: varchar("id", { length: 36 }).primaryKey(), programId: varchar("program_id", { length: 36 }).notNull(), organizationId: varchar("organization_id", { length: 36 }).notNull(), assetId: varchar("asset_id", { length: 36 }).notNull(), scheduledDate: varchar("scheduled_date", { length: 10 }).notNull(), scheduledAt: datetime("scheduled_at", { mode: "date", fsp: 3 }).notNull(),
  status: mysqlEnum("status", ["GENERATED", "COMPLETED", "SKIPPED"]).notNull(), workOrderId: varchar("work_order_id", { length: 36 }), programVersion: int("program_version").notNull(), reason: text("reason"), createdAt: datetime("created_at", { mode: "date", fsp: 3 }).notNull(), completedAt: datetime("completed_at", { mode: "date", fsp: 3 }),
}, t => [uniqueIndex("pm_occurrences_schedule_uq").on(t.programId, t.assetId, t.scheduledDate), uniqueIndex("pm_occurrences_wo_uq").on(t.workOrderId)]);
export const planningEvents = mysqlTable("planning_events", { id: varchar("id", { length: 36 }).primaryKey(), organizationId: varchar("organization_id", { length: 36 }).notNull(), entityId: varchar("entity_id", { length: 36 }).notNull(), entityType: varchar("entity_type", { length: 30 }).notNull(), eventType: varchar("event_type", { length: 60 }).notNull(), actorId: varchar("actor_id", { length: 36 }).notNull(), note: text("note").notNull(), createdAt: datetime("created_at", { mode: "date", fsp: 3 }).notNull() }, t => [index("planning_events_entity_idx").on(t.entityId, t.createdAt)]);
