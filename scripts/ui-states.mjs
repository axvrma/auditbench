import { chromePath } from "./chrome.mjs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import assert from "node:assert/strict";
import puppeteer from "puppeteer-core";
process.env.LIGHTHOUSE_DATA_DIR = await mkdtemp(
  path.join(tmpdir(), "lighthouse-ui-"),
);
process.env.LIGHTHOUSE_SECRET_KEY = randomBytes(32).toString("base64");
const { startServer, stopAudits } = await import("../server/dist/index.js");
const { db } = await import("../server/dist/db.js");
const server = startServer(0, path.resolve("dashboard/dist"));
await once(server, "listening");
const browser = await puppeteer.launch({
  executablePath: chromePath,
  headless: true,
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(`http://127.0.0.1:${server.address().port}`, {
    waitUntil: "networkidle0",
  });
  await page.waitForSelector(".empty");
  assert.ok(
    (await page.content()).includes("Your first insight starts with a website"),
  );
  await page.locator(".empty button").click();
  await page.locator(".row button.primary").click();
  await page.waitForSelector("dialog[open]");
  await page.locator('input[name="name"]').fill("UI verification");
  await page
    .locator('textarea[name="description"]')
    .fill("Created through the real application");
  await page.locator("dialog button.primary").click();
  await page.waitForSelector(".module-panel");
  await page.locator(".panel-bottom button").click();
  await page.waitForSelector("dialog[open]");
  await page.locator('input[name="name"]').fill("A long website label");
  await page
    .locator('input[name="url"]')
    .fill("https://example.com/a/very/long/path?verification=true");
  await page.locator("dialog button.primary").click();
  await page.waitForSelector(".module-panel tbody tr");
  await page.locator('button[aria-label="Edit A long website label"]').click();
  await page.locator('input[name="url"]').fill("https://example.com/updated");
  await page.locator("dialog button.primary").click();
  await page.waitForFunction(() => !document.querySelector("dialog[open]"));
  assert.equal(
    db.prepare("SELECT url FROM urls").get().url,
    "https://example.com/updated",
  );
  await page.locator("nav button:nth-child(4)").click();
  await page.locator(".security-note button").click();
  await page.locator('input[name="name"]').fill("UI saved login");
  await page.locator('input[name="username"]').fill("preview");
  await page.locator('input[name="password"]').fill("ui-only-test-password");
  await page.locator("dialog button.primary").click();
  await page.waitForSelector(".credential");
  assert.ok(!(await page.content()).includes("ui-only-test-password"));
  await page.locator('button[aria-label="Edit UI saved login"]').click();
  assert.equal(
    await page.$eval('input[name="password"]', (element) => element.value),
    "",
  );
  await page.locator('input[name="name"]').fill("UI renamed login");
  await page.locator("dialog button.primary").click();
  await page.waitForFunction(() => !document.querySelector("dialog[open]"));
  await page.setRequestInterception(true);
  let fail = true;
  page.on("request", (request) =>
    fail && request.url().includes("/api/")
      ? request.abort()
      : request.continue(),
  );
  await page.locator('button[aria-label="Refresh workspace"]').click();
  await page.waitForSelector('[role="alert"]');
  assert.ok(
    (await page.$eval('[role="alert"]', (e) => e.textContent)).length > 0,
  );
  fail = false;
  await page.locator('[role="alert"] button').click();
  await page.waitForFunction(() => !document.querySelector('[role="alert"]'));
  console.log(
    "UI_STATES_PASS: empty onboarding, module create, website create/edit, credential create/update without password retrieval, network error and recovery.",
  );
} finally {
  await browser.close();
  await stopAudits();
  server.closeAllConnections();
  server.close();
  db.close();
}
