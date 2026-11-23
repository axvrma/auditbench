import type { Audit } from "../lib/api";
import { scoreClass } from "./ui";
export const categories = [
  ["performance_score", "Performance", "#2e7457"],
  ["accessibility_score", "Accessibility", "#547bba"],
  ["best_practices_score", "Best practices", "#9376b7"],
  ["seo_score", "SEO", "#bd833a"],
] as const;
export function ScoreCards({
  audit,
  previous,
}: {
  audit: Audit;
  previous?: Audit;
}) {
  return (
    <div className="score-cards">
      {categories.map(([key, label]) => {
        const value = audit[key];
        const before = previous?.[key];
        const delta = value != null && before != null ? value - before : null;
        return (
          <div className="score-card" key={key}>
            <div className={`score-ring ${scoreClass(value)}`}>
              <svg viewBox="0 0 100 100" aria-hidden="true">
                <circle cx="50" cy="50" r="42" className="ring-track" />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  strokeDasharray={`${(value ?? 0) * 2.639} 264`}
                />
              </svg>
              <strong>{value ?? "—"}</strong>
            </div>
            <h3>{label}</h3>
            <small className={delta != null && delta < 0 ? "poor" : "muted"}>
              {delta == null
                ? "No comparable run"
                : `${delta > 0 ? "+" : ""}${delta} from previous`}
            </small>
          </div>
        );
      })}
    </div>
  );
}
