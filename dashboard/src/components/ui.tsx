import { useEffect, useRef, type ReactNode } from "react";
import { X, Radar } from "lucide-react";
export function Dialog({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    const previous = document.activeElement as HTMLElement | null;
    dialog.showModal();
    return () => {
      dialog.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={wide ? "dialog wide" : "dialog"}
      aria-labelledby="dialog-title"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <header>
        <h2 id="dialog-title">{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={19} />
        </button>
      </header>
      {children}
    </dialog>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <Radar size={32} />
      <h3>{title}</h3>
      <div className="muted">{children}</div>
    </div>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function scoreClass(score: number | null) {
  return score == null
    ? "muted"
    : score >= 90
      ? "good"
      : score >= 50
        ? "warning"
        : "poor";
}
export function Score({ value }: { value: number | null }) {
  return <span className={`score ${scoreClass(value)}`}>{value ?? "—"}</span>;
}
export function timestamp(value: string) {
  return new Date(
    value.includes("T") ? value : value.replace(" ", "T") + "Z",
  ).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "medium" });
}
