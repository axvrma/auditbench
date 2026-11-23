import lighthouse, { Flags } from "lighthouse";
import * as chromeLauncher from "chrome-launcher";
import puppeteer, { Browser } from "puppeteer-core";
import path from "path";
import { getSettings } from "./settings.js";
import { screenshotsDirectory } from "./paths.js";

let browserLaunch: Promise<chromeLauncher.LaunchedChrome> | undefined;

export async function stopAuditBrowser(): Promise<void> {
  const launch = browserLaunch;
  browserLaunch = undefined;
  const chrome = await launch?.catch(() => undefined);
  await chrome?.kill();
}

export class AuditFailure extends Error {
  constructor(
    message: string,
    readonly fullReport: object,
  ) {
    super(message);
  }
}

export interface AuditResult {
  scores: {
    performance: number | null;
    accessibility: number | null;
    bestPractices: number | null;
    seo: number | null;
    pwa: number | null;
  };
  suggestions: Suggestion[];
  screenshotPath: string | null;
  fullReport: object;
}

export interface Suggestion {
  category: string;
  auditRef: string;
  title: string;
  description: string;
  score: number | null;
  savingsMs: number;
  savingsBytes: number;
}

export const CATEGORIES = [
  "performance",
  "accessibility",
  "best-practices",
  "seo",
] as const;

export interface AuthConfig {
  authUrl?: string;
  username?: string;
  password?: string;
  usernameSelector?: string;
  passwordSelector?: string;
  submitSelector?: string;
}

export async function runLighthouseAudit(
  url: string,
  auditId: string,
  auth?: AuthConfig,
): Promise<AuditResult> {
  let browser: Browser | null = null;
  const deadline = setTimeout(() => {
    void stopAuditBrowser().catch(() => undefined);
  }, 180000);
  deadline.unref();

  try {
    if (!getSettings().chromeAvailable)
      throw new Error(
        "Google Chrome is required. Install Chrome or set the executable path in Settings.",
      );

    // Launch Chrome with chrome-launcher (same as Lighthouse uses internally)
    const {
      LIGHTHOUSE_DESKTOP_TOKEN: desktopToken,
      LIGHTHOUSE_SECRET_KEY: secretKey,
      ...chromeEnvironment
    } = process.env;
    browserLaunch = chromeLauncher
      .launch({
        envVars: chromeEnvironment,
        chromePath: getSettings().chromePath || undefined,
        chromeFlags: [
          "--headless=new",
          ...(process.env.LIGHTHOUSE_NO_SANDBOX === "1"
            ? ["--no-sandbox"]
            : []),
          "--disable-dev-shm-usage",
          "--disable-gpu",
        ],
      })
      .catch((error: unknown) => {
        if (
          error instanceof Error &&
          "code" in error &&
          (error.code === "ERR_LAUNCHER_PATH_NOT_SET" ||
            error.code === "ERR_LAUNCHER_NOT_INSTALLED")
        ) {
          throw new Error(
            "Google Chrome is required to run audits. Install Chrome, then try again.",
          );
        }
        throw error;
      });
    const chrome = await browserLaunch;

    const port = chrome.port;

    // Connect puppeteer for authentication and screenshot
    browser = await puppeteer.connect({
      browserURL: `http://localhost:${port}`,
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    let screenshotPath: string | null = null;

    if (auth && (!auth.username || !auth.password))
      throw new Error(
        "Authentication requires both a username and a saved password.",
      );
    // Handle authentication if credentials provided
    if (auth?.username && auth?.password) {
      const loginUrl = auth.authUrl || url;

      try {
        await page.goto(loginUrl, {
          waitUntil: "networkidle2",
          timeout: 60000,
        });

        // Wait for and fill username
        const usernameSelector =
          auth.usernameSelector ||
          'input[type="email"], input[name="username"], input[name="email"], #username, #email';
        await page.waitForSelector(usernameSelector, { timeout: 10000 });
        await page.type(usernameSelector, auth.username);

        // Fill password
        const passwordSelector =
          auth.passwordSelector || 'input[type="password"], #password';
        await page.waitForSelector(passwordSelector, { timeout: 5000 });
        await page.type(passwordSelector, auth.password);

        // Submit form
        const submitSelector =
          auth.submitSelector || 'button[type="submit"], input[type="submit"]';
        await Promise.all([
          page
            .waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 })
            .catch(() => null),
          page.click(submitSelector),
        ]);
        if (await page.$(passwordSelector))
          throw new Error("The login form is still visible.");
      } catch {
        throw new Error(
          "Authentication could not be verified. Check the login URL, credentials and selectors.",
        );
      }
    }

    // Take a screenshot

    const response = await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: 60000,
    });
    if (response && response.status() >= 400)
      throw new Error(`Website returned HTTP ${response.status()}.`);
    if (
      auth &&
      (await page.$(auth.passwordSelector || 'input[type="password"]'))
    )
      throw new Error(
        "Authentication did not grant access to the requested page.",
      );

    const screenshotFilename = `${auditId}.png`;
    screenshotPath = path.join(screenshotsDirectory, screenshotFilename);
    await page.screenshot({
      path: screenshotPath,
      fullPage: true,
      type: "png",
    });

    // Close page and disconnect puppeteer before Lighthouse runs
    // This prevents conflicts - Lighthouse will create its own connection
    await page.close();
    await browser.disconnect();
    browser = null;

    const flags: Flags = {
      port,
      output: "json",
      logLevel: "error",
      onlyCategories: [...CATEGORIES],
      disableStorageReset: true, // Preserve cookies/session from authentication
    };

    // Config to preserve session and optimize for desktop
    const config = {
      extends: "lighthouse:default",
      settings: {
        disableStorageReset: true,
        maxWaitForFcp: 30000,
        maxWaitForLoad: 45000,
        formFactor: "desktop" as const,
        screenEmulation: {
          disabled: false,
          mobile: false,
          width: 1440,
          height: 900,
          deviceScaleFactor: 1,
        },
        throttling: {
          cpuSlowdownMultiplier: 1,
          requestLatencyMs: 0,
          downloadThroughputKbps: 0,
          uploadThroughputKbps: 0,
        },
      },
    };

    const result = await lighthouse(url, flags, config);

    if (!result || !result.lhr) {
      throw new Error("Lighthouse returned no results");
    }

    const lhr = result.lhr;

    // Check for runtime errors
    if (lhr.runtimeError) {
      throw new AuditFailure(
        `Lighthouse could not complete: ${lhr.runtimeError.code}`,
        lhr,
      );
    }

    // Extract scores (convert from 0-1 to 0-100)
    const scores = {
      performance: categoryScore(lhr.categories.performance?.score),
      accessibility: categoryScore(lhr.categories.accessibility?.score),
      bestPractices: categoryScore(lhr.categories["best-practices"]?.score),
      seo: categoryScore(lhr.categories.seo?.score),
      pwa: null,
    };

    // Extract suggestions
    const suggestions: Suggestion[] = [];

    for (const category of CATEGORIES) {
      const categoryData = lhr.categories[category];
      if (!categoryData) continue;

      for (const auditRef of categoryData.auditRefs) {
        const audit = lhr.audits[auditRef.id];
        if (!audit) continue;

        if (audit.score !== null && audit.score < 1) {
          const numericDetails = audit.details as
            | {
                overallSavingsMs?: number;
                overallSavingsBytes?: number;
              }
            | undefined;

          suggestions.push({
            category,
            auditRef: auditRef.id,
            title: audit.title,
            description: audit.description || "",
            score: audit.score,
            savingsMs: numericDetails?.overallSavingsMs || 0,
            savingsBytes: numericDetails?.overallSavingsBytes || 0,
          });
        }
      }
    }

    // Sort by impact
    suggestions.sort((a, b) => {
      const aImpact = a.savingsMs + a.savingsBytes / 1000;
      const bImpact = b.savingsMs + b.savingsBytes / 1000;
      return bImpact - aImpact;
    });

    return {
      scores,
      suggestions,
      screenshotPath: screenshotPath ? `/screenshots/${auditId}.png` : null,
      fullReport: lhr,
    };
  } finally {
    clearTimeout(deadline);
    // Cleanup: disconnect puppeteer if still connected
    if (browser) {
      try {
        await browser.disconnect();
      } catch {
        // Already disconnected
      }
    }
    // Kill Chrome process
    await stopAuditBrowser();
  }
}

export function categoryScore(value: number | null | undefined): number | null {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1
    ? Math.round(value * 100)
    : null;
}
