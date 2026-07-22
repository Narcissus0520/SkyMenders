# Phase 7 Report: Accounts, Cloud Saves, and Recovery

## Delivered

- A NestJS 11 modular-monolith API on Fastify with security headers, rate limits, bounded bodies, stable errors, bearer authorization, OpenAPI, and liveness.
- Server-side WeChat code exchange, HMAC-pseudonymous platform subjects, UUIDv7 accounts/sessions, generated system codes, short access tokens, hashed rotating refresh tokens, logout, and session revocation.
- Profiles, accessibility/settings synchronization, unlock and achievement reads, account progress merging, expedition save upload/read/delete, and explicit save conflict resolution.
- Prisma 7 PostgreSQL schema and an initial empty-database migration for account, session, profile, progress, save, recovery, privacy, and idempotency records.
- Atomic expedition revision compare-and-swap with same-transaction recovery archival; concurrent writes from one base revision cannot silently overwrite each other.
- Save schema `0.1.0`, integrity sealing, `0.0.1` migration, turn-start then node-start recovery, one restart per node, and compatibility checks.
- Client-side login/session management, a two-slot local save journal, offline queueing, stable-key retries with bounded exponential backoff, summary-only conflicts, and explicit local/cloud choice.
- Synchronous pseudonymous data export and executable hard account deletion. Token hashes and platform identifiers are excluded from export responses.
- A PostgreSQL service workflow that applies the real migration and runs HTTP plus database integration tests on CI.

## Compatibility

| Dimension            | Change         | Reason                                      |
| -------------------- | -------------- | ------------------------------------------- |
| `clientVersion`      | 0.2.0 -> 0.3.0 | Login, local journal, and cloud sync client |
| `protocolVersion`    | 0.2.0 -> 0.3.0 | Account, session, profile, and save DTOs    |
| `saveSchemaVersion`  | 0.0.0 -> 0.1.0 | First durable account/expedition documents  |
| `serverVersion`      | 0.0.0 -> 0.1.0 | First game API and database migration       |
| content/rules/replay | unchanged      | No authored content or battle rule change   |

## Acceptance evidence

- Weak-network tests preserve a locally sealed save across offline state, process reconstruction, two failed uploads, exponential retry, and eventual authoritative replacement.
- Interrupted local writes fall back from a corrupt active slot to the previous verified slot.
- Recovery tests prefer the latest valid turn boundary, reject corruption, fall back to node start, and finally retain the expedition boundary.
- Concurrent cloud uploads from one revision produce one success and one `SAVE_CONFLICT`; API conflict details contain summaries rather than expedition JSON.
- Account export omits raw platform identity and refresh hashes. Account deletion revokes the active session and removes the account-owned record graph.
- Protocol coverage: 98.55% statements / 92.85% branches / 100% functions / 98.52% lines.
- Save migration coverage: 100% statements / 95.65% branches / 100% functions / 100% lines.
- Security coverage: 94.44% statements / 92.59% branches / 100% functions / 94.11% lines.
- Game client coverage: 94.93% statements / 86.33% branches / 91.20% functions / 96.55% lines.
- Game server coverage, excluding generated Prisma output and the separately integration-tested database adapter: 94.92% statements / 77.85% branches / 98.18% functions / 96.82% lines.
- Full repository unit/in-memory integration run: 336 passed; the real PostgreSQL adapter test is skipped locally because Docker is unavailable and is mandatory in Server Integration CI.

## External evidence still required

- A real WeChat AppID/AppSecret exchange through the production secret store.
- Production/staging domain, TLS, PostgreSQL, monitoring, backup target, and recovery exercise.
- WeChat Developer Tools and supported-device weak-network/resume evidence.

No production deployment, real platform login, device result, or release-readiness claim is made by this phase.
