import Database, { Database as DatabaseType } from "better-sqlite3";
import path from "path";
import { chmodSync } from "node:fs";
import { migrateSecrets } from "./secrets.js";
import { dataDirectory } from "./paths.js";

const dbPath = path.join(dataDirectory, "data.db");

export const db: DatabaseType = new Database(dbPath);

db.pragma("foreign_keys = ON");
db.pragma("secure_delete = ON");
db.pragma("busy_timeout = 5000");
chmodSync(dbPath, 0o600);

// Initialize database schema
db.exec(`
  CREATE TABLE IF NOT EXISTS modules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT DEFAULT '#3b82f6',
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS credentials (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    auth_url TEXT,
    username TEXT NOT NULL,
    password TEXT NOT NULL,
    username_selector TEXT DEFAULT 'input[type="email"], input[name="username"], input[name="email"], #username, #email',
    password_selector TEXT DEFAULT 'input[type="password"], #password',
    submit_selector TEXT DEFAULT 'button[type="submit"], input[type="submit"]',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS urls (
    id TEXT PRIMARY KEY,
    module_id TEXT REFERENCES modules(id) ON DELETE CASCADE,
    url TEXT NOT NULL UNIQUE,
    name TEXT,
    schedule TEXT DEFAULT 'daily',
    is_active INTEGER DEFAULT 1,
    credential_id TEXT REFERENCES credentials(id) ON DELETE SET NULL,
    auth_url TEXT,
    auth_username TEXT,
    auth_password TEXT,
    auth_username_selector TEXT DEFAULT 'input[type="email"], input[name="username"], input[name="email"], #username, #email',
    auth_password_selector TEXT DEFAULT 'input[type="password"], #password',
    auth_submit_selector TEXT DEFAULT 'button[type="submit"], input[type="submit"]',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS audits (
    id TEXT PRIMARY KEY,
    url_id TEXT REFERENCES urls(id) ON DELETE CASCADE,
    performance_score INTEGER,
    accessibility_score INTEGER,
    best_practices_score INTEGER,
    seo_score INTEGER,
    pwa_score INTEGER,
    screenshot_path TEXT,
    full_report TEXT,
    status TEXT DEFAULT 'completed',
    error_message TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS suggestions (
    id TEXT PRIMARY KEY,
    audit_id TEXT REFERENCES audits(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    audit_ref TEXT,
    title TEXT NOT NULL,
    description TEXT,
    score REAL,
    savings_ms INTEGER DEFAULT 0,
    savings_bytes INTEGER DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_urls_module_id ON urls(module_id);
  CREATE INDEX IF NOT EXISTS idx_audits_url_id ON audits(url_id);
  CREATE INDEX IF NOT EXISTS idx_suggestions_audit_id ON suggestions(audit_id);
`);

db.exec(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_audits_history ON audits(url_id, created_at DESC);`);
const auditColumns = db.prepare("PRAGMA table_info(audits)").all() as {
  name: string;
}[];
if (!auditColumns.some((column) => column.name === "audit_profile"))
  db.exec("ALTER TABLE audits ADD COLUMN audit_profile TEXT");
if (!auditColumns.some((column) => column.name === "completed_at"))
  db.exec("ALTER TABLE audits ADD COLUMN completed_at TEXT");
export const migrationNotice = await migrateSecrets(db);
db.prepare(
  "UPDATE audits SET status = 'failed', error_message = 'The engine stopped before this audit finished.' WHERE status = 'running'",
).run();

// Helper to generate UUIDs
export function generateId(): string {
  return crypto.randomUUID();
}

console.log("Database initialized at:", dbPath);
