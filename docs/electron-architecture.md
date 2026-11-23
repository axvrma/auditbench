# Electron architecture

The pinned Electron 45.3.4 main process starts Express on a random IPv4 loopback port after app readiness. It supplies a cryptographically random session token through a private environment variable and injects the matching header only into requests for that exact local origin. No token or Node API is exposed to the renderer. Express serves the compiled Vite assets, API and local screenshots.

BrowserWindow retains sandboxing, context isolation and disabled Node integration. Permissions are denied by both check and request handlers. External navigation and redirects are blocked. HTTP(S) links open in the system browser; only same-origin screenshots can open another sandboxed window in the application session. CSP restricts resources to the local origin and blocks frames, plugins and form submission.

The window starts with a theme-appropriate background, is shown after readiness, remembers its normal size and maximized state, and has bounded dimensions. Native menus provide edit, zoom, reload, fullscreen and close commands. Help opens official releases and the author portfolio. macOS keeps the application active after its last window closes; Windows and Linux quit. The existing single-instance lock is preserved.

## Local data and secrets

Default desktop storage remains `<Electron userData>/audits/data.db` and its sibling screenshots directory, preserving v1.1.0 paths. LIGHTHOUSE_DATA_DIR can explicitly select another directory; never point tests at a user's data. Corrupt database initialization fails with a startup diagnostic rather than replacing the database. Window size preferences live in userData/window.json. Theme, compact navigation, selected view and website are stored in SQLite so the random server port cannot reset them.

The main process configures the server's secret protector before importing the database. Electron safeStorage uses OS protection; Linux basic_text is rejected. The asynchronous safeStorage API avoids blocking the main thread. Availability has a three-second startup deadline and secret operations have ten-second deadlines. A locked or slow key store leaves authentication disabled while the workspace remains usable; unlock the store and restart to retry. Migration encrypts all affected values before its synchronous SQLite transaction. No preload bridge is necessary.

Shutdown stops accepting connections, terminates the owned audit browser and closes active HTTP connections. A ten-second deadline prevents indefinite exit. Startup turns leftover running database rows into visible failures; it never removes completed history. Audit processes have a three-minute watchdog and ordinary cleanup runs in finally.

## Packaging and verification

Root production dependencies include Lighthouse, Puppeteer, chrome-launcher and better-sqlite3. The builder packages server/dist, dashboard/dist, desktop/main.mjs and the source PNG icon, includes runtime dependencies automatically and unpacks native .node binaries. install-app-deps rebuilds native dependencies for the chosen Electron architecture before packaging. Node tests rebuild better-sqlite3 back for Node.

`npm run test:desktop` uses isolated data and user-profile directories, loads the real workspace, verifies renderer/API connectivity and session protection, and checks preference restoration across two launches before clean shutdown. `node scripts/desktop-smoke.mjs /absolute/path/to/packaged/executable` exercises the packaged path. An opt-in LIGHTHOUSE_SMOKE_TEST flag enables this behavior; ordinary launches remain open. See verification.md for results and release-process.md for platform limits.

## Auditbench rename compatibility

Auditbench retains `com.axvrma.lighthouse-agent`, the existing `LIGHTHOUSE_*` configuration variables and the `<appData>/Lighthouse Agent` profile directory. Database, screenshot, window and OS key-store identities survive the visible rename. The main process supplies the legacy name before Electron initializes its OS key providers, then switches `app.getName()` to Auditbench on `ready`, before showing a window or constructing native menus. This ordering follows the pinned Electron 45 [key-provider initialization](https://github.com/electron/electron/blob/v45.3.4/shell/browser/browser_process_impl.cc) and [macOS/Linux key-store configuration](https://github.com/electron/electron/blob/v45.3.4/shell/browser/electron_browser_main_parts.cc). The release filenames, application bundle and visible labels use Auditbench. Existing GitHub repository/release URLs stay valid.
