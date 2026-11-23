import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { execFileSync } from "node:child_process";
test("Netlify output contains only marketing assets and valid local references", async () => {
  execFileSync(process.execPath, ["scripts/build-landing.mjs"], {
    env: { ...process.env, SITE_URL: "https://lighthouse.example" },
  });
  const html = await readFile("landing-dist/index.html", "utf8");
  assert.match(html, /https:\/\/axvrma.com/);
  assert.match(html, /canonical.*https:\/\/lighthouse.example/);
  for (const match of html.matchAll(/(?:src|href)="(\/[^"#]+)"/g))
    await access("landing-dist" + match[1]);
  await assert.rejects(access("landing-dist/server"));
  await assert.rejects(access("landing-dist/data.db"));
  assert.match(
    await readFile("landing-dist/sitemap.xml", "utf8"),
    /https:\/\/lighthouse.example/,
  );
});
