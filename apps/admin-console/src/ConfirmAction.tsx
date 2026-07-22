import { useState } from "react";

export interface ConfirmActionProps {
  readonly title: string;
  readonly description: string;
  readonly expected: string;
  readonly tone?: "normal" | "danger";
  readonly onConfirm: (reason: string, confirmation: string) => Promise<void>;
}

export function ConfirmAction({
  title,
  description,
  expected,
  tone = "normal",
  onConfirm,
}: ConfirmActionProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const ready = reason.length >= 10 && confirmation === expected;
  if (!open)
    return (
      <button
        className={tone === "danger" ? "danger" : ""}
        onClick={() => {
          setOpen(true);
        }}
      >
        {title}
      </button>
    );
  return (
    <div className="confirm-box">
      <strong>{title}</strong>
      <p>{description}</p>
      <label>
        变更原因
        <textarea
          aria-label={`${title}原因`}
          value={reason}
          onChange={(event) => {
            setReason(event.target.value);
          }}
        />
      </label>
      <label>
        输入确认词 <code>{expected}</code>
        <input
          aria-label={`${title}确认词`}
          value={confirmation}
          onChange={(event) => {
            setConfirmation(event.target.value);
          }}
        />
      </label>
      <div>
        <button
          onClick={() => {
            setOpen(false);
          }}
        >
          取消
        </button>
        <button
          className={tone === "danger" ? "danger" : "primary"}
          disabled={!ready || busy}
          onClick={() => {
            setBusy(true);
            void onConfirm(reason, confirmation).finally(() => {
              setBusy(false);
            });
          }}
        >
          {busy ? "处理中…" : "二次确认执行"}
        </button>
      </div>
    </div>
  );
}
