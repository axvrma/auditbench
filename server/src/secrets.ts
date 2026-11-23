import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { chmodSync } from "node:fs";
import type { Database } from "better-sqlite3";
import path from "node:path";
import { dataDirectory } from "./paths.js";

export interface SecretProtector {
  encrypt(value: string): string | Promise<string>;
  decrypt(value: string): string | Promise<string>;
}
let protector: SecretProtector | undefined;
export function configureSecrets(value: SecretProtector) {
  protector = value;
}
const key = process.env.LIGHTHOUSE_SECRET_KEY;
if (key) {
  const bytes = Buffer.from(key, "base64");
  if (bytes.length !== 32)
    throw new Error(
      "LIGHTHOUSE_SECRET_KEY must be a base64-encoded 32-byte key.",
    );
  configureSecrets({
    encrypt(value) {
      const iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", bytes, iv);
      const encrypted = Buffer.concat([
        cipher.update(value, "utf8"),
        cipher.final(),
      ]);
      return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString(
        "base64",
      );
    },
    decrypt(value) {
      const packed = Buffer.from(value, "base64");
      const decipher = createDecipheriv(
        "aes-256-gcm",
        bytes,
        packed.subarray(0, 12),
      );
      decipher.setAuthTag(packed.subarray(12, 28));
      return Buffer.concat([
        decipher.update(packed.subarray(28)),
        decipher.final(),
      ]).toString("utf8");
    },
  });
}
export function secretAvailable() {
  return Boolean(protector);
}
export async function encryptSecret(value: string): Promise<string> {
  if (!protector)
    throw new Error(
      "Secure secret storage is unavailable. Open the desktop app with an unlocked OS key store, or configure an external development key.",
    );
  try {
    return `protected:v1:${await protector.encrypt(value)}`;
  } catch {
    throw new Error(
      "The OS key store could not protect this password. Unlock it and restart the application.",
    );
  }
}
export async function decryptSecret(value: string): Promise<string> {
  if (!value) return "";
  if (!protector || !value.startsWith("protected:v1:"))
    throw new Error(
      "Saved authentication is locked. Secure migration is required in the desktop app.",
    );
  try {
    return await protector.decrypt(value.slice(13));
  } catch {
    throw new Error(
      "Saved authentication could not be unlocked. Restore access to the original OS key store or replace this password.",
    );
  }
}
export function redact<
  T extends { password?: string | null; auth_password?: string | null },
>(row: T) {
  const { password, auth_password, ...safe } = row;
  return { ...safe, has_password: Boolean(password || auth_password) };
}
export async function migrateSecrets(db: Database): Promise<string | null> {
  const credentials = db
    .prepare(
      "SELECT id, password FROM credentials WHERE password != '' AND password NOT LIKE 'protected:v1:%'",
    )
    .all() as { id: string; password: string }[];
  const urls = db
    .prepare(
      "SELECT id, auth_password FROM urls WHERE auth_password IS NOT NULL AND auth_password != '' AND auth_password NOT LIKE 'protected:v1:%'",
    )
    .all() as { id: string; auth_password: string }[];
  if (!credentials.length && !urls.length) return null;
  if (!protector)
    return "Legacy passwords are locked. Open the desktop application with secure OS storage to migrate them. No data was removed.";
  // Complete all OS requests before opening a synchronous SQLite transaction.
  let protectedCredentials: { id: string; password: string }[];
  let protectedUrls: { id: string; password: string }[];
  try {
    protectedCredentials = await Promise.all(
      credentials.map(async (row) => ({
        id: row.id,
        password: await encryptSecret(row.password),
      })),
    );
    protectedUrls = await Promise.all(
      urls.map(async (row) => ({
        id: row.id,
        password: await encryptSecret(row.auth_password),
      })),
    );
  } catch {
    return "Legacy passwords remain locked because OS protection could not be completed. No data was changed. Unlock your key store and restart the app to retry.";
  }
  const backup = path.join(dataDirectory, `pre-encryption-${Date.now()}.db`);
  db.prepare("VACUUM INTO ?").run(backup);
  chmodSync(backup, 0o600);
  db.transaction(() => {
    for (const row of protectedCredentials)
      db.prepare("UPDATE credentials SET password = ? WHERE id = ?").run(
        row.password,
        row.id,
      );
    for (const row of protectedUrls)
      db.prepare("UPDATE urls SET auth_password = ? WHERE id = ?").run(
        row.password,
        row.id,
      );
  })();
  db.exec("VACUUM");
  return `Passwords migrated to secure storage. A sensitive plaintext recovery backup remains at ${backup}. Remove it after verifying your credentials.`;
}
