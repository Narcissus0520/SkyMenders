# ADR 0008: Pseudonymous accounts and versioned cloud saves

- Status: Accepted
- Date: 2026-07-22

## Context

Phase 7 must add WeChat authentication, cross-device progress, resumable expeditions, conflict handling, and account deletion without placing a platform secret in the client or weakening deterministic recovery. OpenID is a platform identifier and must not become a public account ID, log field, token claim, leaderboard identity, or client-visible response. Expedition branches cannot be merged field-by-field without inventing a history that was never played.

## Decision

1. Exchange the one-use WeChat login code only in the NestJS server. Store `HMAC-SHA-256(openid, SESSION_PEPPER)` as the unique platform subject and never persist or return raw OpenID, session keys, or UnionID.
2. Use UUIDv7 internal account and session IDs, a generated system code, 15-minute signed access tokens, 30-day rotating refresh tokens, hashed refresh-token storage, explicit revocation, rate limits, bounded request bodies, stable error envelopes, and server-only configuration.
3. Keep API DTOs in `@skymenders/protocol` and runtime-validate every external payload. Publish OpenAPI from the same NestJS application. Protected writes require an idempotency key, except account deletion, which revokes and hard-deletes the authenticated account in the same request and therefore cannot be replayed with the deleted credential.
4. Use Prisma 7 with its explicit PostgreSQL driver adapter. The initial migration creates accounts, platform subjects, sessions, profiles, account progress, unlocks, achievements, expedition saves, short-lived recovery archives, privacy requests, and idempotency records.
5. Version account and expedition documents with `saveSchemaVersion`. Expedition saves retain rules/content versions, logical clocks, summaries, RNG-bearing node-start and turn-start snapshots, and an integrity hash. Restoration verifies the save and snapshot before returning state.
6. Write local expedition saves through a two-slot journal. The inactive slot is written and verified before the active pointer changes, allowing an interrupted write to fall back to the previous valid slot.
7. Merge monotonic account discovery and counters by field. Never field-merge an expedition branch. When device and cloud histories diverge, show bounded summaries and require an explicit local/cloud choice.
8. Commit cloud expedition revisions with an atomic compare-and-swap transaction. A superseded or rejected branch is archived for seven days in the same transaction. Concurrent uploads from the same base revision result in exactly one success and one conflict.
9. Enforce one restart per node inside the sealed expedition document. Recovery prefers a valid turn-start snapshot, falls back to node start, then to the expedition boundary without silently deleting the source save.
10. Export pseudonymous account data without token hashes or platform identifiers. Account deletion revokes sessions and uses database cascades to hard-delete account-owned profiles, progress, saves, unlocks, achievements, recovery records, and idempotency records.
11. Advance `clientVersion` to `0.3.0`, `protocolVersion` to `0.3.0`, `saveSchemaVersion` to `0.1.0`, and `serverVersion` to `0.1.0`. Content, rules, replay, and AI schemas remain unchanged.

## Alternatives considered

- Storing raw OpenID was rejected because it expands breach impact and creates an unnecessary personal-data join key.
- Persisting access or refresh tokens in plaintext was rejected because a database read would immediately create active sessions.
- Last-write-wins expedition uploads were rejected because they silently discard a played branch.
- Field-merging expedition JSON was rejected because turn state, RNG streams, rewards, and restart quotas form one causal history.
- A distributed service split was rejected because the current product is better served by a transactional modular monolith.

## Consequences

- The client can operate offline and recover from interrupted writes, but cross-device synchronization requires a reachable server and a valid session.
- Conflict UI receives summaries rather than complete remote save JSON until the player chooses a branch.
- PostgreSQL is the durability authority; the in-memory repository exists only for isolated HTTP tests.
- Real WeChat code exchange, production TLS/database deployment, and device-network evidence remain external gates and are not represented by the fake exchange used in tests.

## Rollback and compatibility

The only supported pre-Phase-7 expedition schema is `0.0.1`, migrated to `0.1.0` without changing played progress. Unknown schemas fail closed and the original payload remains available to the caller. Rolling back the server requires retaining the Phase 7 tables and disabling new writes; it must not downgrade or delete `0.1.0` saves. Future incompatible changes require a new save schema and a tested forward migration.
