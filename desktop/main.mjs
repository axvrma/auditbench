import {
  app,
  BrowserWindow,
  dialog,
  session,
  shell,
  safeStorage,
  Menu,
  nativeTheme,
} from "electron";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import path from "node:path";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const productName = "Auditbench";
// Electron 45 initializes OS key providers before ready using the app name.
// Preserve that identity and the existing profile so upgrades can unlock old data.
const legacyIdentity = "Lighthouse Agent";
app.setName(legacyIdentity);
app.once("ready", () => app.setName(productName));
if (
  process.env.LIGHTHOUSE_SMOKE_TEST === "1" &&
  process.env.LIGHTHOUSE_DATA_DIR
) {
  const profile = path.join(process.env.LIGHTHOUSE_DATA_DIR, "desktop-profile");
  mkdirSync(profile, { recursive: true, mode: 0o700 });
  app.setPath("userData", profile);
} else {
  const profile = path.join(app.getPath("appData"), legacyIdentity);
  mkdirSync(profile, { recursive: true, mode: 0o700 });
  app.setPath("userData", profile);
}

let server;
let stopAudits;
let desktopSession;
let origin;
let mainWindow;
let quitting = false;
let windowState = {};
let windowStatePath;
try {
  windowStatePath = path.join(app.getPath("userData"), "window.json");
  windowState = JSON.parse(readFileSync(windowStatePath, "utf8"));
} catch {}

function openDashboard() {
  if (mainWindow) {
    mainWindow.focus();
    return;
  }

  const webPreferences = {
    session: desktopSession,
    sandbox: true,
    contextIsolation: true,
    nodeIntegration: false,
  };
  const window = new BrowserWindow({
    title: productName,
    width: Math.min(1920, Math.max(1000, Number(windowState.width) || 1440)),
    height: Math.min(1200, Math.max(680, Number(windowState.height) || 940)),
    minWidth: 1000,
    minHeight: 560,
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#101b19" : "#f6f5ee",
    show: false,
    icon: path.join(app.getAppPath(), "desktop", "icon.png"),
    webPreferences,
  });
  mainWindow = window;
  window.once("ready-to-show", () => {
    window.show();
    if (windowState.maximized) window.maximize();
  });
  window.on("close", () => {
    try {
      writeFileSync(
        windowStatePath,
        JSON.stringify({
          ...window.getNormalBounds(),
          maximized: window.isMaximized(),
        }),
        { mode: 0o600 },
      );
    } catch {}
  });
  window.on("closed", () => {
    mainWindow = undefined;
  });

  const preventNavigation = (event, url) => {
    try {
      if (new URL(url).origin !== origin) event.preventDefault();
    } catch {
      event.preventDefault();
    }
  };
  window.webContents.on("will-navigate", preventNavigation);
  window.webContents.on("will-redirect", preventNavigation);
  window.webContents.setWindowOpenHandler(({ url }) => {
    let target;
    try {
      target = new URL(url);
    } catch {
      return { action: "deny" };
    }
    if (
      target.origin === origin &&
      target.pathname.startsWith("/screenshots/")
    ) {
      return {
        action: "allow",
        overrideBrowserWindowOptions: { webPreferences },
      };
    }
    if (
      target.origin !== origin &&
      ["https:", "http:"].includes(target.protocol)
    ) {
      void shell.openExternal(url).catch(console.error);
    }
    return { action: "deny" };
  });

  void window.loadURL(origin).catch((error) => {
    if (!window.isDestroyed()) dialog.showErrorBox(productName, error.message);
  });
}

async function withDeadline(operation, milliseconds) {
  let timeout;
  try {
    return await Promise.race([
      operation,
      new Promise((_, reject) => {
        timeout = setTimeout(
          () =>
            reject(
              new Error(
                "The OS key store is unavailable. Unlock it and restart the app.",
              ),
            ),
          milliseconds,
        );
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

async function start() {
  const token = randomBytes(32).toString("hex");
  process.env.LIGHTHOUSE_DESKTOP_TOKEN = token;
  process.env.LIGHTHOUSE_DATA_DIR ||= path.join(
    app.getPath("userData"),
    "audits",
  );

  // A locked Keychain must never block the main thread or the application shell.
  delete process.env.LIGHTHOUSE_SECRET_KEY;
  const secrets = await import("../server/dist/secrets.js");
  const protectionAvailable = await withDeadline(
    safeStorage.isAsyncEncryptionAvailable(),
    3000,
  ).catch(() => false);
  if (
    protectionAvailable &&
    (process.platform !== "linux" ||
      safeStorage.getSelectedStorageBackend() !== "basic_text")
  ) {
    secrets.configureSecrets({
      encrypt: async (value) =>
        (
          await withDeadline(safeStorage.encryptStringAsync(value), 10000)
        ).toString("base64"),
      decrypt: async (value) =>
        (
          await withDeadline(
            safeStorage.decryptStringAsync(Buffer.from(value, "base64")),
            10000,
          )
        ).result,
    });
  }
  const backend = await import("../server/dist/index.js");
  stopAudits = backend.stopAudits;
  const { getSettings } = await import("../server/dist/settings.js");
  nativeTheme.themeSource = getSettings().appearance;
  server = backend.startServer(
    0,
    path.join(app.getAppPath(), "dashboard", "dist"),
  );
  await once(server, "listening");
  origin = `http://127.0.0.1:${server.address().port}`;

  desktopSession = session.fromPartition("lighthouse-desktop");
  desktopSession.setPermissionCheckHandler(() => false);
  desktopSession.setPermissionRequestHandler(
    (_contents, _permission, callback) => callback(false),
  );
  desktopSession.webRequest.onBeforeSendHeaders(
    { urls: ["http://127.0.0.1/*"] },
    (details, callback) => {
      if (new URL(details.url).origin === origin)
        details.requestHeaders["X-Lighthouse-Session"] = token;
      callback({ requestHeaders: details.requestHeaders });
    },
  );

  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      ...(process.platform === "darwin"
        ? [
            {
              label: productName,
              submenu: [
                { role: "about" },
                { type: "separator" },
                { role: "quit" },
              ],
            },
          ]
        : []),
      {
        label: "File",
        submenu: [
          { role: "close" },
          ...(process.platform === "darwin" ? [] : [{ role: "quit" }]),
        ],
      },
      {
        label: "Edit",
        submenu: [
          { role: "undo" },
          { role: "redo" },
          { type: "separator" },
          { role: "cut" },
          { role: "copy" },
          { role: "paste" },
          { role: "selectAll" },
        ],
      },
      {
        label: "View",
        submenu: [
          { role: "reload" },
          { role: "resetZoom" },
          { role: "zoomIn" },
          { role: "zoomOut" },
          { role: "togglefullscreen" },
        ],
      },
      {
        label: "Help",
        submenu: [
          {
            label: "GitHub releases",
            click: () =>
              shell.openExternal(
                "https://github.com/axvrma/auditbench/releases/latest",
              ),
          },
          {
            label: "Abhishek Verma",
            click: () => shell.openExternal("https://axvrma.com"),
          },
        ],
      },
    ]),
  );
  openDashboard();
  if (process.env.LIGHTHOUSE_SMOKE_TEST === "1") {
    await once(mainWindow.webContents, "did-finish-load");
    const deadline = Date.now() + 15000;
    while (
      !(await mainWindow.webContents.executeJavaScript(
        "Boolean(document.querySelector('.summary-grid'))",
      ))
    ) {
      if (Date.now() > deadline)
        throw new Error("The renderer did not initialize its workspace.");
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (app.getName() !== productName)
      throw new Error("The visible application identity was not updated.");
    const title =
      await mainWindow.webContents.executeJavaScript("document.title");
    const health = await mainWindow.webContents.executeJavaScript(
      "fetch('/api/settings').then(async response => ({ ok: response.ok, settings: await response.json() }))",
    );
    if (!health.ok || !health.settings.version)
      throw new Error("The renderer cannot reach its local engine.");
    const denied = await fetch(`${origin}/api/settings`);
    if (denied.status !== 403)
      throw new Error("Desktop session protection is not enforced.");
    if (process.env.LIGHTHOUSE_SMOKE_PHASE === "save") {
      const saved = await mainWindow.webContents.executeJavaScript(
        `fetch('/api/settings', {method: 'PATCH', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({appearance:'dark', sidebarCompact:true})}).then(response => response.json())`,
      );
      if (saved.appearance !== "dark" || !saved.sidebarCompact)
        throw new Error("Desktop preferences were not persisted.");
    } else if (process.env.LIGHTHOUSE_SMOKE_PHASE === "restore") {
      const restored = await mainWindow.webContents.executeJavaScript(
        "document.documentElement.dataset.theme === 'dark' && Boolean(document.querySelector('.app-shell.compact'))",
      );
      if (!restored)
        throw new Error(
          "Desktop preferences were not restored across origins.",
        );
    }
    console.log(
      "DESKTOP_SMOKE_LOADED",
      title,
      "· workspace initialized · engine connected · session protected",
    );
    setTimeout(() => app.quit(), 500);
  }
}

if (app.requestSingleInstanceLock()) {
  app.on("second-instance", () => {
    if (origin) openDashboard();
  });
  app.on("activate", () => {
    if (origin) openDashboard();
  });
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
  app.on("before-quit", (event) => {
    if (!server || quitting) return;
    event.preventDefault();
    if (!server.listening) return;
    server.close();
    const deadline = setTimeout(() => {
      quitting = true;
      app.exit(0);
    }, 10000);
    deadline.unref();
    void stopAudits()
      .catch(console.error)
      .finally(() => {
        clearTimeout(deadline);
        server.closeAllConnections();
        quitting = true;
        app.quit();
      });
  });
  void app
    .whenReady()
    .then(start)
    .catch((error) => {
      console.error("Desktop initialization failed:", error.message);
      if (process.env.LIGHTHOUSE_SMOKE_TEST === "1") {
        app.exit(1);
        return;
      }
      dialog.showErrorBox(`${productName} could not start`, error.message);
      app.quit();
    });
} else {
  app.quit();
}
