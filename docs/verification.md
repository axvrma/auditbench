# Verification

Final checks were run on macOS arm64 using Node 24.19.0, Electron 45.3.4, Lighthouse 12.8.2 and Google Chrome 158.0.8127.36. Work continued through 23 November 2026. Every execution that opened a database used an isolated temporary directory; existing user modules, reports, databases and screenshot directories were not replaced.

## Installation and compilation

- `npm ci`: passed for the initial baseline and the updated lockfile; 696 packages installed, 699 audited.
- `npm run typecheck`: dashboard and backend passed with strict TypeScript.
- `npm run build`: backend, dashboard and static marketing output passed.
- Frontend chunk splitting produces separate React (~142 kB), chart (~383 kB), application (~57 kB) and Settings chunks, with no circular chunk or size warning in the final configuration.
- `git diff --check`: passed.

## Automated API and migration coverage

`npm test`: **17 tests passed**, covering the local origin/header/Host boundary, module and website CRUD, malformed requests, address edits, active states, foreign-key deletion, secret encryption/redaction/update/deletion, legacy backup/migration/idempotency, unavailable and asynchronously failing protection, failed audit status, missing Chrome, full report access, screenshot references, historical PWA compatibility, interrupted-run recovery, summary averages excluding missing values, persisted preferences and rollback, actual download filename matching, unsafe URL rejection, release failures and static publish separation.

Recovery tests reopen a populated database in a fresh process and retain its existing module and historical PWA score. They mark an interrupted running row as failed without removing completed history. Legacy plaintext conversion is tested with an isolated cryptographic protector, including owner-only backup permissions and absence of plaintext remnants in the active database. This is not a claim of end-to-end key-store coverage on Windows or Linux.

## Real browser workflows

`npm run test:ui` passed empty-state onboarding, real module creation, website creation/address editing, credential creation/update with an empty replacement field, visible network errors and connection recovery.

`npm run test:browser` used actual Chrome and Lighthouse against isolated public, authenticated and deliberately failing local pages. The module batch, authenticated-page run and single repeat run completed. A wrong password failed authentication. An empty-page Lighthouse runtime failure retained both its full error report and the captured screenshot. The checks also covered report/screenshot references, four supported categories with null historic PWA output, modal Escape handling, light/dark theme reload persistence, credential redaction, history and functional settings. Browser console error assertions passed.

The committed workspace, module and audit-detail screenshots are genuine captures of the implemented interface and measured fixture runs. Their values are not production-site claims.

## Marketing site

`npm run test:landing` passed at 1440px, 760px and 390px widths, with no horizontal overflow, a working accessible mobile menu, decoded image assets, no browser script errors and official-release fallbacks when GitHub metadata requests fail.

The measured local **mobile** Lighthouse result was:

- Performance: **97** (target 90).
- Accessibility: **100** (target 95).
- Best Practices: **100** (target 95).
- SEO: **100** (target 95).

These are observed local lab measurements, not guaranteed scores for a hosted deployment or another device. The full report and screenshots remain under ignored test-results/. Static output validation confirms that only marketing files are published; no API or database is present. The live v1.1.0 release metadata was checked: macOS arm64/x64 DMGs, Windows x64 portable ZIP and a Linux x86_64 AppImage. The resolver accepts NSIS installers when present; unit tests cover the published filenames, portable ZIP labeling, untrusted asset rejection and failure fallbacks.

## Development and Electron

`npm run dev` started Vite on 127.0.0.1:5173 and the API on 127.0.0.1:4001 using an isolated directory. The HTML and protected API returned successful responses. The owned development processes were stopped after verification.

`npm run test:desktop` passed two real Electron launches, verifying the rendered workspace, renderer/API connection, rejection of requests without the private session token, clean exit, and restoration of dark appearance and compact navigation across changing random origins. Data and Electron profile directories were isolated.

`npm run package:desktop -- --mac --arm64` produced the DMG and an asar-packaged application. The packaged executable passed the same two-launch smoke, including native SQLite loading, production asset paths, local API protection and persisted preferences. A canceled/unavailable macOS Keychain did not prevent the workspace from initializing; authentication stays locked in that case. Asynchronous OS protection has bounded waits and never falls back to plaintext.

The standard `npm start` command is tested with the opt-in smoke flag and an isolated directory so it exits after verification. Installers and generated build/test output remain ignored and uncommitted.

## Limits and remaining work

- Native Windows x64, Linux x64 and macOS Intel runtime/install/upgrade checks were not available on this host. Their existing native CI matrix remains configured; no successful remote workflow run is claimed.
- The macOS artifact is ad-hoc signed, not Developer ID signed or notarized. Windows signing is not configured. Keychain prompts can recur for unsigned/ad-hoc builds, and an unavailable store requires unlocking it and restarting before using saved authentication.
- No public release, version tag, repository push or Netlify deployment was performed. Netlify configuration/output were tested locally; custom domains and production deployment require the existing integration.
- The final dependency audit reports **38 advisories: 27 moderate and 11 high; no critical findings**. The baseline was 49, including two critical findings. Remaining chains include the pinned Lighthouse/Sentry/OpenTelemetry, Puppeteer/browser tooling, Vite/esbuild and builder tooling. No forced major upgrade was applied without compatibility verification. Passing functional checks is not a clean security audit.
- Login automation is a conservative form-based flow; MFA, captchas and arbitrary SSO/sessionStorage flows are not guaranteed.
- The history workspace loads the latest 10,000 records, with an explicit notice for larger databases. Charts display up to 1,000 observed runs. Overall counts and per-site latest-score averages query the complete database; older history remains stored.

## Auditbench branding verification

The app, website, wordmark, social image, author metadata, native menus and installer naming now use Auditbench and the linked author credit Abhishek Verma. Product screenshots were regenerated from real audits using the renamed interface. A clean `npm ci` and `npm ls --depth=0` verified the renamed workspace packages without stale links; the 17-test suite passed again, including both legacy and Auditbench asset filenames. The renamed desktop passed workspace/API/session checks and preference restoration across launches. The legacy profile directory, application ID and pre-ready OS key-store name remain stable; the visible Electron name becomes Auditbench on ready. No repository rename or public release was performed.

The rebuilt `release/Auditbench-1.1.0-mac-arm64.dmg` and `Auditbench.app` passed the packaged two-launch smoke after the clean install. Bundle metadata confirms the visible name Auditbench and the unchanged application ID `com.axvrma.lighthouse-agent`.
