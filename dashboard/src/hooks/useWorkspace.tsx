import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import * as api from "../lib/api";
const emptyStatus: api.AuditStatus = {
  inProgress: false,
  total: 0,
  completed: 0,
  currentUrl: "",
  urls: [],
};
function useWorkspaceData() {
  const [modules, setModules] = useState<api.Module[]>([]);
  const [urls, setUrls] = useState<api.Url[]>([]);
  const [audits, setAudits] = useState<api.Audit[]>([]);
  const [credentials, setCredentials] = useState<api.Credential[]>([]);
  const [summary, setSummary] = useState<api.Summary>();
  const [settings, setSettings] = useState<api.Settings>();
  const [status, setStatus] = useState(emptyStatus);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const mounted = useRef(true);
  const refresh = useCallback(async () => {
    try {
      const [m, u, a, c, s, stats] = await Promise.all([
        api.getModules(),
        api.getUrls(),
        api.getAudits(),
        api.getCredentials(),
        api.getSettings(),
        api.getSummary(),
      ]);
      if (!mounted.current) return;
      setModules(m);
      setUrls(u);
      setAudits(a);
      setCredentials(c);
      setSettings(s);
      setSummary(stats);
      setError("");
    } catch (e) {
      if (mounted.current)
        setError(
          e instanceof Error
            ? e.message
            : "The local engine could not be reached.",
        );
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    void refresh();
    let timer: ReturnType<typeof setTimeout>;
    let active = true;
    let previous = "";
    async function poll() {
      try {
        const next = await api.getAuditStatus();
        if (!active) return;
        setStatus(next);
        const signature = JSON.stringify(
          next.urls.map((u) => [u.id, u.status]),
        );
        if (previous && signature !== previous) {
          void refresh();
          if (!next.inProgress)
            setNotice(
              next.urls.some((u) => u.status === "failed")
                ? "Audit finished with failures. Review the results below."
                : "Audit completed. Your workspace is up to date.",
            );
        }
        previous = signature;
        timer = setTimeout(poll, next.inProgress ? 1000 : 4000);
      } catch {
        if (active) {
          setError("The local engine is unavailable. Retry the connection.");
          timer = setTimeout(poll, 5000);
        }
      }
    }
    void poll();
    return () => {
      mounted.current = false;
      active = false;
      clearTimeout(timer);
    };
  }, [refresh]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(timer);
  }, [notice]);
  const savePreferences = async (preferences: Partial<api.UiPreferences>) => {
    setSettings((previous) =>
      previous ? { ...previous, ...preferences } : previous,
    );
    try {
      await api.savePreferences(preferences);
    } catch {
      setError(
        "Your preference could not be saved. Retry the local engine connection.",
      );
    }
  };
  const start = async (urlId?: string, moduleId?: string) => {
    try {
      await api.runAudit(urlId, moduleId);
      setStatus(await api.getAuditStatus());
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Audit could not start.");
    }
  };
  return {
    modules,
    urls,
    audits,
    credentials,
    settings,
    summary,
    status,
    error,
    loading,
    notice,
    refresh,
    start,
    setError,
    setNotice,
    savePreferences,
  };
}
const Workspace = createContext<ReturnType<typeof useWorkspaceData> | null>(
  null,
);
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  return (
    <Workspace.Provider value={useWorkspaceData()}>
      {children}
    </Workspace.Provider>
  );
}
export function useWorkspace() {
  const value = useContext(Workspace);
  if (!value) throw new Error("Workspace provider missing");
  return value;
}
