# ADR 0009: Server-owned daily challenge and replay verification

- Status: Accepted
- Date: 2026-07-22

## Context

Phase 8 must offer unlimited practice and exactly three ranked attempts per account and business day while treating the client as untrusted for date, attempts, random state, enemy decisions, score, and outcome. A replay submission can be large enough that synchronous API verification would make request latency and availability depend on battle duration. Public rankings must remain useful without disclosing WeChat or device identity.

## Decision

1. Derive the business date in the configured server timezone and derive the challenge seed from that date plus a server-only secret. Freeze the squad, module loadout, energy, durability, route, map variants, enemies, events, rewards, difficulty, rules version, and content version in a persisted challenge definition.
2. Form the challenge identity from server business date, rules version, content version, and seed. No challenge API accepts a client date, and changing a device clock cannot select another definition or replenish attempts.
3. Keep practice attempts unlimited and permanently unranked. Allocate formal slots `1..3` with a PostgreSQL uniqueness constraint inside the attempt-start transaction. Starting, checkpointing, finishing, and abandoning use authenticated idempotency keys.
4. Persist only accepted boundary checkpoints for recovery. Abandoning consumes the already allocated formal slot; recovery never creates or refunds a slot.
5. Accept versioned replay envelopes containing the server challenge identity, seed, commands, checkpoint hashes, final hashes, completion summary, and client/replay versions. A finish request stores and queues the submission; it does not trust or publish the claimed score.
6. Use BullMQ over Redis to deliver replay identifiers to a separate Worker. The Worker reloads the challenge, attempt, submission, and authored content from PostgreSQL, reconstructs each initial battle state, creates enemy commands from the server AI, executes the shared deterministic reducer, compares all hashes, and recomputes outcome and score.
7. Score verified results on the server with weights 40% primary completion, 20% optional objectives, 15% remaining state, 10% terrain integrity, 10% turn efficiency, and 5% energy efficiency. Any command, state, route, version, seed, outcome, or score mismatch rejects the submission and creates a pseudonymous risk event.
8. Permit leaderboard writes only from the atomic verified-submission completion path. Keep the account's best result per challenge and order by score descending, completion time ascending, turns ascending, creation time ascending, then entry ID.
9. Return only rank, generated system code, original robot avatar ID, recomputed score, completion time, turn count, and completion status. Never return OpenID, UnionID, WeChat profile fields, device data, or free text.
10. Cursor-paginate leaderboard reads and cache public pages in Redis. A verified best-score update invalidates the challenge cache. Redis is rebuildable acceleration and queue transport; PostgreSQL remains the durable authority.
11. Advance the client and protocol versions to `0.4.0`, the server version to `0.2.0`, and replay schema to `0.2.0`. Rules, content, save, and AI schema versions remain unchanged.

## Alternatives considered

- Trusting a client score plus hash was rejected because logical hashes are drift detectors, not authentication against a hostile client.
- Verifying replays in the API request was rejected because long battles would couple API availability and latency to deterministic simulation work.
- Keeping attempt counts only in Redis was rejected because eviction or failover could refresh scarce ranked attempts.
- Allowing clients to upload enemy actions was rejected because it would let a hostile client choose legal but strategically favorable enemy commands.
- Publishing WeChat nicknames or avatars was rejected because the product does not need those personal fields.

## Consequences

- Ranked results are eventually consistent: finish returns a queued submission, and the leaderboard changes only after trusted verification.
- Redis loss can delay verification and remove cached pages but cannot mint formal slots, change durable results, or lose accepted submissions.
- A rules/content/replay compatibility set must remain available to the Worker for as long as submissions using it can be accepted.
- PostgreSQL and Redis integration tests are mandatory in CI because Docker is unavailable on the current workstation.

## Rollback and compatibility

Rolling back the API or Worker requires pausing new attempt starts and draining or retaining queued submissions. Phase 8 database tables and replay envelopes must not be deleted or silently downgraded. Unsupported replay, rules, content, client, or challenge versions fail closed and remain recorded for audit. Future incompatible replay changes require a new replay schema and a worker compatibility path or an explicit acceptance cutoff.
