import { useState, type FormEvent } from "react";
import { KeyRound, Plus, Pencil, Trash2, ShieldCheck } from "lucide-react";
import {
  addCredential,
  updateCredential,
  deleteCredential,
  type Credential,
} from "../lib/api";
import { useWorkspace } from "../hooks/useWorkspace";
import { Dialog, Field, Empty } from "./ui";
export function CredentialManager() {
  const { credentials, settings, refresh, urls } = useWorkspace();
  const [editing, setEditing] = useState<Credential | "new">();
  const [remove, setRemove] = useState<Credential>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const value = (key: string) => String(data.get(key) || "");
    setBusy(true);
    setError("");
    const params = {
      name: value("name"),
      username: value("username"),
      auth_url: value("auth_url"),
      username_selector: value("username_selector"),
      password_selector: value("password_selector"),
      submit_selector: value("submit_selector"),
    };
    try {
      if (editing !== "new" && editing)
        await updateCredential(editing.id, {
          ...params,
          ...(value("password") ? { password: value("password") } : {}),
        });
      else await addCredential({ ...params, password: value("password") });
      await refresh();
      setEditing(undefined);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Credential could not be saved",
      );
    } finally {
      setBusy(false);
    }
  }
  async function deleteSaved() {
    if (!remove) return;
    setBusy(true);
    try {
      await deleteCredential(remove.id);
      await refresh();
      setRemove(undefined);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Credential could not be deleted",
      );
    } finally {
      setBusy(false);
    }
  }
  const current = editing && editing !== "new" ? editing : undefined;
  return (
    <div className="stack">
      <div className="security-note">
        <ShieldCheck size={24} />
        <div>
          <h2>Authentication, kept on your device.</h2>
          <p className="muted">
            {settings?.secureStorage
              ? "Passwords are encrypted at rest and never returned to this interface."
              : "Secure storage is unavailable. Existing passwords remain locked; unlock the OS key store in the desktop app."}
          </p>
        </div>
        <button
          className="primary"
          disabled={!settings?.secureStorage}
          onClick={() => {
            setEditing("new");
            setError("");
          }}
        >
          <Plus size={16} />
          Add credential
        </button>
      </div>
      {!credentials.length ? (
        <section className="panel">
          <Empty title="No saved credentials">
            Create a reusable login for websites you are authorized to audit.
          </Empty>
        </section>
      ) : (
        <div className="credential-grid">
          {credentials.map((c) => (
            <article className="panel credential" key={c.id}>
              <div className="row">
                <KeyRound size={22} />
                <div className="actions">
                  <button
                    className="icon-button"
                    aria-label={`Edit ${c.name}`}
                    onClick={() => {
                      setEditing(c);
                      setError("");
                    }}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label={`Delete ${c.name}`}
                    onClick={() => {
                      setRemove(c);
                      setError("");
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <h2>{c.name}</h2>
              <p className="mono muted">{c.username}</p>
              <p className="mono secret-presence">
                {c.has_password
                  ? "•••••••• · Password saved"
                  : "No password saved"}
              </p>
              {c.auth_url && <p className="mono wrap muted">{c.auth_url}</p>}
              <small className="muted">
                Used by {urls.filter((u) => u.credential_id === c.id).length}{" "}
                websites
              </small>
            </article>
          ))}
        </div>
      )}
      {editing && (
        <Dialog
          title={current ? "Edit credential" : "Add credential"}
          onClose={() => setEditing(undefined)}
        >
          <form className="dialog-body form-stack" onSubmit={submit}>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <Field label="Credential name">
              <input required name="name" defaultValue={current?.name} />
            </Field>
            <Field label="Login URL">
              <input
                type="url"
                name="auth_url"
                defaultValue={current?.auth_url || ""}
                placeholder="Defaults to the audited website"
              />
            </Field>
            <Field label="Username">
              <input
                required
                autoComplete="off"
                name="username"
                defaultValue={current?.username}
              />
            </Field>
            <Field
              label={
                current ? "Replace password (leave blank to keep)" : "Password"
              }
            >
              <input
                type="password"
                autoComplete="new-password"
                name="password"
                required={!current}
              />
            </Field>
            <details>
              <summary>Advanced login selectors</summary>
              <div className="form-stack">
                <Field label="Username selector">
                  <input
                    name="username_selector"
                    defaultValue={current?.username_selector || ""}
                  />
                </Field>
                <Field label="Password selector">
                  <input
                    name="password_selector"
                    defaultValue={current?.password_selector || ""}
                  />
                </Field>
                <Field label="Submit selector">
                  <input
                    name="submit_selector"
                    defaultValue={current?.submit_selector || ""}
                  />
                </Field>
              </div>
            </details>
            <div className="dialog-actions">
              <button type="button" onClick={() => setEditing(undefined)}>
                Cancel
              </button>
              <button className="primary" disabled={busy}>
                {busy ? "Saving…" : "Save credential"}
              </button>
            </div>
          </form>
        </Dialog>
      )}
      {remove && (
        <Dialog title="Delete credential" onClose={() => setRemove(undefined)}>
          <div className="dialog-body">
            <p>
              Delete {remove.name}? Websites using it will return to public
              authentication unless you assign another credential.
            </p>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <div className="dialog-actions">
              <button onClick={() => setRemove(undefined)}>Cancel</button>
              <button
                className="danger"
                disabled={busy}
                onClick={() => void deleteSaved()}
              >
                Delete credential
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
