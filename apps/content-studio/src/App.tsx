import { useEffect, useMemo, useRef, useState } from "react";

import { ContentGatewayClient } from "./api.js";
import type {
  AuthorityCatalog,
  CatalogDocument,
  ContentDifference,
  ValidationIssue,
  ValidationResult,
} from "./api.js";
import { EDITOR_MODULES } from "./editor-modules.js";
import type { EditorModule } from "./editor-modules.js";
import {
  createHistory,
  isDirty,
  markSaved,
  pushHistory,
  redoHistory,
  undoHistory,
} from "./history.js";
import type { EditHistory } from "./history.js";
import { importStructuredFile, StructuredEditor } from "./StructuredEditor.js";

const api = new ContentGatewayClient();

export function App(): React.JSX.Element {
  const [moduleId, setModuleId] = useState("maps");
  const module = selectEditorModule(moduleId);
  const [catalogKey, setCatalogKey] = useState(firstCatalog(module.catalogs));
  const [document, setDocument] = useState<CatalogDocument | null>(null);
  const [history, setHistory] = useState<EditHistory<unknown> | null>(null);
  const [issues, setIssues] = useState<readonly ValidationIssue[]>([]);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [message, setMessage] = useState("正在连接本地内容网关…");
  const [actor, setActor] = useState("content.editor");
  const [publication, setPublication] = useState<{
    readonly id: string;
    readonly state: string;
  } | null>(null);
  const [authority, setAuthority] = useState<AuthorityCatalog | null>(null);
  const [differences, setDifferences] = useState<readonly ContentDifference[]>([]);
  const exportAnchor = useRef<HTMLAnchorElement>(null);
  const dirty = history === null ? false : isDirty(history);

  useEffect(() => {
    void Promise.all([api.bootstrap(), api.authority()])
      .then(([, authorityCatalog]) => {
        setAuthority(authorityCatalog);
        return loadCatalog(catalogKey);
      })
      .catch(showError);
  }, []);

  useEffect(() => {
    setCatalogKey(firstCatalog(module.catalogs));
  }, [moduleId]);

  useEffect(() => {
    if (history === null || !dirty) return;
    const timer = window.setTimeout(() => {
      void api
        .saveDraft(catalogKey, history.present, actor)
        .then(() => {
          setMessage("草稿已自动保存");
        })
        .catch(showError);
    }, 800);
    return () => {
      window.clearTimeout(timer);
    };
  }, [actor, catalogKey, dirty, history?.present]);

  async function loadCatalog(key: string): Promise<void> {
    setMessage(`正在载入 ${key}…`);
    try {
      const next = await api.readCatalog(key);
      setDocument(next);
      setHistory(createHistory(next.data));
      setIssues([]);
      setMessage(`${next.path} 已载入`);
    } catch (error) {
      showError(error);
    }
  }

  function changeCatalog(key: string): void {
    if (dirty && !window.confirm("当前修改尚未写入内容目录，确定切换吗？")) return;
    setCatalogKey(key);
    void loadCatalog(key);
  }

  function showError(error: unknown): void {
    const text = error instanceof Error ? error.message : String(error);
    setMessage(`错误：${text}`);
    const found = /"issues":(\[[\s\S]*?\])/.exec(text)?.[1];
    if (found !== undefined) {
      try {
        setIssues(JSON.parse(found) as ValidationIssue[]);
      } catch {
        setIssues([]);
      }
    }
  }

  async function save(): Promise<void> {
    if (document === null || history === null) return;
    try {
      const next = await api.saveCatalog(document, history.present, actor);
      setDocument(next);
      setHistory(markSaved({ ...history, present: next.data }));
      setMessage("内容目录已原子写入；仍需完整校验后才能发布");
    } catch (error) {
      showError(error);
    }
  }

  async function validate(): Promise<void> {
    try {
      const result = await api.validate();
      setValidation(result);
      setIssues(result.report.issues);
      setMessage(
        result.valid
          ? `校验通过 · ${result.simulation.passed}/${result.simulation.seedCount} 个种子可解`
          : "校验失败，发布被阻止",
      );
    } catch (error) {
      showError(error);
    }
  }

  async function build(): Promise<void> {
    try {
      const result = await api.buildPublication(actor);
      setPublication(result);
      setMessage(`已生成确定性制品 ${result.id.slice(0, 12)}…`);
    } catch (error) {
      showError(error);
    }
  }

  async function stage(): Promise<void> {
    if (publication === null) return;
    try {
      const result = await api.transition(publication.id, "stage", actor);
      setPublication(result);
      setMessage("制品已进入预发布，等待独立审批人");
    } catch (error) {
      showError(error);
    }
  }

  async function compareWithPublication(): Promise<void> {
    if (publication === null) return;
    try {
      const result = await api.readDiff(publication.id);
      setDifferences(result);
      setMessage(result.length === 0 ? "工作区与制品一致" : `发现 ${result.length} 项制品差异`);
    } catch (error) {
      showError(error);
    }
  }

  function exportData(): void {
    if (history === null || exportAnchor.current === null) return;
    const blob = new Blob([`${JSON.stringify(history.present, null, 2)}\n`], {
      type: "application/json",
    });
    exportAnchor.current.href = URL.createObjectURL(blob);
    exportAnchor.current.download = `${catalogKey}-catalog.json`;
    exportAnchor.current.click();
    URL.revokeObjectURL(exportAnchor.current.href);
  }

  const summary = useMemo(() => describeCatalog(history?.present), [history?.present]);

  return (
    <main className="studio-shell">
      <aside className="rail">
        <div className="brand">
          <span className="brand-mark">浮</span>
          <div>
            <strong>内容工作台</strong>
            <small>Project Skyforge</small>
          </div>
        </div>
        <nav aria-label="编辑器模块">
          {EDITOR_MODULES.map((entry) => (
            <button
              className={entry.id === module.id ? "nav-item active" : "nav-item"}
              key={entry.id}
              onClick={() => {
                setModuleId(entry.id);
              }}
            >
              <strong>{entry.title}</strong>
              <small>{entry.subtitle}</small>
            </button>
          ))}
        </nav>
        <div className="rail-note">
          <span className="status-dot" />
          仅连接 127.0.0.1
          <br />
          生产发布需独立审批
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">结构化内容编辑</p>
            <h1>{module.title}</h1>
            <p>{module.subtitle}</p>
          </div>
          <div className="top-actions">
            <label>
              操作者
              <input
                aria-label="操作者"
                value={actor}
                onChange={(event) => {
                  setActor(event.target.value);
                }}
              />
            </label>
            <span className={dirty ? "pill warning" : "pill good"}>
              {dirty ? "有未保存修改" : "已与内容目录同步"}
            </span>
          </div>
        </header>

        <div className="capability-strip" aria-label="模块能力">
          {module.capabilities.map((capability) => (
            <span key={capability}>{capability}</span>
          ))}
        </div>

        <section className="command-bar">
          <label>
            内容目录
            <select
              aria-label="内容目录"
              value={catalogKey}
              onChange={(event) => {
                changeCatalog(event.target.value);
              }}
            >
              {module.catalogs.map((key) => (
                <option key={key}>{key}</option>
              ))}
            </select>
          </label>
          <button
            disabled={history?.past.length === 0}
            onClick={() => {
              setHistory((value) => (value === null ? value : undoHistory(value)));
            }}
          >
            撤销
          </button>
          <button
            disabled={history?.future.length === 0}
            onClick={() => {
              setHistory((value) => (value === null ? value : redoHistory(value)));
            }}
          >
            重做
          </button>
          <label className="file-button">
            导入
            <input
              type="file"
              accept="application/json"
              onChange={(event) => {
                importStructuredFile(event, (value) => {
                  setHistory((current) =>
                    current === null ? createHistory(value) : pushHistory(current, value),
                  );
                });
              }}
            />
          </label>
          <button onClick={exportData}>导出</button>
          <a ref={exportAnchor} hidden />
          <button className="primary" disabled={!dirty} onClick={() => void save()}>
            写入内容
          </button>
          <button className="accent" onClick={() => void validate()}>
            完整校验
          </button>
        </section>

        <div className="work-grid">
          <section className="editor-card">
            <div className="card-heading">
              <div>
                <p className="eyebrow">{catalogKey}</p>
                <h2>{summary.title}</h2>
              </div>
              <span>{summary.count} 项</span>
            </div>
            {history === null ? (
              <div className="loading">正在载入…</div>
            ) : (
              <StructuredEditor
                value={history.present}
                onChange={(value) => {
                  setHistory((current) =>
                    current === null ? createHistory(value) : pushHistory(current, value),
                  );
                }}
              />
            )}
          </section>

          <aside className="inspector">
            <section className="panel">
              <p className="eyebrow">校验与模拟</p>
              <h2>{validation?.valid === true ? "可生成制品" : "尚未通过门禁"}</h2>
              <p>{message}</p>
              {validation !== null && (
                <dl>
                  <div>
                    <dt>制品哈希</dt>
                    <dd>{validation.artifactHash.slice(0, 12)}…</dd>
                  </div>
                  <div>
                    <dt>批量种子</dt>
                    <dd>
                      {validation.simulation.passed}/{validation.simulation.seedCount}
                    </dd>
                  </div>
                </dl>
              )}
            </section>
            <section className="panel issues">
              <div className="panel-title">
                <h3>字段问题</h3>
                <span>{issues.length}</span>
              </div>
              {issues.length === 0 ? (
                <p className="muted">当前没有错误。完整引用与可解性仍以“完整校验”为准。</p>
              ) : (
                <ol>
                  {issues.slice(0, 20).map((issue) => (
                    <li key={`${issue.code}:${issue.path}`}>
                      <strong>{issue.path}</strong>
                      <span>
                        {issue.code} · {issue.message}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
            <section className="panel publish">
              <p className="eyebrow">显式发布流</p>
              <h3>制品 → 预发布 → 审批 → 签名 → 生产</h3>
              <p className="muted">
                工作台只能生成和送审；独立管理员在管理后台完成审批、签名与双重确认。
              </p>
              <button disabled={dirty} onClick={() => void build()}>
                生成确定性制品
              </button>
              <button disabled={publication?.state !== "validated"} onClick={() => void stage()}>
                送入预发布
              </button>
              <button disabled={publication === null} onClick={() => void compareWithPublication()}>
                对比当前制品
              </button>
              {publication !== null && (
                <code>
                  {publication.state} · {publication.id.slice(0, 12)}
                </code>
              )}
              {differences.length > 0 && (
                <ol className="publication-diff" aria-label="制品差异">
                  {differences.slice(0, 20).map((difference) => (
                    <li key={difference.path}>
                      <strong>{difference.path}</strong>
                      <span>{describeDifference(difference)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
            {(module.id === "actors" || module.id === "enemies" || module.id === "daily") && (
              <AuthorityPanel moduleId={module.id} authority={authority} />
            )}
          </aside>
        </div>
      </section>
    </main>
  );
}

function describeCatalog(value: unknown): { readonly title: string; readonly count: number } {
  if (typeof value !== "object" || value === null) return { title: "目录", count: 0 };
  const record = value as Readonly<Record<string, unknown>>;
  const arrays = Object.entries(record).flatMap(([key, entry]) =>
    Array.isArray(entry) ? [[key, entry] as const] : [],
  );
  const primary = arrays[0];
  return primary === undefined
    ? { title: "配置字段", count: Object.keys(record).length }
    : { title: primary[0], count: primary[1].length };
}

function firstCatalog(catalogs: readonly string[]): string {
  const first = catalogs[0];
  if (first === undefined) throw new Error("editor module has no catalogs");
  return first;
}

function AuthorityPanel({
  moduleId,
  authority,
}: {
  readonly moduleId: string;
  readonly authority: AuthorityCatalog | null;
}): React.JSX.Element {
  const records =
    moduleId === "actors"
      ? authority?.modules
      : {
          ...(authority?.ai.enemies ?? {}),
          ...(authority?.ai.eliteAffixes ?? {}),
          ...(authority?.ai.bosses ?? {}),
        };
  const entries = Object.entries(records ?? {}).slice(0, 8);
  return (
    <section className="panel authority-panel">
      <p className="eyebrow">共享战斗权威</p>
      <h3>参数与合法组合</h3>
      <p className="muted">
        能源、冷却、目标类型、状态效果、AI
        权重和词缀组合直接读取确定性内核，避免内容副本与实际规则漂移。
      </p>
      <ul>
        {entries.map(([id, definition]) => (
          <li key={id}>
            <strong>{id}</strong>
            <span>{summarizeAuthority(definition)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function summarizeAuthority(value: unknown): string {
  if (typeof value !== "object" || value === null) return formatAuthorityValue(value);
  const record = value as Readonly<Record<string, unknown>>;
  return (
    ["energyCost", "cooldownTurns", "targetMode", "goal", "difficulty"]
      .flatMap((key) =>
        record[key] === undefined ? [] : [`${key}: ${formatAuthorityValue(record[key])}`],
      )
      .join(" · ") || `${Object.keys(record).length} 个规则字段`
  );
}

function formatAuthorityValue(value: unknown): string {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return value === null ? "null" : "structured";
}

function describeDifference(difference: ContentDifference): string {
  if (difference.before === undefined) return "新增";
  if (difference.after === undefined) return "移除";
  return "修改";
}

function selectEditorModule(moduleId: string): EditorModule {
  const selected = EDITOR_MODULES.find((entry) => entry.id === moduleId) ?? EDITOR_MODULES[0];
  if (selected === undefined) throw new Error("editor module registry is empty");
  return selected;
}
