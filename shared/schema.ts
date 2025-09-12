import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  decimal,
  pgEnum,
  uuid,
  boolean,
  integer,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role").notNull().default('provider'), // 'provider', 'billing', 'admin'
  orgId: uuid("org_id").references(() => organizations.id),
  notificationsEnabled: boolean("notifications_enabled").default(false),
  preferredLanguage: varchar("preferred_language", { length: 5 }), // User's preferred language (overrides org default)
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Push notification subscriptions
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  orgId: uuid("org_id").references(() => organizations.id).notNull(),
  endpoint: text("endpoint").notNull(),
  p256dhKey: text("p256dh_key").notNull(),
  authKey: text("auth_key").notNull(),
  userAgent: text("user_agent"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  externalId: varchar("external_id", { length: 255 }).unique(),
  province: varchar("province", { length: 2 }), // ON, QC, BC, etc.
  preferredLanguage: varchar("preferred_language", { length: 5 }).default('en-CA'), // en-CA or fr-CA
  // Quebec Law 25 fields
  privacyOfficerName: varchar("privacy_officer_name"),
  privacyOfficerEmail: varchar("privacy_officer_email"),
  dataRetentionDays: integer("data_retention_days").default(2555), // ~7 years default
  privacyContactUrl: varchar("privacy_contact_url"),
  minimizeLogging: boolean("minimize_logging").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const patients = pgTable("patients", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: uuid("org_id").references(() => organizations.id).notNull(),
  name: varchar("name").notNull(),
  dob: timestamp("dob"),
  identifiers: jsonb("identifiers"), // insurance numbers, etc.
  createdAt: timestamp("created_at").defaultNow(),
});

export const providers = pgTable("providers", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: uuid("org_id").references(() => organizations.id).notNull(),
  name: varchar("name").notNull(),
  discipline: varchar("discipline"),
  licenceNumber: varchar("licence_number"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const appointments = pgTable("appointments", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: uuid("org_id").references(() => organizations.id).notNull(),
  patientId: uuid("patient_id").references(() => patients.id).notNull(),
  providerId: uuid("provider_id").references(() => providers.id).notNull(),
  scheduledAt: timestamp("scheduled_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const claimStatusEnum = pgEnum("claim_status", [
  "draft",
  "submitted", 
  "pending",
  "infoRequested",
  "paid",
  "denied"
]);

export const claimTypeEnum = pgEnum("claim_type", ["claim", "preauth"]);

export const railEnum = pgEnum("rail", ["telusEclaims", "cdanet", "portal"]);

export const insurers = pgTable("insurers", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  rail: railEnum("rail").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const claims = pgTable("claims", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: uuid("org_id").references(() => organizations.id).notNull(),
  patientId: uuid("patient_id").references(() => patients.id).notNull(),
  providerId: uuid("provider_id").references(() => providers.id).notNull(),
  insurerId: uuid("insurer_id").references(() => insurers.id).notNull(),
  appointmentId: uuid("appointment_id").references(() => appointments.id),
  claimNumber: varchar("claim_number"), // Add missing claim number field
  type: claimTypeEnum("type").notNull(),
  status: claimStatusEnum("status").notNull().default("draft"),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency").notNull().default("CAD"),
  codes: jsonb("codes"), // procedure codes
  notes: text("notes"),
  referenceNumber: varchar("reference_number"),
  externalId: varchar("external_id"), // EDI connector external reference
  // Portal submission tracking
  portalReferenceNumber: varchar("portal_reference_number"), // External ref from WCB/WSIB portal
  portalSubmissionDate: timestamp("portal_submission_date"), // When submitted to portal
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Pre-authorization table
export const preAuths = pgTable("preauths", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: uuid("org_id").references(() => organizations.id).notNull(),
  authNumber: varchar("auth_number").unique().notNull(),
  patientId: uuid("patient_id").references(() => patients.id).notNull(),
  providerId: uuid("provider_id").references(() => providers.id).notNull(),
  insurerId: uuid("insurer_id").references(() => insurers.id).notNull(),
  status: claimStatusEnum("status").notNull().default("draft"),
  requestedAmount: decimal("requested_amount", { precision: 10, scale: 2 }).notNull(),
  approvedAmount: decimal("approved_amount", { precision: 10, scale: 2 }),
  expiryDate: timestamp("expiry_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: varchar("created_by").references(() => users.id).notNull(),
});

export const attachments = pgTable("attachments", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  claimId: uuid("claim_id").references(() => claims.id).notNull(),
  url: varchar("url").notNull(),
  mime: varchar("mime").notNull(),
  kind: varchar("kind").notNull(), // 'photo', 'pdf', 'note'
  checksum: varchar("checksum"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const remittances = pgTable("remittances", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  insurerId: uuid("insurer_id").references(() => insurers.id).notNull(),
  claimId: uuid("claim_id").references(() => claims.id),
  status: varchar("status").notNull(),
  amountPaid: decimal("amount_paid", { precision: 10, scale: 2 }),
  raw: jsonb("raw"), // raw remittance data
  createdAt: timestamp("created_at").defaultNow(),
});

export const auditEvents = pgTable("audit_events", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: uuid("org_id").references(() => organizations.id).notNull(),
  actorUserId: varchar("actor_user_id").references(() => users.id),
  type: varchar("type").notNull(), // 'claim_created', 'claim_submitted', 'sso_login', etc.
  details: jsonb("details").notNull(),
  ip: varchar("ip"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
});

// EDI Connector Tables
export const connectorModeEnum = pgEnum("connector_mode", ["live", "sandbox"]);
export const connectorNameEnum = pgEnum("connector_name", ["cdanet", "eclaims", "portal"]);
export const transactionTypeEnum = pgEnum("transaction_type", ["submit", "poll", "error"]);

export const connectorConfigs = pgTable("connector_configs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: uuid("org_id").references(() => organizations.id).notNull(),
  name: connectorNameEnum("name").notNull(),
  enabled: boolean("enabled").default(false),
  mode: connectorModeEnum("mode").default("sandbox"),
  settings: jsonb("settings"), // connector-specific settings
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  // Unique constraint on orgId + name
  index("unique_org_connector").on(table.orgId, table.name),
]);

export const connectorTransactions = pgTable("connector_transactions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  claimId: uuid("claim_id").references(() => claims.id).notNull(),
  connector: connectorNameEnum("connector").notNull(),
  type: transactionTypeEnum("type").notNull(),
  externalId: varchar("external_id"), // external system reference
  status: varchar("status").notNull(), // pending, submitted, paid, denied, error
  payload: jsonb("payload"), // request/response data
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const connectorErrors = pgTable("connector_errors", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  transactionId: uuid("transaction_id").references(() => connectorTransactions.id).notNull(),
  code: varchar("code").notNull(), // error taxonomy code
  message: text("message").notNull(),
  category: varchar("category").notNull(), // VALIDATION_ERROR, NETWORK_ERROR, etc.
  details: jsonb("details"), // additional error context
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOrganizationSchema = createInsertSchema(organizations).omit({
  id: true,
  createdAt: true,
});

export const insertPatientSchema = createInsertSchema(patients).omit({
  id: true,
  createdAt: true,
});

export const insertProviderSchema = createInsertSchema(providers).omit({
  id: true,
  createdAt: true,
});

export const insertClaimSchema = createInsertSchema(claims).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPreAuthSchema = createInsertSchema(preAuths).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAttachmentSchema = createInsertSchema(attachments).omit({
  id: true,
  createdAt: true,
});

export const insertRemittanceSchema = createInsertSchema(remittances).omit({
  id: true,
  createdAt: true,
});

export const insertAuditEventSchema = createInsertSchema(auditEvents).omit({
  id: true,
  createdAt: true,
});

export const insertPushSubscriptionSchema = createInsertSchema(pushSubscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertConnectorConfigSchema = createInsertSchema(connectorConfigs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertConnectorTransactionSchema = createInsertSchema(connectorTransactions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertConnectorErrorSchema = createInsertSchema(connectorErrors).omit({
  id: true,
  createdAt: true,
});

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type InsertPushSubscription = typeof pushSubscriptions.$inferInsert;
export type Organization = typeof organizations.$inferSelect;
export type Patient = typeof patients.$inferSelect;
export type Provider = typeof providers.$inferSelect;
export type Appointment = typeof appointments.$inferSelect;
export type Insurer = typeof insurers.$inferSelect;
export type Claim = typeof claims.$inferSelect;
export type PreAuth = typeof preAuths.$inferSelect;
export type Attachment = typeof attachments.$inferSelect;
export type Remittance = typeof remittances.$inferSelect;
export type AuditEvent = typeof auditEvents.$inferSelect;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type InsertPatient = z.infer<typeof insertPatientSchema>;
export type InsertProvider = z.infer<typeof insertProviderSchema>;
export type InsertClaim = z.infer<typeof insertClaimSchema>;
export type InsertPreAuth = z.infer<typeof insertPreAuthSchema>;
export type InsertAttachment = z.infer<typeof insertAttachmentSchema>;
export type InsertRemittance = z.infer<typeof insertRemittanceSchema>;
export type InsertAuditEvent = z.infer<typeof insertAuditEventSchema>;

// EDI Connector Types
export type ConnectorConfig = typeof connectorConfigs.$inferSelect;
export type InsertConnectorConfig = z.infer<typeof insertConnectorConfigSchema>;
export type ConnectorTransaction = typeof connectorTransactions.$inferSelect;
export type InsertConnectorTransaction = z.infer<typeof insertConnectorTransactionSchema>;
export type ConnectorError = typeof connectorErrors.$inferSelect;
export type InsertConnectorError = z.infer<typeof insertConnectorErrorSchema>;
