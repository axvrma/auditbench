import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readdirSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
process.env.LIGHTHOUSE_DATA_DIR = mkdtempSync(
  path.join(tmpdir(), "lighthouse-locked-"),
);
delete process.env.LIGHTHOUSE_SECRET_KEY;
const { db } = await import("../server/src/db.js");
const {
  encryptSecret,
  decryptSecret,
  migrateSecrets,
  redact,
  configureSecrets,
} = await import("../server/src/secrets.js");
after(() => {
  db.close();
  rmSync(process.env.LIGHTHOUSE_DATA_DIR!, { recursive: true, force: true });
});
test("unavailable OS storage never silently writes or uses plaintext and preserves recoverable legacy data", async () => {
  await assert.rejects(() => encryptSecret("value"), /unavailable/);
  await assert.rejects(() => decryptSecret("legacy"), /locked/);
  db.prepare(
    "INSERT INTO credentials (id,name,username,password) VALUES ('legacy','Legacy','user','plain-legacy')",
  ).run();
  assert.match((await migrateSecrets(db))!, /locked/);
  assert.equal(
    (
      db.prepare("SELECT password FROM credentials").get() as {
        password: string;
      }
    ).password,
    "plain-legacy",
  );
  assert.equal(
    readdirSync(process.env.LIGHTHOUSE_DATA_DIR!).filter((f) =>
      f.startsWith("pre-encryption"),
    ).length,
    0,
  );
  assert.deepEqual(redact({ id: "legacy", password: "plain-legacy" }), {
    id: "legacy",
    has_password: true,
  });
});

test("asynchronous OS protection errors preserve plaintext recovery data without partial migration", async () => {
  configureSecrets({
    encrypt: async () => {
      throw new Error("OS store locked");
    },
    decrypt: async () => {
      throw new Error("OS store locked");
    },
  });
  assert.match((await migrateSecrets(db))!, /No data was changed/);
  assert.equal(
    (
      db.prepare("SELECT password FROM credentials").get() as {
        password: string;
      }
    ).password,
    "plain-legacy",
  );
  assert.equal(
    readdirSync(process.env.LIGHTHOUSE_DATA_DIR!).filter((f) =>
      f.startsWith("pre-encryption"),
    ).length,
    0,
  );
});
