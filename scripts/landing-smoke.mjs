import { chromePath } from "./chrome.mjs";
import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { once } from "node:events";
import path from "node:path";
import assert from "node:assert/strict";
import puppeteer from "puppeteer-core";
import lighthouse from "lighthouse";
import * as chromeLauncher from "chrome-launcher";
import { execFileSync } from "node:child_process";
const root = path.resolve("landing-dist");
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".xml": "application/xml",
  ".txt": "text/plain",
};
const server = createServer(async (req, res) => {
  try {
    const target = path.resolve(
      root,
      "." + new URL(req.url, "http://localhost").pathname,
    );
    if (!target.startsWith(root + path.sep) && target !== root)
      throw new Error("Invalid path");
    const file = target === root ? path.join(root, "index.html") : target;
    res.setHeader(
      "Content-Type",
      types[path.extname(file)] || "application/octet-stream",
    );
    res.end(await readFile(file));
  } catch {
    res.writeHead(404).end("Not found");
  }
});
server.listen(0, "127.0.0.1");
await once(server, "listening");
const origin = `http://127.0.0.1:${server.address().port}`;
execFileSync(process.execPath, ["scripts/build-landing.mjs"], {
  env: { ...process.env, SITE_URL: origin },
});
let browser, chrome;
try {
  browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
  });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewport({ width: 1440, height: 1050 });
  await page.goto(origin, { waitUntil: "networkidle0" });
  await page.evaluate(async () => {
    await document.fonts.ready;
    document
      .querySelectorAll("img")
      .forEach((image) => (image.loading = "eager"));
    await Promise.all(
      Array.from(document.images).map((image) => image.decode()),
    );
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await mkdir("test-results", { recursive: true });
  await page.screenshot({
    path: "test-results/landing-desktop.png",
    fullPage: true,
  });
  for (const width of [390, 760]) {
    await page.setViewport({ width, height: 844 });
    await page.reload({ waitUntil: "networkidle0" });
    await page.evaluate(async () => {
      document
        .querySelectorAll("img")
        .forEach((image) => (image.loading = "eager"));
      await Promise.all(
        Array.from(document.images).map((image) => image.decode()),
      );
    });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      `Overflow at ${width}px`,
    );
    if (width === 390) {
      await page.locator(".menu-toggle").click();
      assert.equal(
        await page.$eval(".menu-toggle", (e) =>
          e.getAttribute("aria-expanded"),
        ),
        "true",
      );
      await page.locator('#navigation a[href="#features"]').click();
      assert.equal(
        await page.$eval(".menu-toggle", (e) =>
          e.getAttribute("aria-expanded"),
        ),
        "false",
      );
      await page.screenshot({
        path: "test-results/landing-mobile.png",
        fullPage: true,
      });
    }
  }
  await page.setRequestInterception(true);
  page.on("request", (req) =>
    req.url().startsWith("https://api.github.com/")
      ? req.abort()
      : req.continue(),
  );
  await page.reload({ waitUntil: "networkidle0" });
  await page.waitForFunction(() =>
    document
      .querySelector("#release-status")
      .textContent.includes("unavailable"),
  );
  for (const link of await page.$$eval("[data-platform]", (links) =>
    links.map((a) => a.href),
  ))
    assert.equal(link, "https://github.com/axvrma/auditbench/releases/latest");
  assert.deepEqual(errors, []);
  await browser.close();
  browser = undefined;
  chrome = await chromeLauncher.launch({
    chromePath: chromePath,
    chromeFlags: ["--headless=new"],
  });
  const result = await lighthouse(origin, {
    port: chrome.port,
    output: "json",
    logLevel: "error",
    onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
  });
  assert.ok(result?.lhr && !result.lhr.runtimeError);
  const scores = Object.fromEntries(
    Object.entries(result.lhr.categories).map(([k, v]) => [
      k,
      Math.round(v.score * 100),
    ]),
  );
  await writeFile(
    "test-results/landing-lighthouse.json",
    JSON.stringify(result.lhr, null, 2),
  );
  console.log(
    "LANDING_SMOKE_PASS: desktop/mobile, menu, no overflow, release fallback and real Lighthouse audit.",
    JSON.stringify(scores),
  );
  for (const [key, goal] of [
    ["performance", 90],
    ["accessibility", 95],
    ["best-practices", 95],
    ["seo", 95],
  ])
    if (scores[key] < goal)
      console.log("QUALITY_TARGET_MISSED", key, scores[key], goal);
} finally {
  await browser?.close();
  await chrome?.kill();
  server.closeAllConnections();
  server.close();
}
