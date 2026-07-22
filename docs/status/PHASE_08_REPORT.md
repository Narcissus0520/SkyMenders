# Phase 8 Report: Daily Challenge and Anonymous Leaderboard

## Delivered

- A server-timezone daily definition that freezes the squad, modules, starting resources, route, maps, enemies, events, rewards, difficulty, seed, and independent content/rules versions.
- Unlimited unranked practice plus exactly three formal daily slots enforced atomically in PostgreSQL. Device time is absent from the request contract and cannot select a day or replenish attempts.
- Authenticated, idempotent start, checkpoint, finish, and abandon flows with accepted-boundary recovery. Abandonment consumes the allocated formal slot.
- Replay schema `0.2.0` with challenge/version binding, commands, checkpoints, node and final hashes, completion summary, recovery count, and claimed score as a value to verify rather than trust.
- A separate BullMQ Worker that reconstructs server-owned initial states, generates enemy actions with the deterministic AI, executes the shared battle reducer, verifies every boundary, recomputes the weighted score, and records isolated risk events for mismatches.
- PostgreSQL models and migration for daily definitions, attempts, replay submissions, leaderboard entries, and replay risk events, with account deletion cascades and one best verified result per challenge/account.
- Redis queue transport and rebuildable cursor-page cache with invalidation after a verified best-score update.
- Anonymous public and personal leaderboard endpoints exposing only rank, generated system code, original robot avatar ID, score, completion time, turns, and completion status.
- A validated client API that never submits a date and rejects unsafe leaderboard response shapes.
- Liveness and dependency-aware readiness endpoints for the API and Worker, plus PostgreSQL/Redis integration coverage in the Server Integration workflow.

## Compatibility

| Dimension             | Change         | Reason                                            |
| --------------------- | -------------- | ------------------------------------------------- |
| `clientVersion`       | 0.3.0 -> 0.4.0 | Daily attempt, recovery, and leaderboard client   |
| `protocolVersion`     | 0.3.0 -> 0.4.0 | Challenge, replay, verification, and ranking DTOs |
| `replaySchemaVersion` | 0.1.0 -> 0.2.0 | Trusted daily replay envelope                     |
| `serverVersion`       | 0.1.0 -> 0.2.0 | Daily, leaderboard, queue, cache, and Worker API  |
| content/rules/save/AI | unchanged      | No authored content, battle rule, or save change  |

## Acceptance evidence

- Concurrent formal starts allocate exactly slots 1, 2, and 3; a fourth formal start is rejected, while practice remains unlimited.
- No daily request accepts a client date. Tests show the definition and remaining formal attempts are controlled by server business time.
- Recovery returns the last accepted checkpoint, and repeated start/checkpoint/finish/abandon operations remain idempotent.
- Replay tests reject altered challenge identity, seed, initial state, checkpoint, final state, route, outcome, client-selected enemy command, and claimed score.
- Only an atomically completed, verified formal submission can write a leaderboard entry. Rejected or practice submissions cannot rank.
- Leaderboard tests cover cursor pagination, cache use/invalidation, best-score ordering, and rejection of platform-identity-shaped response fields.
- Protocol coverage: 98.94% statements / 92.85% branches / 100% functions / 98.93% lines.
- Challenge authority coverage: 92.37% statements / 80% branches / 100% functions / 96.23% lines.
- Game server coverage, excluding generated Prisma and separately integration-tested infrastructure adapters: 94.87% statements / 81.13% branches / 96.72% functions / 94.76% lines.
- Worker coverage, excluding the separately executed Redis integration test: 94% statements / 94.44% branches / 93.33% functions / 95.45% lines.
- Full repository unit/in-memory integration run: 354 passed; one real PostgreSQL test is skipped locally and remains mandatory with the real Redis queue test in CI.
- The daily-definition benchmark generates 500 definitions in 2,415.59 ms. The full replay-verification benchmark records p95 10.62 ms against a 100 ms gate.
- The official npm audit has no high or critical advisory after upgrading BullMQ away from the vulnerable transitive `uuid@9.0.1` dependency.

## External evidence still required

- The PostgreSQL migration, three-slot concurrency path, BullMQ Redis delivery, Worker processing, and cache invalidation must pass the required Server Integration CI job.
- Production Redis/PostgreSQL sizing, retry/dead-letter policy, monitoring, backup, and recovery exercises remain Phase 10-11 deployment gates.
- Real WeChat identity, deployed networking, and supported-device recovery evidence remain external blockers.

No production deployment, public leaderboard population, platform review, or release-readiness claim is made by this phase.
