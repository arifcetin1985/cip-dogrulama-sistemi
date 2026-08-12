import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const participants = sqliteTable("participants", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  registrationCode: text("registration_code").notNull(),
  bibNumber: text("bib_number").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  category: text("category").notNull(),
  gender: text("gender", { enum: ["ERKEK", "KADIN"] }).notNull().default("ERKEK"),
  chipId: text("chip_id"),
  status: text("status", { enum: ["REGISTERED", "ASSIGNED", "VERIFIED"] }).notNull().default("REGISTERED"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  assignedAt: text("assigned_at"),
  verifiedAt: text("verified_at"),
}, (table) => [
  uniqueIndex("participants_registration_code_unique").on(table.registrationCode),
  uniqueIndex("participants_bib_number_unique").on(table.bibNumber),
  uniqueIndex("participants_chip_id_unique").on(table.chipId),
  index("participants_status_idx").on(table.status),
]);

export const bibSequences = sqliteTable("bib_sequences", {
  scope: text("scope").primaryKey(),
  nextValue: integer("next_value").notNull(),
});

export const verificationLogs = sqliteTable("verification_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  chipId: text("chip_id").notNull(),
  participantId: integer("participant_id").references(() => participants.id),
  result: text("result", { enum: ["MATCH", "UNKNOWN"] }).notNull(),
  deviceId: text("device_id").notNull().default("UNKNOWN"),
  scannedAt: text("scanned_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("verification_logs_chip_idx").on(table.chipId)]);
