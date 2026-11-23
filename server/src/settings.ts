import { existsSync, accessSync, constants } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import * as chromeLauncher from "chrome-launcher";
import { db, migrationNotice } from "./db.js";
import { dataDirectory } from "./paths.js";
import { secretAvailable } from "./secrets.js";
const require = createRequire(import.meta.url);
let detectedChrome: string | undefined;
export function getSettings() {
  const preferences = Object.fromEntries(
    (
      db.prepare("SELECT key, value FROM settings").all() as {
        key: string;
        value: string;
      }[]
    ).map((row) => [row.key, row.value]),
  );
  const row = db
    .prepare("SELECT value FROM settings WHERE key = 'chromePath'")
    .get() as { value: string } | undefined;
  const chromePath =
    row?.value ||
    process.env.CHROME_PATH ||
    (detectedChrome ??= chromeLauncher.Launcher.getInstallations()[0] || "");
  return {
    appearance: ["system", "light", "dark"].includes(preferences.appearance)
      ? preferences.appearance
      : "system",
    sidebarCompact: preferences.sidebarCompact === "true",
    activeView: preferences.activeView || "overview",
    selectedWebsite: preferences.selectedWebsite || "",
    version: require("../../package.json").version as string,
    dataDirectory,
    chromePath,
    chromeAvailable: Boolean(chromePath && existsSync(chromePath)),
    secureStorage: secretAvailable(),
    migrationNotice,
    desktop: Boolean(process.env.LIGHTHOUSE_DESKTOP_TOKEN),
    auditProfile: "Desktop · four categories · no artificial throttling",
  };
}
export function setChromePath(value: string) {
  if (value) {
    if (!path.isAbsolute(value))
      throw new Error("Chrome executable must be an absolute path.");
    try {
      accessSync(value, constants.X_OK);
    } catch {
      throw new Error("Chrome executable is missing or not executable.");
    }
  }
  db.prepare(
    "INSERT INTO settings (key, value) VALUES ('chromePath', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ).run(value);
}

export function savePreferences(updates: Record<string, unknown>) {
  const allowed: Record<string, (value: unknown) => boolean> = {
    appearance: (value) =>
      typeof value === "string" && ["system", "light", "dark"].includes(value),
    sidebarCompact: (value) => typeof value === "boolean",
    activeView: (value) =>
      typeof value === "string" &&
      ["overview", "modules", "history", "credentials", "settings"].includes(
        value,
      ),
    selectedWebsite: (value) =>
      typeof value === "string" && value.length <= 200,
  };
  for (const [key, value] of Object.entries(updates)) {
    if (!allowed[key]?.(value)) throw new Error(`Invalid ${key} preference.`);
  }
  const save = db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  );
  for (const [key, value] of Object.entries(updates))
    save.run(key, String(value));
}
