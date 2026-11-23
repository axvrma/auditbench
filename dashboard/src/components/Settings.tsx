import { useState, type FormEvent } from "react";
import { Monitor, ShieldCheck, ExternalLink } from "lucide-react";
import { useWorkspace } from "../hooks/useWorkspace";
import { saveSettings } from "../lib/api";
import type { Theme } from "../lib/theme";
import { Field } from "./ui";
export default function Settings({
  theme,
  setTheme,
}: {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}) {
  const { settings, refresh, setNotice } = useWorkspace();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await saveSettings(
        String(new FormData(e.currentTarget).get("chromePath") || "").trim(),
      );
      await refresh();
      setNotice(
        "Chrome configuration saved. It will be used for the next audit.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Settings could not be saved");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="settings-grid">
      <section className="panel settings-panel">
        <Monitor size={24} />
        <h2>Make it your workspace</h2>
        <p className="muted">
          Your appearance preference follows you across restarts.
        </p>
        <Field label="Appearance">
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value as Theme)}
          >
            <option value="system">Use system preference</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </Field>
      </section>
      <section className="panel settings-panel">
        <ShieldCheck size={24} />
        <h2>Local audit engine</h2>
        <p className={settings?.chromeAvailable ? "good" : "poor"}>
          {settings?.chromeAvailable
            ? "Chrome executable detected"
            : "Chrome not detected. Install Chrome or set its executable path."}
        </p>
        <form className="form-stack" onSubmit={save}>
          <Field
            label="Chrome / Chromium executable"
            hint="Absolute executable path. Clear this field to use automatic detection."
          >
            <input
              name="chromePath"
              defaultValue={settings?.chromePath || ""}
              placeholder="Automatically detect Chrome"
            />
          </Field>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="primary" disabled={busy}>
            {busy ? "Saving…" : "Save Chrome configuration"}
          </button>
        </form>
        <p className="muted">Default audit profile: {settings?.auditProfile}</p>
      </section>
      <section className="panel settings-panel">
        <h2>Diagnostics & storage</h2>
        <dl className="diagnostics">
          <dt>Application</dt>
          <dd className="mono">v{settings?.version}</dd>
          <dt>Runtime</dt>
          <dd>
            {settings?.desktop
              ? "Electron desktop"
              : "Local development server"}
          </dd>
          <dt>Secret protection</dt>
          <dd>
            {settings?.secureStorage ? "Available" : "Locked / unavailable"}
          </dd>
          <dt>Local data directory</dt>
          <dd className="mono wrap">{settings?.dataDirectory}</dd>
        </dl>
        <p className="muted">
          Reports, screenshots and the SQLite database live here. Back up this
          directory with the app closed. Encrypted secrets require the original
          OS key store.
        </p>
      </section>
      <section className="panel settings-panel about">
        <img src="/lighthouse.svg" alt="" width="42" height="42" />
        <h2>Auditbench</h2>
        <p className="muted">
          A local-first performance intelligence workspace for developers and
          engineering teams.
        </p>
        <a
          href="https://github.com/axvrma/auditbench"
          target="_blank"
          rel="noreferrer"
        >
          Source on GitHub <ExternalLink size={14} />
        </a>
        <a
          href="https://github.com/axvrma/auditbench/releases/latest"
          target="_blank"
          rel="noreferrer"
        >
          Check releases <ExternalLink size={14} />
        </a>
        <a href="https://axvrma.com" target="_blank" rel="noreferrer">
          Abhishek Verma <ExternalLink size={14} />
        </a>
      </section>
    </div>
  );
}
