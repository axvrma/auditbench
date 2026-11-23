import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
async function downloads(
  assets?: { name: string; browser_download_url: string }[],
) {
  const cards = ["mac-arm64", "mac-x64", "win-x64", "linux-x64"].map(
    (platform) => ({
      dataset: { platform },
      href: "https://github.com/axvrma/auditbench/releases/latest",
      small: { textContent: "" },
      querySelector() {
        return this.small;
      },
    }),
  );
  const status = { textContent: "" };
  vm.runInNewContext(await readFile("landing/downloads.js", "utf8"), {
    URL,
    AbortSignal,
    document: {
      querySelector: (selector: string) =>
        selector === "#release-status" ? status : null,
      querySelectorAll: () => cards,
    },
    fetch: async () => {
      if (!assets) throw new Error("offline");
      return { ok: true, json: async () => ({ tag_name: "v1.1.0", assets }) };
    },
  });
  await new Promise((resolve) => setImmediate(resolve));
  return { cards, status };
}
test("downloads match actual macOS, Windows portable ZIP and Linux x86_64 release names", async () => {
  for (const prefix of ["Lighthouse-Agent", "Auditbench"]) {
    const names = [
      `${prefix}-1.1.0-mac-arm64.dmg`,
      `${prefix}-1.1.0-mac-x64.dmg`,
      `${prefix}-1.1.0-win-x64.zip`,
      `${prefix}-1.1.0-linux-x86_64.AppImage`,
    ];
    const { cards } = await downloads(
      names.map((name) => ({
        name,
        browser_download_url: `https://github.com/axvrma/auditbench/releases/download/v1.1.0/${name}`,
      })),
    );
    cards.forEach((card, i) => assert.ok(card.href.endsWith(names[i])));
    assert.equal(cards[2].small.textContent, "Download portable ZIP");
  }
});
test("download failures and untrusted asset URLs retain official release fallbacks", async () => {
  const offline = await downloads();
  assert.match(offline.status.textContent, /unavailable/);
  assert.ok(offline.cards.every((c) => c.href.endsWith("/releases/latest")));
  const unsafe = await downloads([
    {
      name: "Lighthouse-Agent-1.1.0-win-x64.exe",
      browser_download_url: "https://evil.example/installer.exe",
    },
  ]);
  assert.ok(unsafe.cards.every((c) => c.href.endsWith("/releases/latest")));
});
