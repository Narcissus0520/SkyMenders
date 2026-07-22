# Project Status

## Snapshot

- Date: 2026-07-22
- Current phase: Phase 4 — AI, enemies, elites, and bosses
- Phase state: local full Gate passed; publication and remote CI pending
- Branch: `codex/phase-04-ai-enemies-bosses`
- Baseline: Phase 3 squash commit `60bbc54` on `main`
- Phase 0 delivery: PR #1 merged after all required GitHub checks passed
- Phase 1 delivery: PR #2 merged after all required GitHub checks passed
- Phase 2 delivery: PR #3 merged after all required GitHub checks passed
- Phase 3 delivery: PR #4 merged after all required GitHub checks passed
- Next phase: Phase 5 — Cocos client and WeChat presentation shell

## Version matrix

| Dimension           | Version |
| ------------------- | ------- |
| clientVersion       | 0.0.0   |
| serverVersion       | 0.0.0   |
| rulesVersion        | 0.4.0   |
| contentVersion      | 0.0.0   |
| saveSchemaVersion   | 0.0.0   |
| replaySchemaVersion | 0.1.0   |
| protocolVersion     | 0.2.0   |
| aiSchemaVersion     | 0.1.0   |

## Phase 4 implementation

- Added `@skymenders/ai-core` with bounded deterministic authority state, independent `ai` and `aim_error` RNG streams, behavior-tree macro goals, nine-dimension utility scoring, stable tie-breaking, complete enemy-phase execution, and serializable debug views.
- AI generates a bounded set of movement, fallback, module, and wait candidates; dry-runs every candidate through `reduceBattleCommand`; scores only legal results; applies seeded aim error; and revalidates the final command through the same reducer.
- Split player and enemy energy into independent canonical pools. Module costs, wait gains, regeneration, validation, and content affordability select the acting team.
- Added normal, hard, and expert profiles that vary search breadth, target breadth, objective/hazard awareness, and deterministic aim error without modifying actor HP or module damage.
- Added all eight required enemy prototype definitions with valid battle loadouts, routes, behavior flags, role preferences, and distinct tested mechanics.
- Added six elite affixes and eight named whitelist templates. Affixes change utility and preferred legal modules without hidden HP/damage multipliers.
- Added four bosses with three deterministic stages each, two counter signals per stage, two complete solution routes, replay-safe command deduplication, and legal post-completion waiting.
- Boss counter progress accepts only runtime-valid effects from an accepted, checkpointed player module command; it cannot be advanced from UI state or an unconfirmed action.
- Added catalog validation to the root content gate, ADR 0005, AI authority architecture, an AI golden decision, a 48-seed phase property suite, boss route tests, difficulty/fairness tests, debug-view tests, and an eight-actor performance benchmark.

## Verification

The final pre-commit repository Gate passed on Node.js 24.14.0 and pnpm 10.31.0:

- Frozen install, format, workspace/infrastructure policy, content/catalog validation, asset audit, secret scan, ESLint, strict TypeScript, and build: passed.
- Full repository tests: 246 passed.
- AI tests: 50 passed; coverage 89.78% statements / 83.60% branches / 97.24% functions / 91.50% lines.
- Battle tests: 79 passed; coverage 96.58% statements / 90.77% branches / 98.08% functions / 98.19% lines.
- Terrain tests: 28 passed; coverage 98.25% statements / 94.96% branches / 100% functions / 98.93% lines.
- Deterministic runtime tests: 35 passed; coverage 99.09% statements / 95.00% branches / 100% functions / 99.06% lines.
- Protocol tests: 27 passed.
- Golden battle final hash: `548962a665215902`; all 13 command checkpoints are pinned.
- Golden AI decision hash: `13f36ad335ed11bf`; selected command, utility trace, error streams, and next authority state are pinned.
- Determinism policy, golden suites, 128 seeded whole rounds, and 48 seeded AI phases: passed.
- AI performance: eight actors, 19 legal decisions, 289.72 ms median / 309.43 ms p95 against the 1,500 ms full-phase budget.
- Terrain performance: 2,200 collapse cells, 2,519 inspected cells, 14.03 ms median / 17.12 ms p95 against the 100 ms budget.
- Official npm high-severity audit: no known vulnerabilities.
- CycloneDX 1.6 SBOM: generated with 225 components.

Commit, GitHub CI, PR, and normal squash merge remain required before Phase 4 is complete.

Docker remains unavailable on this workstation. Phase 0 Build CI validated the Compose model and started, healthchecked, and stopped PostgreSQL, Redis, and MinIO. Phase 4 adds no container-dependent behavior.

## Known limits

- Cocos rendering, aiming/input, camera arbitration, touch feedback, audio, accessibility presentation, WeChat lifecycle adaptation, and device performance are Phase 5 work.
- Route generation, encounter composition, complete expedition content, balance simulation, rewards, events, workshops, unlocks, and tutorials are Phase 6 work.
- AI weights and catalog definitions are deterministic rule defaults, not final authored encounter balance.
- AI debug data is serializable but has no Cocos visualization layer yet.
- Database saves, account integration, replay-verification workers, daily challenges, and leaderboards are later phases.
- No release-quality artwork/audio, final public name, Cocos application, server, worker, or React application is claimed complete.
- External platform, legal, publishing, production infrastructure, asset, and real-device inputs remain tracked in `EXTERNAL_BLOCKERS.md`.
