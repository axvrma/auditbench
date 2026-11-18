import { app, BrowserWindow, dialog, session, shell } from 'electron';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import path from 'node:path';

const productName = 'Lighthouse Agent';
app.setName(productName);

let server;
let stopAudits;
let desktopSession;
let origin;
let mainWindow;
let quitting = false;

function openDashboard() {
  if (mainWindow) {
    mainWindow.focus();
    return;
  }

  const webPreferences = { session: desktopSession, sandbox: true, contextIsolation: true, nodeIntegration: false };
  const window = new BrowserWindow({
    title: productName,
    width: 1320,
    height: 900,
    minWidth: 760,
    minHeight: 560,
    backgroundColor: '#f8fafc',
    webPreferences,
  });
  mainWindow = window;
  window.on('closed', () => { mainWindow = undefined; });

  const preventNavigation = (event, url) => {
    if (new URL(url).origin !== origin) event.preventDefault();
  };
  window.webContents.on('will-navigate', preventNavigation);
  window.webContents.on('will-redirect', preventNavigation);
  window.webContents.setWindowOpenHandler(({ url }) => {
    const target = new URL(url);
    if (target.origin === origin && target.pathname.startsWith('/screenshots/')) {
      return { action: 'allow', overrideBrowserWindowOptions: { webPreferences } };
    }
    if (target.origin !== origin && ['https:', 'http:'].includes(target.protocol)) {
      void shell.openExternal(url).catch(console.error);
    }
    return { action: 'deny' };
  });

  void window.loadURL(origin).catch(error => {
    if (!window.isDestroyed()) dialog.showErrorBox(productName, error.message);
  });
}

async function start() {
  const token = randomBytes(32).toString('hex');
  process.env.LIGHTHOUSE_DESKTOP_TOKEN = token;
  process.env.LIGHTHOUSE_DATA_DIR ||= path.join(app.getPath('userData'), 'audits');

  const backend = await import('../server/dist/index.js');
  stopAudits = backend.stopAudits;
  server = backend.startServer(0, path.join(app.getAppPath(), 'dashboard', 'dist'));
  await once(server, 'listening');
  origin = `http://127.0.0.1:${server.address().port}`;

  desktopSession = session.fromPartition('lighthouse-desktop');
  desktopSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  desktopSession.webRequest.onBeforeSendHeaders({ urls: ['http://127.0.0.1/*'] }, (details, callback) => {
    if (new URL(details.url).origin === origin) details.requestHeaders['X-Lighthouse-Session'] = token;
    callback({ requestHeaders: details.requestHeaders });
  });

  openDashboard();
}

if (app.requestSingleInstanceLock()) {
  app.on('second-instance', () => { if (origin) openDashboard(); });
  app.on('activate', () => { if (origin) openDashboard(); });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
  app.on('before-quit', event => {
    if (!server || quitting) return;
    event.preventDefault();
    if (!server.listening) return;
    server.close();
    void stopAudits().catch(console.error).finally(() => {
      quitting = true;
      app.quit();
    });
  });
  void app.whenReady().then(start).catch(error => {
    dialog.showErrorBox(`${productName} could not start`, error.message);
    app.quit();
  });
} else {
  app.quit();
}
