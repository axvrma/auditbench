import { useEffect, useState } from "react";
import { getSuggestions, type Suggestion } from "../lib/api";
import { Empty } from "./ui";
export function Suggestions({ auditId }: { auditId: string }) {
  const [items, setItems] = useState<Suggestion[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    getSuggestions(auditId)
      .then((data) => {
        if (active) setItems(data);
      })
      .catch(() => {
        if (active)
          setError(
            "Recommendations could not be loaded. Reopen this audit to retry.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [auditId]);
  return (
    <section className="recommendations">
      <header className="row">
        <div>
          <p className="eyebrow">FROM LIGHTHOUSE</p>
          <h2>Know what to fix next</h2>
        </div>
        <select
          aria-label="Recommendation category"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">All categories</option>
          {Array.from(new Set(items.map((s) => s.category))).map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </header>
      {error ? (
        <p role="alert" className="error">
          {error}
        </p>
      ) : loading ? (
        <div className="skeleton" />
      ) : !items.length ? (
        <Empty title="No actionable findings">
          Review the full report for manual checks and diagnostics.
        </Empty>
      ) : (
        items
          .filter((s) => filter === "all" || s.category === filter)
          .map((s) => (
            <details key={s.id} className="finding">
              <summary>
                <span className="finding-category">
                  {s.category === "pwa" ? "Historic PWA" : s.category}
                </span>
                <strong>{s.title}</strong>
                <span className="mono muted">
                  {s.savings_ms > 0
                    ? `Est. ${s.savings_ms.toLocaleString()} ms`
                    : s.savings_bytes > 0
                      ? `Est. ${Math.round(s.savings_bytes / 1024)} KiB`
                      : "Review"}
                </span>
              </summary>
              <p>{s.description}</p>
              <p className="muted">
                Diagnostic: <code>{s.audit_ref}</code>
                {s.score != null
                  ? ` · Check score ${Math.round(s.score * 100)}/100`
                  : ""}
                . Inspect this diagnostic in the full report for affected
                resources and implementation guidance.
              </p>
            </details>
          ))
      )}
    </section>
  );
}
