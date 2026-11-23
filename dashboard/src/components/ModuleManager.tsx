import { useState, type FormEvent } from "react";
import { Plus, Play, Pencil, Trash2, Globe, KeyRound } from "lucide-react";
import * as api from "../lib/api";
import { useWorkspace } from "../hooks/useWorkspace";
import { WebsiteForm } from "./WebsiteForm";
import { Dialog, Empty, Field, Score, timestamp } from "./ui";
export function ModuleManager() {
  const { modules, urls, audits, status, start, refresh, setError } =
    useWorkspace();
  const [editing, setEditing] = useState<api.Module | "new">();
  const [website, setWebsite] = useState<{
    moduleId: string;
    value?: api.Url;
  }>();
  const [remove, setRemove] = useState<{
    kind: "module" | "website";
    id: string;
    name: string;
  }>();
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [query, setQuery] = useState("");
  async function saveModule(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const name = String(data.get("name"));
    const description = String(data.get("description"));
    const color = String(data.get("color"));
    setBusy(true);
    setFormError("");
    try {
      if (editing && editing !== "new")
        await api.updateModule(editing.id, { name, description, color });
      else await api.addModule(name, description, color);
      await refresh();
      setEditing(undefined);
    } catch (e) {
      setFormError(
        e instanceof Error ? e.message : "Module could not be saved",
      );
    } finally {
      setBusy(false);
    }
  }
  async function toggle(module: api.Module) {
    try {
      await api.updateModule(module.id, { is_active: !module.is_active });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update module");
    }
  }
  async function toggleWebsite(site: api.Url) {
    try {
      await api.updateUrl(site.id, { is_active: !site.is_active });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update website");
    }
  }
  async function deleteRecord() {
    if (!remove) return;
    setBusy(true);
    try {
      await (remove.kind === "module"
        ? api.deleteModule(remove.id)
        : api.deleteUrl(remove.id));
      await refresh();
      setRemove(undefined);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Could not delete record");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="stack">
      <div className="row">
        <p className="muted">
          Organize websites into focused projects. Audit one page or a whole
          module.
        </p>
        <button
          className="primary"
          onClick={() => {
            setFormError("");
            setEditing("new");
          }}
        >
          <Plus size={16} />
          New module
        </button>
      </div>
      <input
        className="module-search"
        aria-label="Search modules and websites"
        placeholder="Find a module or website…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {!modules.length && (
        <section className="panel">
          <Empty title="A home for your websites">
            Create a module for a project, environment or team.
          </Empty>
        </section>
      )}
      {modules
        .filter((m) =>
          `${m.name} ${urls
            .filter((u) => u.module_id === m.id)
            .map((u) => u.name + " " + u.url)
            .join(" ")}`
            .toLowerCase()
            .includes(query.toLowerCase()),
        )
        .map((m) => {
          const sites = urls.filter((u) => u.module_id === m.id);
          const last = audits.find((a) => sites.some((u) => u.id === a.url_id));
          return (
            <section className="panel module-panel" key={m.id}>
              <header>
                <div className="module-title">
                  <i style={{ background: m.color }} />
                  <div>
                    <h2>{m.name}</h2>
                    <p className="muted">
                      {m.description || "No description"} · {sites.length}{" "}
                      websites
                    </p>
                    <small className="muted">
                      {last
                        ? `Last audit ${timestamp(last.created_at)}`
                        : "No audits yet"}
                    </small>
                  </div>
                </div>
                <div className="actions">
                  <button
                    role="switch"
                    aria-checked={m.is_active}
                    onClick={() => void toggle(m)}
                  >
                    {m.is_active ? "Active" : "Paused"}
                  </button>
                  <button
                    disabled={
                      status.inProgress ||
                      !m.is_active ||
                      !sites.some((s) => s.is_active)
                    }
                    onClick={() => void start(undefined, m.id)}
                  >
                    <Play size={14} />
                    Audit module
                  </button>
                  <button
                    className="icon-button"
                    aria-label={`Edit ${m.name}`}
                    onClick={() => {
                      setEditing(m);
                      setFormError("");
                    }}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    className="icon-button"
                    disabled={status.inProgress}
                    aria-label={`Delete ${m.name}`}
                    onClick={() => {
                      setRemove({ kind: "module", id: m.id, name: m.name });
                      setFormError("");
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </header>
              {!sites.length ? (
                <div className="module-empty">
                  <Globe size={20} />
                  <p>Add a website to start measuring this project.</p>
                </div>
              ) : (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Website</th>
                        <th>Authentication</th>
                        <th>Latest result</th>
                        <th>State</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sites.map((site) => {
                        const last = audits.find((a) => a.url_id === site.id);
                        return (
                          <tr key={site.id}>
                            <td>
                              <strong>{site.name || "Untitled website"}</strong>
                              <a
                                className="mono muted site-url"
                                href={site.url}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {site.url}
                              </a>
                            </td>
                            <td>
                              <span className="inline">
                                <KeyRound size={14} />
                                {site.credential_id
                                  ? "Saved credential"
                                  : site.auth_username
                                    ? "Website credential"
                                    : "Public"}
                              </span>
                            </td>
                            <td>
                              {last?.status === "completed" ? (
                                <Score value={last.performance_score} />
                              ) : (
                                <span
                                  className={
                                    last?.status === "failed" ? "poor" : "muted"
                                  }
                                >
                                  {last?.status || "Not audited"}
                                </span>
                              )}
                            </td>
                            <td>
                              <button
                                role="switch"
                                aria-checked={site.is_active}
                                onClick={() => void toggleWebsite(site)}
                              >
                                {site.is_active ? "Active" : "Paused"}
                              </button>
                            </td>
                            <td>
                              <div className="actions">
                                <button
                                  className="icon-button"
                                  disabled={
                                    status.inProgress ||
                                    !site.is_active ||
                                    !m.is_active
                                  }
                                  aria-label={`Audit ${site.name || site.url}`}
                                  onClick={() => void start(site.id)}
                                >
                                  <Play size={16} />
                                </button>
                                <button
                                  className="icon-button"
                                  aria-label={`Edit ${site.name || site.url}`}
                                  onClick={() =>
                                    setWebsite({ moduleId: m.id, value: site })
                                  }
                                >
                                  <Pencil size={16} />
                                </button>
                                <button
                                  className="icon-button"
                                  disabled={status.inProgress}
                                  aria-label={`Delete ${site.name || site.url}`}
                                  onClick={() => {
                                    setRemove({
                                      kind: "website",
                                      id: site.id,
                                      name: site.name || site.url,
                                    });
                                    setFormError("");
                                  }}
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="panel-bottom">
                <button
                  className="text-button"
                  onClick={() => setWebsite({ moduleId: m.id })}
                >
                  <Plus size={15} />
                  Add website
                </button>
              </div>
            </section>
          );
        })}
      {website && (
        <WebsiteForm
          moduleId={website.moduleId}
          website={website.value}
          onClose={() => setWebsite(undefined)}
        />
      )}
      {editing && (
        <Dialog
          title={editing === "new" ? "Create module" : "Edit module"}
          onClose={() => setEditing(undefined)}
        >
          <form className="dialog-body form-stack" onSubmit={saveModule}>
            {formError && (
              <p role="alert" className="error">
                {formError}
              </p>
            )}
            <Field label="Module name">
              <input
                name="name"
                required
                maxLength={200}
                defaultValue={editing === "new" ? "" : editing.name}
                placeholder="Production websites"
              />
            </Field>
            <Field label="Description">
              <textarea
                name="description"
                defaultValue={
                  editing === "new" ? "" : editing.description || ""
                }
              />
            </Field>
            <Field label="Module color">
              <input
                type="color"
                name="color"
                defaultValue={editing === "new" ? "#2e7457" : editing.color}
              />
            </Field>
            <div className="dialog-actions">
              <button type="button" onClick={() => setEditing(undefined)}>
                Cancel
              </button>
              <button className="primary" disabled={busy}>
                {busy ? "Saving…" : "Save module"}
              </button>
            </div>
          </form>
        </Dialog>
      )}
      {remove && (
        <Dialog
          title={`Delete ${remove.kind}`}
          onClose={() => setRemove(undefined)}
        >
          <div className="dialog-body">
            <p>
              Delete <strong>{remove.name}</strong>? Its{" "}
              {remove.kind === "module" ? "websites, " : ""}audit history and
              recommendations will be removed. This cannot be undone.
            </p>
            {formError && (
              <p className="error" role="alert">
                {formError}
              </p>
            )}
            <div className="dialog-actions">
              <button onClick={() => setRemove(undefined)}>Cancel</button>
              <button
                className="danger"
                disabled={busy}
                onClick={() => void deleteRecord()}
              >
                {busy ? "Deleting…" : "Delete permanently"}
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
