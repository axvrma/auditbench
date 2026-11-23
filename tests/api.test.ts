import { test, after } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  readdirSync,
  statSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { request } from "node:http";
process.env.LIGHTHOUSE_DATA_DIR = mkdtempSync(
  path.join(tmpdir(), "lighthouse-api-test-"),
);
process.env.LIGHTHOUSE_SECRET_KEY = randomBytes(32).toString("base64");
const { db } = await import("../server/src/db.js");
const { migrateSecrets, decryptSecret } = await import(
  "../server/src/secrets.js"
);
const { categoryScore, CATEGORIES } = await import(
  "../server/src/lighthouse.js"
);
const { startServer, stopAudits } = await import("../server/src/index.js");
const server = startServer(0);
await once(server, "listening");
const address = server.address();
if (!address || typeof address === "string") throw new Error("No API address");
const origin = `http://127.0.0.1:${address.port}`;
async function api(route: string, method = "GET", data?: object) {
  return fetch(origin + "/api" + route, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Lighthouse-Client": "workspace",
    },
    body: data ? JSON.stringify(data) : undefined,
  });
}
after(async () => {
  await stopAudits();
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  db.close();
  rmSync(process.env.LIGHTHOUSE_DATA_DIR!, { recursive: true, force: true });
});

test("local API denies missing client header, untrusted origin and DNS rebinding hosts", async () => {
  assert.equal((await fetch(origin + "/api/modules")).status, 403);
  assert.equal(
    (
      await fetch(origin + "/api/modules", {
        headers: {
          "X-Lighthouse-Client": "workspace",
          Origin: "https://example.com",
        },
      })
    ).status,
    403,
  );
  const rebound = await new Promise<number | undefined>((resolve, reject) => {
    const req = request(
      origin + "/api/modules",
      { headers: { "X-Lighthouse-Client": "workspace", Host: "evil.example" } },
      (response) => {
        response.resume();
        resolve(response.statusCode);
      },
    );
    req.on("error", reject);
    req.end();
  });
  assert.equal(rebound, 403);
  assert.equal(
    (await api("/modules")).headers.get("x-content-type-options"),
    "nosniff",
  );
});
test("module and website CRUD validates, edits addresses, toggles state and cascades deletion", async () => {
  assert.equal((await api("/modules", "POST", {})).status, 400);
  const module = await (
    await api("/modules", "POST", {
      name: "Test project",
      description: "Integration",
      color: "#2e7457",
    })
  ).json();
  assert.equal(module.is_active, true);
  assert.equal(
    (await api("/modules/" + module.id, "PATCH", { is_active: "false" }))
      .status,
    400,
  );
  const renamed = await (
    await api("/modules/" + module.id, "PATCH", {
      name: "Renamed",
      is_active: false,
    })
  ).json();
  assert.equal(renamed.name, "Renamed");
  assert.equal(renamed.is_active, false);
  assert.equal(
    (
      await api("/urls", "POST", {
        module_id: module.id,
        url: "javascript:alert(1)",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await api("/urls", "POST", {
        module_id: "absent",
        url: "https://example.com",
      })
    ).status,
    400,
  );
  const site = await (
    await api("/urls", "POST", {
      module_id: module.id,
      url: "https://example.com",
      name: "Example",
    })
  ).json();
  assert.equal(site.auth_password, undefined);
  const changed = await (
    await api("/urls/" + site.id, "PATCH", {
      url: "https://example.com/changed",
      is_active: false,
    })
  ).json();
  assert.equal(changed.url, "https://example.com/changed");
  assert.equal(changed.is_active, false);
  assert.equal(
    (await api("/urls", "POST", { module_id: module.id, url: changed.url }))
      .status,
    409,
  );
  assert.equal((await api("/modules/" + module.id, "DELETE")).status, 200);
  assert.equal(
    db.prepare("SELECT id FROM urls WHERE id = ?").get(site.id),
    undefined,
  );
  assert.equal(
    (await api("/modules/missing", "PATCH", { name: "Missing" })).status,
    404,
  );
});
test("credentials encrypt at rest, redact every response, preserve omitted passwords and unlink on delete", async () => {
  const credential = await (
    await api("/credentials", "POST", {
      name: "Saved login",
      username: "tester",
      password: "a-secret-test-password",
    })
  ).json();
  assert.equal(credential.password, undefined);
  assert.equal(credential.has_password, true);
  const stored = db
    .prepare("SELECT password FROM credentials WHERE id = ?")
    .get(credential.id) as { password: string };
  assert.ok(stored.password.startsWith("protected:v1:"));
  assert.equal(await decryptSecret(stored.password), "a-secret-test-password");
  assert.ok(
    !(await (await api("/credentials")).text()).includes(
      "a-secret-test-password",
    ),
  );
  await api("/credentials/" + credential.id, "PATCH", {
    name: "Updated login",
  });
  assert.deepEqual(
    db
      .prepare("SELECT password FROM credentials WHERE id = ?")
      .get(credential.id),
    stored,
  );
  await api("/credentials/" + credential.id, "PATCH", {
    password: "replacement",
  });
  assert.equal(
    await decryptSecret(
      (
        db
          .prepare("SELECT password FROM credentials WHERE id = ?")
          .get(credential.id) as { password: string }
      ).password,
    ),
    "replacement",
  );
  assert.equal(
    (await api("/credentials/" + credential.id, "PATCH", { password: "" }))
      .status,
    400,
  );
  const module = await (
    await api("/modules", "POST", { name: "Auth project" })
  ).json();
  const site = await (
    await api("/urls", "POST", {
      module_id: module.id,
      credential_id: credential.id,
      url: "https://example.org",
    })
  ).json();
  await api("/credentials/" + credential.id, "DELETE");
  assert.equal(
    (
      db
        .prepare("SELECT credential_id FROM urls WHERE id = ?")
        .get(site.id) as { credential_id: null }
    ).credential_id,
    null,
  );
  const custom = await (
    await api("/urls/" + site.id, "PATCH", {
      auth_username: "tester",
      auth_password: "custom-password",
    })
  ).json();
  assert.equal(custom.auth_password, undefined);
  assert.equal(custom.has_password, true);
});
test("migration backs up legacy data, encrypts credentials and URL passwords, retains audits and is idempotent", async () => {
  db.prepare(
    "INSERT INTO credentials (id, name, username, password) VALUES ('legacy', 'Legacy', 'user', 'legacy-password')",
  ).run();
  db.prepare("UPDATE urls SET auth_password = 'old-url-password'").run();
  const notice = await migrateSecrets(db);
  assert.match(notice!, /Passwords migrated/);
  const backup = readdirSync(process.env.LIGHTHOUSE_DATA_DIR!).find((file) =>
    file.startsWith("pre-encryption-"),
  )!;
  assert.ok(backup);
  // Windows file access follows user ACLs; POSIX mode bits cannot express them.
  if (process.platform !== "win32")
    assert.equal(
      statSync(path.join(process.env.LIGHTHOUSE_DATA_DIR!, backup)).mode &
        0o777,
      0o600,
    );
  assert.equal(
    await decryptSecret(
      (
        db
          .prepare("SELECT password FROM credentials WHERE id='legacy'")
          .get() as { password: string }
      ).password,
    ),
    "legacy-password",
  );
  assert.equal(await migrateSecrets(db), null);
  assert.ok(
    !readFileSync(
      path.join(process.env.LIGHTHOUSE_DATA_DIR!, "data.db"),
    ).includes(Buffer.from("legacy-password")),
  );
});
test("audit trigger and failed progress are visible, disabled modules reject batch runs", async () => {
  const site = db.prepare("SELECT id, module_id FROM urls LIMIT 1").get() as {
    id: string;
    module_id: string;
  };
  // Invalid protected data fails before Chrome launch; no public success is fabricated.
  db.prepare(
    "UPDATE urls SET credential_id = NULL, auth_password='protected:v1:corrupt', auth_username='user', is_active=1 WHERE id=?",
  ).run(site.id);
  assert.equal(
    (
      await api("/audit/run", "POST", {
        url_id: site.id,
        module_id: site.module_id,
      })
    ).status,
    400,
  );
  assert.equal(
    (await api("/audit/run", "POST", { url_id: site.id })).status,
    200,
  );
  const progress = await (await api("/audit/status")).json();
  assert.equal(progress.inProgress, false);
  assert.equal(progress.completed, 1);
  assert.equal(progress.urls[0].status, "failed");
  const audit = (await (await api("/audits")).json())[0];
  assert.equal(audit.status, "failed");
  assert.equal(audit.full_report, undefined);
  await api("/modules/" + site.module_id, "PATCH", { is_active: false });
  assert.equal(
    (await api("/audit/run", "POST", { module_id: site.module_id })).status,
    400,
  );
});
test("history returns recent runs, full report is on demand, screenshot reference resolves, historic PWA survives", async () => {
  const site = db.prepare("SELECT id FROM urls LIMIT 1").get() as {
    id: string;
  };
  for (let i = 0; i < 35; i++)
    db.prepare(
      "INSERT INTO audits (id,url_id,performance_score,pwa_score,full_report,screenshot_path,created_at) VALUES (?,?,?,?,?,?,?)",
    ).run(
      `historic-${i}`,
      site.id,
      80,
      95,
      '{"test":"full report"}',
      "/screenshots/test.png",
      `2026-10-${String(Math.min(i + 1, 28)).padStart(2, "0")} 12:${String(i).padStart(2, "0")}:00`,
    );
  writeFileSync(
    path.join(process.env.LIGHTHOUSE_DATA_DIR!, "screenshots/test.png"),
    Buffer.from("png-reference"),
  );
  const history = await (await api(`/audits/${site.id}/history`)).json();
  assert.equal(history.length, 35);
  assert.equal(history[0].id, "historic-34");
  assert.equal(history[0].pwa_score, 95);
  assert.equal(history[0].full_report, undefined);
  assert.equal(history[0].has_report, true);
  assert.deepEqual(await (await api("/audits/historic-34/report")).json(), {
    test: "full report",
  });
  assert.equal((await fetch(origin + history[0].screenshot_path)).status, 200);
  assert.equal((await api("/audits/missing/report")).status, 404);
});
test("scores preserve missing values and only four supported categories are requested", () => {
  assert.deepEqual(CATEGORIES, [
    "performance",
    "accessibility",
    "best-practices",
    "seo",
  ]);
  assert.equal(categoryScore(0.891), 89);
  assert.equal(categoryScore(0), 0);
  assert.equal(categoryScore(null), null);
  assert.equal(categoryScore(undefined), null);
  assert.equal(categoryScore(NaN), null);
  assert.equal(categoryScore(2), null);
});
test("settings validate and persist executable configuration", async () => {
  assert.equal(
    (await api("/settings", "PATCH", { chromePath: "relative/chrome" })).status,
    400,
  );
  assert.equal(
    (
      await api("/settings", "PATCH", {
        chromePath: "/definitely/missing/chrome",
      })
    ).status,
    400,
  );
  const settings = await (
    await api("/settings", "PATCH", { chromePath: "" })
  ).json();
  assert.equal(settings.secureStorage, true);
  assert.equal(
    settings.version,
    JSON.parse(readFileSync("package.json", "utf8")).version,
  );
});

test("missing Chrome fails an audit with actionable settings guidance", async () => {
  const module = await (
    await api("/modules", "POST", { name: "Missing Chrome" })
  ).json();
  const site = await (
    await api("/urls", "POST", {
      module_id: module.id,
      url: "https://missing-chrome.example",
    })
  ).json();
  process.env.CHROME_PATH = "/definitely/not/installed";
  try {
    await api("/audit/run", "POST", { url_id: site.id });
    const status = await (await api("/audit/status")).json();
    assert.equal(status.inProgress, false);
    assert.equal(status.urls[0].status, "failed");
    assert.match(status.urls[0].error, /Chrome.*Settings/);
  } finally {
    delete process.env.CHROME_PATH;
  }
});

test("workspace summaries use the latest completed run per website and exclude missing category values", async () => {
  const summary = await (await api("/summary")).json();
  assert.equal(summary.completed, 35);
  assert.equal(summary.performance, 80);
  assert.equal(summary.accessibility, null);
  assert.equal(summary.seo, null);
  assert.ok(summary.auditCount > summary.completed);
  assert.ok(summary.attention > 0);
});

test("desktop preferences validate and persist independently of a changing renderer origin", async () => {
  assert.equal(
    (await api("/settings", "PATCH", { appearance: "neon" })).status,
    400,
  );
  const saved = await (
    await api("/settings", "PATCH", {
      appearance: "dark",
      sidebarCompact: true,
      activeView: "history",
      selectedWebsite: "site-id",
    })
  ).json();
  assert.equal(saved.appearance, "dark");
  assert.equal(saved.sidebarCompact, true);
  assert.equal(saved.activeView, "history");
  const loaded = await (await api("/settings")).json();
  assert.equal(loaded.appearance, "dark");
  assert.equal(loaded.selectedWebsite, "site-id");
  assert.equal(
    (
      await api("/settings", "PATCH", {
        appearance: "light",
        chromePath: "invalid",
      })
    ).status,
    400,
  );
  assert.equal((await (await api("/settings")).json()).appearance, "dark");
});
