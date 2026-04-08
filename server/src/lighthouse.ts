import lighthouse, { Flags } from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import puppeteer, { Browser } from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const screenshotsDir = path.join(__dirname, '..', 'screenshots');

// Ensure screenshots directory exists
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
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

const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo', 'pwa'] as const;

export interface AuthConfig {
  authUrl?: string;
  username?: string;
  password?: string;
  usernameSelector?: string;
  passwordSelector?: string;
  submitSelector?: string;
}

export async function runLighthouseAudit(url: string, auditId: string, auth?: AuthConfig): Promise<AuditResult> {
  let chrome: chromeLauncher.LaunchedChrome | null = null;
  let browser: Browser | null = null;

  try {
    console.log(`Launching Chrome for ${url}...`);
    
    // Launch Chrome with chrome-launcher (same as Lighthouse uses internally)
    chrome = await chromeLauncher.launch({
      chromeFlags: [
        '--headless=new',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });

    const port = chrome.port;
    console.log(`Chrome launched on port ${port}`);

    // Connect puppeteer for authentication and screenshot
    browser = await puppeteer.connect({
      browserURL: `http://localhost:${port}`,
    });

    const page = await browser.newPage();
    let screenshotPath: string | null = null;
    
    // Handle authentication if credentials provided
    if (auth?.username && auth?.password) {
      const loginUrl = auth.authUrl || url;
      console.log(`Authenticating at ${loginUrl}...`);
      
      try {
        await page.goto(loginUrl, { waitUntil: 'networkidle2', timeout: 60000 });
        
        // Wait for and fill username
        const usernameSelector = auth.usernameSelector || 'input[type="email"], input[name="username"], input[name="email"], #username, #email';
        await page.waitForSelector(usernameSelector, { timeout: 10000 });
        await page.type(usernameSelector, auth.username);
        
        // Fill password
        const passwordSelector = auth.passwordSelector || 'input[type="password"], #password';
        await page.waitForSelector(passwordSelector, { timeout: 5000 });
        await page.type(passwordSelector, auth.password);
        
        // Submit form
        const submitSelector = auth.submitSelector || 'button[type="submit"], input[type="submit"]';
        await page.click(submitSelector);
        
        // Wait for navigation after login
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {
          console.log('Navigation timeout after login, continuing...');
        });
        
        console.log('Authentication completed');
      } catch (authError) {
        console.warn('Authentication failed:', authError instanceof Error ? authError.message : authError);
        console.log('Continuing without authentication...');
      }
    }
    
    // Take a screenshot
    console.log(`Taking screenshot...`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    
    const screenshotFilename = `${auditId}.png`;
    screenshotPath = path.join(screenshotsDir, screenshotFilename);
    await page.screenshot({ 
      path: screenshotPath,
      fullPage: true,
      type: 'png'
    });

    // Close page and disconnect puppeteer before Lighthouse runs
    // This prevents conflicts - Lighthouse will create its own connection
    await page.close();
    browser.disconnect();
    browser = null;
    
    console.log(`Running Lighthouse audit...`);
    const flags: Flags = {
      port,
      output: 'json',
      logLevel: 'error',
      onlyCategories: [...CATEGORIES],
      disableStorageReset: true, // Preserve cookies/session from authentication
    };

    // Config to preserve session and optimize for desktop
    const config = {
      extends: 'lighthouse:default',
      settings: {
        disableStorageReset: true,
        maxWaitForFcp: 30000,
        maxWaitForLoad: 45000,
        formFactor: 'desktop' as const,
        screenEmulation: { disabled: true },
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
      throw new Error('Lighthouse returned no results');
    }

    const lhr = result.lhr;

    // Debug: Check if categories exist and what's in them
    console.log('Lighthouse run warnings:', lhr.runWarnings);
    console.log('Available categories:', Object.keys(lhr.categories || {}));
    
    // Check for runtime errors
    if (lhr.runtimeError) {
      console.error('Lighthouse runtime error:', lhr.runtimeError.code, lhr.runtimeError.message);
    }

    // Log raw category scores for debugging
    console.log('Raw Lighthouse scores:');
    console.log('  Performance:', lhr.categories.performance?.score);
    console.log('  Accessibility:', lhr.categories.accessibility?.score);
    console.log('  Best Practices:', lhr.categories['best-practices']?.score);
    console.log('  SEO:', lhr.categories.seo?.score);
    console.log('  PWA:', lhr.categories.pwa?.score);

    // Extract scores (convert from 0-1 to 0-100)
    const scores = {
      performance: lhr.categories.performance?.score != null 
        ? Math.round(lhr.categories.performance.score * 100) 
        : null,
      accessibility: lhr.categories.accessibility?.score != null 
        ? Math.round(lhr.categories.accessibility.score * 100) 
        : null,
      bestPractices: lhr.categories['best-practices']?.score != null 
        ? Math.round(lhr.categories['best-practices'].score * 100) 
        : null,
      seo: lhr.categories.seo?.score != null 
        ? Math.round(lhr.categories.seo.score * 100) 
        : null,
      pwa: lhr.categories.pwa?.score != null 
        ? Math.round(lhr.categories.pwa.score * 100) 
        : null,
    };
    
    console.log('Converted scores:', scores);

    // Extract suggestions
    const suggestions: Suggestion[] = [];

    for (const category of CATEGORIES) {
      const categoryData = lhr.categories[category];
      if (!categoryData) continue;

      for (const auditRef of categoryData.auditRefs) {
        const audit = lhr.audits[auditRef.id];
        if (!audit) continue;

        if (audit.score !== null && audit.score < 1) {
          const numericDetails = audit.details as { 
            overallSavingsMs?: number; 
            overallSavingsBytes?: number;
          } | undefined;

          suggestions.push({
            category,
            auditRef: auditRef.id,
            title: audit.title,
            description: audit.description || '',
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

    console.log(`Audit complete. Performance: ${scores.performance}`);

    return {
      scores,
      suggestions,
      screenshotPath: screenshotPath ? `/screenshots/${auditId}.png` : null,
      fullReport: lhr,
    };
  } finally {
    // Cleanup: disconnect puppeteer if still connected
    if (browser) {
      try {
        browser.disconnect();
      } catch {
        // Already disconnected
      }
    }
    // Kill Chrome process
    if (chrome) {
      await chrome.kill();
    }
  }
}
