import { useState, useEffect, useRef } from "react";
import {
  Globe2,
  Layers,
  CheckCircle2,
  ArrowUpRight,
  Play,
  ScanLine,
} from "lucide-react";
import { useWorkspace } from "../hooks/useWorkspace";
import { type Audit } from "../lib/api";
import { ScoreCards } from "./ScoreCards";
import { ScoreChart } from "./ScoreChart";
import { Suggestions } from "./Suggestions";
import { Empty, timestamp } from "./ui";
import AuditHistory from "./AuditHistory";
import { AuditDetails } from "./AuditDetails";
export function Dashboard({ onManage }: { onManage: () => void }) {
  const {
    urls,
    audits,
    modules,
    summary,
    status,
    start,
    settings,
    savePreferences,
  } = useWorkspace();
  const [websiteId, setWebsiteId] = useState(
    () => localStorage.getItem("lighthouse-website") || "",
  );
  const [selected, setSelected] = useState<Audit>();
  const preferenceLoaded = useRef(false);
  useEffect(() => {
    if (settings?.desktop && !preferenceLoaded.current) {
      preferenceLoaded.current = true;
      setWebsiteId(settings.selectedWebsite);
    }
  }, [settings]);
  const site = urls.find((u) => u.id === websiteId) || urls[0];
  const completed = audits.filter((a) => a.status === "completed");
  const attention = summary?.attention || 0;
  const history = audits.filter((a) => a.url_id === site?.id);
  const successful = history.filter((a) => a.status === "completed");
  const recent = successful[0];
  const stats = [
    {
      label: "Monitored websites",
      value: summary?.websites ?? urls.length,
      icon: Globe2,
    },
    {
      label: "Active modules",
      value:
        summary?.activeModules ?? modules.filter((m) => m.is_active).length,
      icon: Layers,
    },
    {
      label: "Completed runs",
      value: summary?.completed ?? completed.length,
      icon: CheckCircle2,
    },
    { label: "Sites needing attention", value: attention, icon: ScanLine },
  ];
  return (
    <div className="stack">
      <div className="summary-grid">
        {stats.map(({ label, value, icon: Icon }) => (
          <div className="stat" key={label}>
            <div>
              <span>{label}</span>
              <Icon size={17} />
            </div>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <div className="average-strip">
        <span>Latest completed run per website</span>
        <span>
          Avg. performance{" "}
          <strong className="mono">{summary?.performance ?? "—"}</strong>
        </span>
        <span>
          Avg. accessibility{" "}
          <strong className="mono">{summary?.accessibility ?? "—"}</strong>
        </span>
        <span>
          Avg. SEO <strong className="mono">{summary?.seo ?? "—"}</strong>
        </span>
        <small title="Each website contributes one latest completed run. Missing scores are excluded separately for each category.">
          How it’s calculated
        </small>
      </div>
      {!site ? (
        <section className="panel">
          <Empty title="Your first insight starts with a website">
            <p>
              Create a module, add a website, then run a local Lighthouse audit.
            </p>
            <button className="primary" onClick={onManage}>
              Create your first module
            </button>
          </Empty>
        </section>
      ) : (
        <>
          <section className="panel latest">
            <header>
              <div>
                <p className="eyebrow">LATEST COMPLETED AUDIT</p>
                <h2>{site.name || "Website overview"}</h2>
                <a
                  className="mono site-url"
                  href={site.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {site.url}
                  <ArrowUpRight size={14} />
                </a>
              </div>
              <div className="actions">
                <select
                  aria-label="Selected website"
                  value={site.id}
                  onChange={(e) => {
                    setWebsiteId(e.target.value);
                    if (settings?.desktop)
                      void savePreferences({ selectedWebsite: e.target.value });
                    localStorage.setItem("lighthouse-website", e.target.value);
                  }}
                >
                  {urls.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name || u.url}
                    </option>
                  ))}
                </select>
                <button
                  disabled={
                    status.inProgress ||
                    !site.is_active ||
                    modules.find((m) => m.id === site.module_id)?.is_active ===
                      false
                  }
                  onClick={() => void start(site.id)}
                >
                  <Play size={14} />
                  Run audit
                </button>
              </div>
            </header>
            {history[0]?.status === "failed" && (
              <div className="error">
                Latest attempt failed: {history[0].error_message}
              </div>
            )}
            {recent ? (
              <>
                <div className="audit-meta">
                  <span className="status">
                    {[
                      recent.performance_score,
                      recent.accessibility_score,
                      recent.best_practices_score,
                      recent.seo_score,
                    ].some((s) => s == null)
                      ? "Partial scores · review report"
                      : attention &&
                          [
                            recent.performance_score,
                            recent.accessibility_score,
                            recent.best_practices_score,
                            recent.seo_score,
                          ].some((s) => s != null && s < 90)
                        ? "Improvements available"
                        : "Healthy scores"}
                  </span>
                  <span className="mono muted">
                    {recent.completed_at ? "Completed " : "Run started "}
                    {timestamp(recent.completed_at || recent.created_at)}
                  </span>
                  <button
                    className="text-button"
                    onClick={() => setSelected(recent)}
                  >
                    Open audit details
                  </button>
                </div>
                <div className="latest-body">
                  <ScoreCards
                    audit={recent}
                    previous={
                      recent.audit_profile
                        ? successful
                            .slice(1)
                            .find(
                              (a) => a.audit_profile === recent.audit_profile,
                            )
                        : undefined
                    }
                  />
                  {recent.screenshot_path ? (
                    <button
                      className="screenshot-preview"
                      onClick={() => setSelected(recent)}
                      aria-label="Open screenshot and audit details"
                    >
                      <img
                        src={recent.screenshot_path}
                        alt={`Captured website: ${site.name || site.url}`}
                        loading="lazy"
                      />
                      <span>Captured during this run</span>
                    </button>
                  ) : (
                    <div className="screenshot-missing">
                      <ScanLine size={25} />
                      <span>No screenshot captured</span>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <Empty title="Ready when you are">
                Run your first audit to capture scores, a screenshot and
                technical findings.
              </Empty>
            )}
          </section>
          <ScoreChart audits={history} onSelect={setSelected} />
          {recent && (
            <section className="panel">
              <Suggestions auditId={recent.id} />
            </section>
          )}
          <AuditHistory websiteId={site.id} limit={5} />
        </>
      )}
      {selected && (
        <AuditDetails
          audit={selected}
          previous={successful.find(
            (a) =>
              selected.audit_profile &&
              a.audit_profile === selected.audit_profile &&
              a.created_at < selected.created_at,
          )}
          onClose={() => setSelected(undefined)}
        />
      )}
    </div>
  );
}
