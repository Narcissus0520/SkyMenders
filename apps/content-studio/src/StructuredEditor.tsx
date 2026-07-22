import type { ChangeEvent } from "react";

interface StructuredEditorProps {
  readonly value: unknown;
  readonly onChange: (value: unknown) => void;
  readonly path?: string;
  readonly depth?: number;
}

export function StructuredEditor({
  value,
  onChange,
  path = "$",
  depth = 0,
}: StructuredEditorProps): React.JSX.Element {
  if (typeof value === "string") {
    return (
      <input
        aria-label={path}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
    );
  }
  if (typeof value === "number") {
    return (
      <input
        aria-label={path}
        type="number"
        value={value}
        onChange={(event) => {
          onChange(Number(event.target.value));
        }}
      />
    );
  }
  if (typeof value === "boolean") {
    return (
      <input
        aria-label={path}
        type="checkbox"
        checked={value}
        onChange={(event) => {
          onChange(event.target.checked);
        }}
      />
    );
  }
  if (value === null) return <span className="empty-value">空引用</span>;
  if (Array.isArray(value)) {
    const entries = value as unknown[];
    if (entries.length === 0) return <span className="empty-value">空列表</span>;
    return (
      <div className="array-editor">
        {entries.map((entry, index) => (
          <fieldset key={`${path}.${index}`}>
            <legend>{entryLabel(entry, index)}</legend>
            <StructuredEditor
              value={entry}
              path={`${path}[${index}]`}
              depth={depth + 1}
              onChange={(next) => {
                onChange(entries.map((item, itemIndex) => (itemIndex === index ? next : item)));
              }}
            />
          </fieldset>
        ))}
      </div>
    );
  }
  if (typeof value === "object") {
    const record = value as Readonly<Record<string, unknown>>;
    return (
      <div className={depth === 0 ? "object-editor root-object" : "object-editor"}>
        {Object.entries(record).map(([key, entry]) => (
          <label className="field" key={`${path}.${key}`}>
            <span>{humanize(key)}</span>
            <StructuredEditor
              value={entry}
              path={`${path}.${key}`}
              depth={depth + 1}
              onChange={(next) => {
                onChange({ ...record, [key]: next });
              }}
            />
          </label>
        ))}
      </div>
    );
  }
  return <span className="empty-value">不支持的字段</span>;
}

export function importStructuredFile(
  event: ChangeEvent<HTMLInputElement>,
  onValue: (value: unknown) => void,
): void {
  const file = event.target.files?.[0];
  if (file === undefined) return;
  void file.text().then((raw) => {
    onValue(JSON.parse(raw) as unknown);
  });
  event.target.value = "";
}

function entryLabel(value: unknown, index: number): string {
  if (typeof value === "object" && value !== null && "id" in value && typeof value.id === "string")
    return value.id;
  return `项目 ${index + 1}`;
}

function humanize(value: string): string {
  return value.replaceAll(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
}
