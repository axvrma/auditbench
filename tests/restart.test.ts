import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
test("engine restart marks interrupted audits failed while preserving modules and historical PWA data", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "lighthouse-restart-"));
  const env = { ...process.env, LIGHTHOUSE_DATA_DIR: directory };
  function run(source: string) {
    return execFileSync(
      process.execPath,
      ["--import", "tsx", "--input-type=module", "-e", source],
      { env, encoding: "utf8" },
    );
  }
  try {
    run(
      `import {db} from './server/src/db.ts'; db.prepare("INSERT INTO modules(id,name)VALUES('m','Existing')").run();db.prepare("INSERT INTO urls(id,module_id,url)VALUES('u','m','https://example.com')").run();db.prepare("INSERT INTO audits(id,url_id,status,pwa_score)VALUES('historic','u','completed',98)").run();db.prepare("INSERT INTO audits(id,url_id,status)VALUES('interrupted','u','running')").run();db.close();`,
    );
    const value = run(
      `import {db} from './server/src/db.ts';console.log(JSON.stringify({module:db.prepare("SELECT name FROM modules").get(),historic:db.prepare("SELECT pwa_score FROM audits WHERE id='historic'").get(),interrupted:db.prepare("SELECT status FROM audits WHERE id='interrupted'").get()}));db.close();`,
    );
    const result = JSON.parse(value.trim().split("\n").at(-1)!);
    assert.equal(result.module.name, "Existing");
    assert.equal(result.historic.pwa_score, 98);
    assert.equal(result.interrupted.status, "failed");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
