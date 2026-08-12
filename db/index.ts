import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

let initialization: Promise<unknown> | undefined;

export async function getDb() {
  const { env } = await import("cloudflare:workers");
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database."
    );
  }

  initialization ??= env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      registration_code TEXT NOT NULL,
      bib_number TEXT NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      category TEXT NOT NULL,
      chip_id TEXT,
      status TEXT DEFAULT 'REGISTERED' NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      assigned_at TEXT,
      verified_at TEXT
    )`),
    env.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS participants_registration_code_unique ON participants (registration_code)"),
    env.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS participants_bib_number_unique ON participants (bib_number)"),
    env.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS participants_chip_id_unique ON participants (chip_id)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS participants_status_idx ON participants (status)"),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS bib_sequences (
      scope TEXT PRIMARY KEY NOT NULL,
      next_value INTEGER NOT NULL
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS verification_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      chip_id TEXT NOT NULL,
      participant_id INTEGER REFERENCES participants(id),
      result TEXT NOT NULL,
      device_id TEXT DEFAULT 'UNKNOWN' NOT NULL,
      scanned_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    )`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS verification_logs_chip_idx ON verification_logs (chip_id)"),
  ]);
  await initialization;

  return drizzle(env.DB, { schema });
}
