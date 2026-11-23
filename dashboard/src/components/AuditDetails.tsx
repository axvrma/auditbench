import { useEffect, useState } from "react";
import { FileJson, Image } from "lucide-react";
import { getFullReport, type Audit } from "../lib/api";
import { Dialog, timestamp } from "./ui";
import { ScoreCards } from "./ScoreCards";
import { Suggestions } from "./Suggestions";
export function AuditDetails({
  audit,
  previous,
  onClose,
}: {
  audit: Audit;
  previous?: Audit;
  onClose: () => void;
}) {
  const [report, setReport] = useState<object>();
  const [error, setError] = useState("");
  const [image, setImage] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setReport(undefined);
    setError("");
    setImage(false);
  }, [audit.id]);
  async function loadReport() {
    setBusy(true);
    try {
      setReport(await getFullReport(audit.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Report unavailable");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog title="Audit details" onClose={onClose} wide>
      <div className="dialog-body">
        <p className="mono muted">
          Started {timestamp(audit.created_at)} · {audit.status}
          {audit.completed_at
            ? ` · Finished ${timestamp(audit.completed_at)}`
            : ""}
        </p>
        {audit.error_message && <p className="error">{audit.error_message}</p>}
        {(audit.status === "completed" ||
          audit.has_report ||
          audit.screenshot_path) && (
          <>
            {audit.status === "completed" && (
              <ScoreCards audit={audit} previous={previous} />
            )}
            <div className="actions">
              <button
                disabled={busy || !audit.has_report}
                onClick={() => void loadReport()}
              >
                <FileJson size={16} />
                {busy ? "Loading…" : "Full Lighthouse JSON"}
              </button>
              {audit.screenshot_path && (
                <button onClick={() => setImage(!image)}>
                  <Image size={16} />
                  {image ? "Hide screenshot" : "View screenshot"}
                </button>
              )}
            </div>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            {image && (
              <img
                className="audit-screenshot"
                src={audit.screenshot_path!}
                alt="Website captured during this audit"
              />
            )}
            {report && (
              <details open>
                <summary>Full Lighthouse report</summary>
                <pre className="report">{JSON.stringify(report, null, 2)}</pre>
              </details>
            )}
            {audit.status === "completed" && <Suggestions auditId={audit.id} />}
          </>
        )}
      </div>
    </Dialog>
  );
}
