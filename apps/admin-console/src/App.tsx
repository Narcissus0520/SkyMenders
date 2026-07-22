import { useEffect, useMemo, useState } from "react";

import { AdminApi } from "./api.js";
import type { AuditEntry, ContentVersion, Overview } from "./api.js";
import { ConfirmAction } from "./ConfirmAction.js";
import { confirmationFor } from "./session.js";

const api = new AdminApi();
const NAVIGATION = [
  ["overview", "总览"],
  ["content", "内容版本"],
  ["daily", "每日挑战"],
  ["leaderboard", "榜单验证"],
  ["accounts", "账户与隐私"],
  ["health", "服务健康"],
  ["compatibility", "兼容矩阵"],
  ["audit", "审计日志"],
  ["announcements", "公告"],
  ["risk", "风险开关"],
] as const;

export function App(): React.JSX.Element {
  const [authenticated, setAuthenticated] = useState(false);
  const [role, setRole] = useState("");
  const [tab, setTab] = useState("overview");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [audit, setAudit] = useState<readonly AuditEntry[]>([]);
  const [daily, setDaily] = useState<unknown>(null);
  const [readiness, setReadiness] = useState("未检查");
  const [message, setMessage] = useState("等待独立管理员认证");

  async function refresh(): Promise<void> {
    try {
      setOverview(await api.overview());
      setMessage("控制面数据已刷新");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  useEffect(() => {
    if (!authenticated) return;
    if (tab === "audit")
      void api
        .audit()
        .then(setAudit)
        .catch((error: unknown) => {
          setMessage(String(error));
        });
    if (tab === "daily")
      void api
        .dailyPreview()
        .then(setDaily)
        .catch((error: unknown) => {
          setMessage(String(error));
        });
    if (tab === "health")
      void api
        .readiness()
        .then((value) => {
          setReadiness(value.status);
        })
        .catch(() => {
          setReadiness("依赖异常");
        });
  }, [authenticated, tab]);

  if (!authenticated)
    return (
      <Login
        onLogin={(nextRole) => {
          setRole(nextRole);
          setAuthenticated(true);
          void refresh();
        }}
        setMessage={setMessage}
        message={message}
      />
    );
  const content = overview?.contentVersions ?? [];
  return (
    <main className="console-shell">
      <aside className="sidebar">
        <div className="brand">
          <span>控</span>
          <div>
            <strong>管理控制台</strong>
            <small>隔离的管理身份</small>
          </div>
        </div>
        <nav>
          {NAVIGATION.map(([id, label]) => (
            <button
              key={id}
              className={tab === id ? "active" : ""}
              onClick={() => {
                setTab(id);
              }}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="identity">
          <span className="online" />
          {role}
          <button
            onClick={() => {
              api.logout();
              setAuthenticated(false);
            }}
          >
            退出短时会话
          </button>
        </div>
      </aside>
      <section className="main-area">
        <header>
          <div>
            <p className="eyebrow">ADMIN CONTROL PLANE</p>
            <h1>{NAVIGATION.find(([id]) => id === tab)?.[1]}</h1>
          </div>
          <div className="message">{message}</div>
        </header>
        {tab === "overview" && <OverviewPanel value={overview} />}
        {tab === "content" && (
          <ContentPanel
            versions={content}
            onAction={async (version, action, reason, confirmation) => {
              await api.contentAction(version.id, action, reason, confirmation);
              await refresh();
            }}
          />
        )}
        {tab === "daily" && <JsonSummary title="今日固定挑战预览" value={daily} />}
        {tab === "leaderboard" && (
          <OperationalPanel
            kind="score_quarantine"
            title="异常成绩隔离"
            placeholder="回放提交 ID"
            onRun={(...args) => api.operationalAction("score_quarantine", ...args)}
          />
        )}
        {tab === "accounts" && (
          <div className="split">
            <OperationalPanel
              kind="system_code_reset"
              title="系统代号重置"
              placeholder="账户 UUID"
              onRun={(...args) => api.operationalAction("system_code_reset", ...args)}
            />
            <OperationalPanel
              kind="deletion_processing"
              title="注销请求处理"
              placeholder="删除请求 UUID"
              onRun={(...args) => api.operationalAction("deletion_processing", ...args)}
            />
          </div>
        )}
        {tab === "health" && (
          <section className="card hero">
            <p className="eyebrow">DEPENDENCY READINESS</p>
            <h2>{readiness}</h2>
            <p>数据库、队列和排行榜缓存必须全部就绪。生产监控与告警配置在运维阶段验收。</p>
          </section>
        )}
        {tab === "compatibility" && <Compatibility versions={overview?.versions ?? {}} />}
        {tab === "audit" && <AuditPanel entries={audit} />}
        {tab === "announcements" && (
          <AnnouncementPanel
            onCreate={async (input) => {
              await api.announcement(input);
              await refresh();
            }}
          />
        )}
        {tab === "risk" && (
          <RiskPanel
            switches={overview?.riskSwitches ?? []}
            onUpdate={async (key, enabled, reason) => {
              await api.riskSwitch(key, enabled, reason);
              await refresh();
            }}
          />
        )}
      </section>
    </main>
  );
}

function Login({
  onLogin,
  setMessage,
  message,
}: {
  readonly onLogin: (role: string) => void;
  readonly setMessage: (value: string) => void;
  readonly message: string;
}): React.JSX.Element {
  const [code, setCode] = useState("release.owner");
  const [token, setToken] = useState("");
  return (
    <main className="login">
      <section>
        <div className="login-mark">浮</div>
        <p className="eyebrow">SKYMENDERS ADMIN</p>
        <h1>独立管理身份验证</h1>
        <p>管理员令牌只保存在当前页面内存中，关闭或刷新页面即失效，不写入浏览器持久存储。</p>
        <label>
          管理员代号
          <input
            aria-label="管理员代号"
            value={code}
            onChange={(event) => {
              setCode(event.target.value);
            }}
            autoComplete="username"
          />
        </label>
        <label>
          一次性引导凭证
          <input
            aria-label="一次性引导凭证"
            type="password"
            value={token}
            onChange={(event) => {
              setToken(event.target.value);
            }}
            autoComplete="current-password"
          />
        </label>
        <button
          className="primary"
          onClick={() => {
            void api
              .login(code, token)
              .then((result) => {
                onLogin(result.role);
              })
              .catch((error: unknown) => {
                setMessage(error instanceof Error ? error.message : String(error));
              });
          }}
        >
          建立 15 分钟会话
        </button>
        <small>{message}</small>
      </section>
    </main>
  );
}

function OverviewPanel({ value }: { readonly value: Overview | null }): React.JSX.Element {
  const metrics = [
    ["内容版本", value?.contentVersions.length ?? 0],
    ["风险开关", value?.riskSwitches.filter((entry) => entry.enabled).length ?? 0],
    ["有效公告", value?.announcements.length ?? 0],
    ["近期操作", value?.recentOperationalActions.length ?? 0],
  ];
  return (
    <>
      <div className="metrics">
        {metrics.map(([label, count]) => (
          <section className="metric" key={label}>
            <span>{label}</span>
            <strong>{count}</strong>
          </section>
        ))}
      </div>
      <section className="card">
        <p className="eyebrow">AVAILABLE MODULES</p>
        <h2>控制面能力</h2>
        <div className="chips">
          {value?.modules.map((module) => (
            <span key={module}>{module}</span>
          ))}
        </div>
      </section>
    </>
  );
}

function ContentPanel({
  versions,
  onAction,
}: {
  readonly versions: readonly ContentVersion[];
  readonly onAction: (
    version: ContentVersion,
    action: "approve" | "sign" | "publish" | "freeze" | "rollback",
    reason: string,
    confirmation: string,
  ) => Promise<void>;
}): React.JSX.Element {
  return (
    <div className="stack">
      {versions.map((version) => (
        <section className="card version" key={version.id}>
          <div>
            <p className="eyebrow">CONTENT {version.contentVersion}</p>
            <h2>{version.state}</h2>
            <code>{version.artifactHash}</code>
          </div>
          <div className="actions">
            {version.state === "staged" && (
              <ConfirmAction
                title="批准"
                description="确认校验证据与差异后批准此制品。"
                expected={`APPROVE CONTENT ${version.id}`}
                onConfirm={(reason, confirmation) =>
                  onAction(version, "approve", reason, confirmation)
                }
              />
            )}
            {version.state === "approved" && (
              <ConfirmAction
                title="签名制品"
                description="使用服务端发布密钥签名已经批准的确定性制品。"
                expected={`SIGN CONTENT ${version.id}`}
                tone="danger"
                onConfirm={(reason, confirmation) =>
                  onAction(version, "sign", reason, confirmation)
                }
              />
            )}
            {version.state === "signed" && (
              <ConfirmAction
                title="发布生产"
                description="该操作改变客户端可见的生产内容。"
                expected={`PUBLISH CONTENT ${version.id}`}
                tone="danger"
                onConfirm={(reason, confirmation) =>
                  onAction(version, "publish", reason, confirmation)
                }
              />
            )}
            {(version.state === "approved" ||
              version.state === "signed" ||
              version.state === "published") && (
              <ConfirmAction
                title="冻结版本"
                description="冻结后拒绝继续变更。"
                expected={`FREEZE CONTENT ${version.id}`}
                tone="danger"
                onConfirm={(reason, confirmation) =>
                  onAction(version, "freeze", reason, confirmation)
                }
              />
            )}
            {version.state === "published" && (
              <ConfirmAction
                title="回滚"
                description="回滚当前生产内容。"
                expected={`ROLLBACK CONTENT ${version.id}`}
                tone="danger"
                onConfirm={(reason, confirmation) =>
                  onAction(version, "rollback", reason, confirmation)
                }
              />
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

function OperationalPanel({
  kind,
  title,
  placeholder,
  onRun,
}: {
  readonly kind: string;
  readonly title: string;
  readonly placeholder: string;
  readonly onRun: (target: string, reason: string, confirmation: string) => Promise<unknown>;
}): React.JSX.Element {
  const [target, setTarget] = useState("");
  return (
    <section className="card operation">
      <p className="eyebrow">AUDITED OPERATION</p>
      <h2>{title}</h2>
      <p>输入目标标识后，还需填写原因并逐字确认。界面不会展示 OpenID、UnionID、昵称或头像。</p>
      <input
        aria-label={`${title}目标`}
        placeholder={placeholder}
        value={target}
        onChange={(event) => {
          setTarget(event.target.value);
        }}
      />
      {target.length > 0 && (
        <ConfirmAction
          title={title}
          description="此操作会写入不可变审计链。"
          expected={confirmationFor(kind, target)}
          tone="danger"
          onConfirm={async (reason, confirmation) => {
            await onRun(target, reason, confirmation);
            setTarget("");
          }}
        />
      )}
    </section>
  );
}

function Compatibility({
  versions,
}: {
  readonly versions: Readonly<Record<string, string>>;
}): React.JSX.Element {
  return (
    <section className="card">
      <p className="eyebrow">COMPATIBILITY MATRIX</p>
      <h2>独立版本维度</h2>
      <table>
        <tbody>
          {Object.entries(versions).map(([key, value]) => (
            <tr key={key}>
              <th>{key}</th>
              <td>{value}</td>
              <td>
                <span className="badge">兼容</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function AuditPanel({ entries }: { readonly entries: readonly AuditEntry[] }): React.JSX.Element {
  return (
    <section className="card">
      <p className="eyebrow">TAMPER-EVIDENT AUDIT</p>
      <h2>管理写操作</h2>
      <table>
        <thead>
          <tr>
            <th>时间</th>
            <th>操作</th>
            <th>目标</th>
            <th>原因</th>
            <th>链哈希</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id}>
              <td>{new Date(entry.createdAt).toLocaleString("zh-CN")}</td>
              <td>{entry.action}</td>
              <td>
                {entry.targetType}:{entry.targetId.slice(0, 12)}
              </td>
              <td>{entry.reason}</td>
              <td>
                <code>{entry.entryHash.slice(0, 10)}…</code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function RiskPanel({
  switches,
  onUpdate,
}: {
  readonly switches: Overview["riskSwitches"];
  readonly onUpdate: (key: string, enabled: boolean, reason: string) => Promise<void>;
}): React.JSX.Element {
  const [key, setKey] = useState("pause_ranked_writes");
  const [reason, setReason] = useState("");
  return (
    <section className="card">
      <p className="eyebrow">RISK CONTROLS</p>
      <h2>风险开关</h2>
      <div className="switch-list">
        {switches.map((entry) => (
          <div key={entry.key}>
            <strong>{entry.key}</strong>
            <span className={entry.enabled ? "badge danger-badge" : "badge"}>
              {entry.enabled ? "启用" : "关闭"}
            </span>
            <small>{entry.reason}</small>
          </div>
        ))}
      </div>
      <div className="form-row">
        <input
          aria-label="风险开关键"
          value={key}
          onChange={(event) => {
            setKey(event.target.value);
          }}
        />
        <input
          aria-label="风险开关原因"
          placeholder="至少 10 个字符的变更原因"
          value={reason}
          onChange={(event) => {
            setReason(event.target.value);
          }}
        />
        <button disabled={reason.length < 10} onClick={() => void onUpdate(key, true, reason)}>
          启用并审计
        </button>
      </div>
    </section>
  );
}

function AnnouncementPanel({
  onCreate,
}: {
  readonly onCreate: (input: Readonly<Record<string, unknown>>) => Promise<void>;
}): React.JSX.Element {
  const [title, setTitle] = useState("announcement.maintenance.title");
  const [body, setBody] = useState("announcement.maintenance.body");
  const [reason, setReason] = useState("");
  const start = useMemo(() => new Date(Date.now() + 3_600_000).toISOString(), []);
  const end = useMemo(() => new Date(Date.now() + 7_200_000).toISOString(), []);
  return (
    <section className="card operation">
      <p className="eyebrow">LOCALIZED ANNOUNCEMENT</p>
      <h2>创建公告</h2>
      <label>
        标题 Key
        <input
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
          }}
        />
      </label>
      <label>
        正文 Key
        <input
          value={body}
          onChange={(event) => {
            setBody(event.target.value);
          }}
        />
      </label>
      <label>
        原因
        <input
          value={reason}
          onChange={(event) => {
            setReason(event.target.value);
          }}
        />
      </label>
      <button
        disabled={reason.length < 10}
        onClick={() =>
          void onCreate({
            titleKey: title,
            bodyKey: body,
            startsAt: start,
            endsAt: end,
            reason,
            confirmation: "CREATE ANNOUNCEMENT",
          })
        }
      >
        确认创建并审计
      </button>
    </section>
  );
}

function JsonSummary({
  title,
  value,
}: {
  readonly title: string;
  readonly value: unknown;
}): React.JSX.Element {
  const entries = typeof value === "object" && value !== null ? Object.entries(value) : [];
  return (
    <section className="card">
      <p className="eyebrow">SERVER AUTHORITY</p>
      <h2>{title}</h2>
      <div className="summary-grid">
        {entries.map(([key, entry]) => (
          <div key={key}>
            <span>{key}</span>
            <strong>
              {typeof entry === "object"
                ? Array.isArray(entry)
                  ? `${entry.length} 项`
                  : "已固定"
                : String(entry)}
            </strong>
          </div>
        ))}
      </div>
    </section>
  );
}
