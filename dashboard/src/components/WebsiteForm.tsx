import { useState, type FormEvent } from "react";
import { addUrl, updateUrl, type Url } from "../lib/api";
import { useWorkspace } from "../hooks/useWorkspace";
import { Dialog, Field } from "./ui";
export function WebsiteForm({
  moduleId,
  website,
  onClose,
}: {
  moduleId: string;
  website?: Url;
  onClose: () => void;
}) {
  const { credentials, settings, refresh } = useWorkspace();
  const [mode, setMode] = useState(
    website?.credential_id
      ? "saved"
      : website?.auth_username
        ? "custom"
        : "none",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const value = (key: string) => String(data.get(key) || "").trim();
    setBusy(true);
    try {
      const params = {
        module_id: moduleId,
        url: value("url"),
        name: value("name"),
        credential_id: mode === "saved" ? value("credential_id") : null,
        auth_url: mode === "custom" ? value("auth_url") : null,
        auth_username: mode === "custom" ? value("auth_username") : null,
        ...(mode === "custom" &&
        !data.get("auth_password") &&
        website?.has_password
          ? {}
          : {
              auth_password:
                mode === "custom"
                  ? String(data.get("auth_password") || "")
                  : null,
            }),
        auth_username_selector:
          mode === "custom" ? value("username_selector") : null,
        auth_password_selector:
          mode === "custom" ? value("password_selector") : null,
        auth_submit_selector:
          mode === "custom" ? value("submit_selector") : null,
      };
      if (website) await updateUrl(website.id, params);
      else
        await addUrl({
          ...params,
          credential_id: params.credential_id || undefined,
          auth_url: params.auth_url || undefined,
          auth_username: params.auth_username || undefined,
          auth_password: params.auth_password || undefined,
          auth_username_selector: params.auth_username_selector || undefined,
          auth_password_selector: params.auth_password_selector || undefined,
          auth_submit_selector: params.auth_submit_selector || undefined,
        });
      await refresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Website could not be saved");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog title={website ? "Edit website" : "Add website"} onClose={onClose}>
      <form className="dialog-body form-stack" onSubmit={submit}>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <Field label="Website name">
          <input
            name="name"
            defaultValue={website?.name || ""}
            placeholder="Production storefront"
            maxLength={200}
          />
        </Field>
        <Field label="Website URL">
          <input
            name="url"
            type="url"
            required
            defaultValue={website?.url}
            placeholder="https://example.com"
          />
        </Field>
        <Field label="Authentication">
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="none">Public website</option>
            <option value="saved">Saved credential</option>
            <option value="custom">Website-specific credential</option>
          </select>
        </Field>
        {mode === "saved" && (
          <Field label="Saved credential">
            <select
              required
              name="credential_id"
              defaultValue={website?.credential_id || ""}
            >
              <option value="" disabled>
                Choose a credential
              </option>
              {credentials.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.username}
                </option>
              ))}
            </select>
          </Field>
        )}
        {mode === "custom" && (
          <>
            <Field label="Login URL">
              <input
                name="auth_url"
                type="url"
                defaultValue={website?.auth_url || ""}
                placeholder="Defaults to website URL"
              />
            </Field>
            <Field label="Username">
              <input
                required
                name="auth_username"
                autoComplete="off"
                defaultValue={website?.auth_username || ""}
              />
            </Field>
            <Field
              label={
                website?.has_password
                  ? "Replace password (leave blank to keep)"
                  : "Password"
              }
            >
              <input
                required={!website?.has_password}
                name="auth_password"
                type="password"
                autoComplete="new-password"
              />
            </Field>
            <details>
              <summary>Advanced login selectors</summary>
              <div className="form-stack">
                <Field label="Username selector">
                  <input
                    name="username_selector"
                    defaultValue={website?.auth_username_selector || ""}
                    placeholder='input[type="email"]'
                  />
                </Field>
                <Field label="Password selector">
                  <input
                    name="password_selector"
                    defaultValue={website?.auth_password_selector || ""}
                    placeholder='input[type="password"]'
                  />
                </Field>
                <Field label="Submit selector">
                  <input
                    name="submit_selector"
                    defaultValue={website?.auth_submit_selector || ""}
                    placeholder='button[type="submit"]'
                  />
                </Field>
              </div>
            </details>
            {!settings?.secureStorage && (
              <p className="error">
                Secure storage is unavailable. Passwords cannot be saved until
                the OS key store is unlocked.
              </p>
            )}
          </>
        )}
        <div className="dialog-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="primary"
            disabled={busy || (mode === "custom" && !settings?.secureStorage)}
          >
            {busy ? "Saving…" : "Save website"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
