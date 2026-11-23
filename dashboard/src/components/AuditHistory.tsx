import { useState } from "react";
import { Search, FileSearch } from "lucide-react";
import { useWorkspace } from "../hooks/useWorkspace";
import type { Audit } from "../lib/api";
import { AuditDetails } from "./AuditDetails";
import { Score, Empty, timestamp } from "./ui";
export default function AuditHistory({
  websiteId,
  limit,
}: {
  websiteId?: string;
  limit?: number;
}) {
  const { audits, urls, modules, summary } = useWorkspace();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [module, setModule] = useState("all");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Audit>();
  const size = limit || 20;
  const filtered = audits
    .filter((a) => {
      const site = urls.find((u) => u.id === a.url_id);
      return (
        (!websiteId || a.url_id === websiteId) &&
        (status === "all" || a.status === status) &&
        (module === "all" || site?.module_id === module) &&
        `${site?.name || ""} ${site?.url || ""} ${a.status}`
          .toLowerCase()
          .includes(query.toLowerCase())
      );
    })
    .sort((a, b) =>
      sort === "oldest"
        ? a.created_at.localeCompare(b.created_at)
        : sort === "performance"
          ? (a.performance_score ?? 101) - (b.performance_score ?? 101)
          : b.created_at.localeCompare(a.created_at),
    );
  const current = Math.min(
    page,
    Math.max(0, Math.ceil(filtered.length / size) - 1),
  );
  return (
    <section className="panel history">
      <header>
        <div>
          <p className="eyebrow">EVERY RUN, RECORDED</p>
          <h2>
            Audit history <span className="count">{filtered.length}</span>
          </h2>
        </div>
      </header>
      {summary && summary.auditCount > audits.length && (
        <p className="history-limit muted">
          Browsing the latest {audits.length.toLocaleString()} of{" "}
          {summary.auditCount.toLocaleString()} stored audits. Older reports
          remain in your local database.
        </p>
      )}
      <div className="filters">
        <label className="search">
          <Search size={16} />
          <input
            aria-label="Search audit history"
            value={query}
            placeholder="Search websites or status…"
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
          />
        </label>
        <select
          aria-label="Filter audit status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(0);
          }}
        >
          <option value="all">All statuses</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="running">Running</option>
        </select>
        <select
          aria-label="Filter module"
          value={module}
          onChange={(e) => {
            setModule(e.target.value);
            setPage(0);
          }}
        >
          <option value="all">All modules</option>
          {modules.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Sort audits"
          value={sort}
          onChange={(e) => {
            setSort(e.target.value);
            setPage(0);
          }}
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="performance">Lowest performance</option>
        </select>
      </div>
      {!filtered.length ? (
        <Empty title="No audits to display">
          Run an audit or adjust your filters.
        </Empty>
      ) : (
        <>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Website / module</th>
                  <th>Execution time</th>
                  <th>Status</th>
                  <th>Perf.</th>
                  <th>A11y</th>
                  <th>Best pr.</th>
                  <th>SEO</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered
                  .slice(current * size, (current + 1) * size)
                  .map((a) => {
                    const site = urls.find((u) => u.id === a.url_id);
                    return (
                      <tr key={a.id}>
                        <td>
                          <strong>
                            {site?.name || site?.url || "Deleted website"}
                          </strong>
                          <small className="muted">
                            {modules.find((m) => m.id === site?.module_id)
                              ?.name || "Unassigned"}
                          </small>
                        </td>
                        <td className="mono nowrap">
                          {timestamp(a.created_at)}
                        </td>
                        <td>
                          <span
                            className={`status ${a.status === "failed" ? "poor" : ""}`}
                            title={a.error_message || undefined}
                          >
                            {a.status}
                          </span>
                        </td>
                        {(
                          [
                            "performance_score",
                            "accessibility_score",
                            "best_practices_score",
                            "seo_score",
                          ] as const
                        ).map((key) => (
                          <td key={key}>
                            <Score value={a[key]} />
                          </td>
                        ))}
                        <td>
                          <button
                            className="icon-button"
                            aria-label={`View audit for ${site?.name || site?.url} at ${timestamp(a.created_at)}`}
                            onClick={() => setSelected(a)}
                          >
                            <FileSearch size={18} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
          {filtered.length > size && (
            <div className="pagination">
              <span>
                {current * size + 1}–
                {Math.min((current + 1) * size, filtered.length)} of{" "}
                {filtered.length}
              </span>
              <button
                disabled={current === 0}
                onClick={() => setPage(current - 1)}
              >
                Previous
              </button>
              <button
                disabled={(current + 1) * size >= filtered.length}
                onClick={() => setPage(current + 1)}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
      {selected && (
        <AuditDetails
          audit={selected}
          previous={
            audits.filter(
              (a) =>
                selected.audit_profile &&
                a.audit_profile === selected.audit_profile &&
                a.url_id === selected.url_id &&
                a.status === "completed" &&
                a.created_at < selected.created_at,
            )[0]
          }
          onClose={() => setSelected(undefined)}
        />
      )}
    </section>
  );
}
