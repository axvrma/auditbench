import { lazy, Suspense, useEffect, useState, useRef } from "react";
import {
  LayoutDashboard,
  Layers,
  History,
  KeyRound,
  Settings2,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Moon,
  Sun,
  Play,
  Activity,
  X,
} from "lucide-react";
import { WorkspaceProvider, useWorkspace } from "./hooks/useWorkspace";
import { applyTheme, savedTheme, type Theme } from "./lib/theme";
import { Dashboard } from "./components/Dashboard";
import { type UiPreferences } from "./lib/api";
import { ModuleManager } from "./components/ModuleManager";
import { CredentialManager } from "./components/CredentialManager";
import AuditHistory from "./components/AuditHistory";
const Settings = lazy(() => import("./components/Settings"));
const views = [
  { id: "overview", name: "Overview", icon: LayoutDashboard },
  { id: "modules", name: "Modules", icon: Layers },
  { id: "history", name: "Audit history", icon: History },
  { id: "credentials", name: "Credentials", icon: KeyRound },
  { id: "settings", name: "Settings", icon: Settings2 },
];
function Shell() {
  const workspace = useWorkspace();
  const [view, setView] = useState(
    () => localStorage.getItem("lighthouse-view") || "overview",
  );
  const [compact, setCompact] = useState(
    () => localStorage.getItem("lighthouse-compact") === "true",
  );
  const [theme, setTheme] = useState<Theme>(savedTheme);
  const [systemDark, setSystemDark] = useState(
    () => matchMedia("(prefers-color-scheme: dark)").matches,
  );
  const [dismissedProgress, setDismissedProgress] = useState("");
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const update = () => {
      setSystemDark(media.matches);
      applyTheme(theme, media.matches);
    };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [theme]);
  const preferencesLoaded = useRef(false);
  useEffect(() => {
    if (!workspace.settings?.desktop || preferencesLoaded.current) return;
    preferencesLoaded.current = true;
    setTheme(workspace.settings.appearance);
    setCompact(workspace.settings.sidebarCompact);
    setView(workspace.settings.activeView);
  }, [workspace.settings]);
  const persist = (preferences: Partial<UiPreferences>) => {
    if (workspace.settings?.desktop)
      void workspace.savePreferences(preferences);
  };
  const changeTheme = (next: Theme) => {
    setTheme(next);
    persist({ appearance: next });
  };
  const navigate = (next: string) => {
    setView(next);
    persist({ activeView: next });
    localStorage.setItem("lighthouse-view", next);
  };
  const isDark = theme === "dark" || (theme === "system" && systemDark);
  const progressKey = JSON.stringify(workspace.status.urls);
  return (
    <div className={`app-shell ${compact ? "compact" : ""}`}>
      <a className="skip-link" href="#main">
        Skip to workspace
      </a>
      <aside className="sidebar">
        <a
          href="#"
          className="brand"
          onClick={(e) => {
            e.preventDefault();
            navigate("overview");
          }}
        >
          <img src="/lighthouse.svg" alt="" />
          <span>Auditbench</span>
        </a>
        <div className="workspace-label">PERSONAL WORKSPACE</div>
        <nav aria-label="Workspace">
          {views.map(({ id, name, icon: Icon }) => (
            <button
              key={id}
              onClick={() => navigate(id)}
              className={view === id ? "active" : ""}
              aria-current={view === id ? "page" : undefined}
              title={name}
            >
              <Icon size={18} />
              <span>{name}</span>
              {id === "modules" && <small>{workspace.modules.length}</small>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="local-note">
            <Activity size={17} />
            <span>
              Local by design<small>Your data stays on this device.</small>
            </span>
          </div>
          <a href="https://axvrma.com" target="_blank" rel="noreferrer">
            Abhishek Verma
          </a>
          <button
            className="collapse-button"
            aria-label={compact ? "Expand sidebar" : "Compact sidebar"}
            onClick={() => {
              setCompact(!compact);
              persist({ sidebarCompact: !compact });
              localStorage.setItem("lighthouse-compact", String(!compact));
            }}
          >
            {compact ? (
              <PanelLeftOpen size={18} />
            ) : (
              <PanelLeftClose size={18} />
            )}
            <span>Collapse sidebar</span>
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <span>/</span>{" "}
            <strong>
              {views.find((v) => v.id === view)?.name || "Overview"}
            </strong>
          </div>
          <div className="toolbar">
            <span className={`engine ${workspace.error ? "poor" : ""}`}>
              <i />
              {workspace.error
                ? "Needs attention"
                : workspace.status.inProgress
                  ? "Engine auditing"
                  : "Engine ready"}
            </span>
            <span className="version">
              v{workspace.settings?.version || "…"}
            </span>
            <button
              className="icon-button"
              title="Refresh workspace"
              aria-label="Refresh workspace"
              onClick={() => void workspace.refresh()}
            >
              <RefreshCw size={17} />
            </button>
            <button
              className="icon-button"
              aria-label="Toggle color theme"
              title="Toggle color theme"
              onClick={() => changeTheme(isDark ? "light" : "dark")}
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button
              className="primary"
              disabled={
                workspace.status.inProgress ||
                !workspace.urls.some((u) => u.is_active)
              }
              onClick={() => void workspace.start()}
            >
              <Play size={14} />
              {workspace.status.inProgress ? "Auditing…" : "Run all audits"}
            </button>
          </div>
        </header>
        <main id="main" tabIndex={-1}>
          <div className="page-heading">
            <div>
              <p className="eyebrow">PERFORMANCE INTELLIGENCE</p>
              <h1>
                {view === "overview"
                  ? "A clearer view of your web."
                  : views.find((v) => v.id === view)?.name}
              </h1>
              <p className="muted">
                {view === "overview"
                  ? "Understand your performance. Track what changed. Know what to fix."
                  : "A focused workspace. Everything stored on your device."}
              </p>
            </div>
            <span className="workspace-badge">LOCAL WORKSPACE</span>
          </div>
          {workspace.error && (
            <div className="error" role="alert">
              {workspace.error}{" "}
              <button onClick={() => void workspace.refresh()}>
                Retry connection
              </button>
            </div>
          )}
          {workspace.settings?.migrationNotice && (
            <div className="banner" role="status">
              {workspace.settings.migrationNotice}
            </div>
          )}
          {workspace.status.total > 0 &&
            (workspace.status.inProgress ||
              dismissedProgress !== progressKey) && (
              <section
                className="audit-progress"
                aria-label="Audit progress"
                aria-live="polite"
              >
                <div className="row">
                  <strong>
                    {workspace.status.inProgress
                      ? "Audit in progress"
                      : "Last batch finished"}
                  </strong>
                  <span className="inline">
                    <span className="mono">
                      {workspace.status.completed} / {workspace.status.total}{" "}
                      processed
                    </span>
                    {!workspace.status.inProgress && (
                      <button
                        className="icon-button"
                        aria-label="Dismiss completed audit progress"
                        onClick={() => setDismissedProgress(progressKey)}
                      >
                        <X size={15} />
                      </button>
                    )}
                  </span>
                </div>
                <progress
                  value={workspace.status.completed}
                  max={workspace.status.total}
                />
                <div className="progress-urls">
                  {workspace.status.urls.map((u) => (
                    <span
                      key={u.id}
                      className={u.status === "failed" ? "poor" : ""}
                      title={u.error || u.url}
                    >
                      {u.name} · {u.status}
                    </span>
                  ))}
                </div>
              </section>
            )}
          {workspace.loading ? (
            <div className="skeleton" aria-label="Loading workspace" />
          ) : (
            <Suspense fallback={<div className="skeleton" />}>
              {view === "overview" ? (
                <Dashboard onManage={() => navigate("modules")} />
              ) : view === "modules" ? (
                <ModuleManager />
              ) : view === "credentials" ? (
                <CredentialManager />
              ) : view === "history" ? (
                <AuditHistory />
              ) : (
                <Settings theme={theme} setTheme={changeTheme} />
              )}
            </Suspense>
          )}
          <footer className="app-footer">
            <span>Auditbench · Local-first performance intelligence</span>
            <a href="https://axvrma.com" target="_blank" rel="noreferrer">
              Abhishek Verma
            </a>
          </footer>
        </main>
      </div>
      {workspace.notice && (
        <div className="toast" role="status">
          {workspace.notice}
        </div>
      )}
    </div>
  );
}
export default function App() {
  return (
    <WorkspaceProvider>
      <Shell />
    </WorkspaceProvider>
  );
}
