# Implementation Plan

This plan follows the mandatory phase order in `AGENTS.md`. A phase is complete only after its code, tests, documentation, local gates, required CI checks, PR, and permitted merge are complete.

| Phase | Scope                                                                   | State                   | Exit evidence                                                   |
| ----- | ----------------------------------------------------------------------- | ----------------------- | --------------------------------------------------------------- |
| 0     | Governance, monorepo, CI, Compose, docs, legal/asset policy             | Complete; PR #1 merged  | Local Gate and all required GitHub checks passed                |
| 1     | Fixed math, RNG streams, commands/events, snapshots, hashes, replay     | Complete; PR #2 merged  | Repeatable replays and isolated RNG streams                     |
| 2     | Chunk terrain, materials, damage/repair, support, collapse, validation  | Complete; PR #3 merged  | Replayable collapse, property tests, benchmark                  |
| 3     | Turn rules, movement, energy, durability, objectives, 18 modules        | Complete; PR #4 merged  | Complete module behavior and combination tests                  |
| 4     | Behavior trees, utility AI, 8 enemies, elites, 4 bosses                 | Complete; PR #5 merged  | Legal commands and multi-strategy boss tests                    |
| 5     | Cocos client, WeChat adapter, input, camera, UI, audio, accessibility   | Complete; PR #6 merged  | Automated gates pass; external device evidence is release-gated |
| 6     | Four-region expedition, rewards, workshop, events, unlocks, 6 tutorials | Complete; PR #7 merged  | Full-length expedition and content minimums                     |
| 7     | Auth adapter, accounts, local/cloud saves, recovery, restart, migration | Complete; PR #8 merged  | Weak-network recovery and deletion flow                         |
| 8     | Daily challenge, attempts, replay worker, anonymous leaderboard         | Complete; PR #9 merged  | Tamper rejection and server-date enforcement                    |
| 9     | Content Studio, gateway, Admin Console, publication and audit           | Complete; PR #10 merged | UI-authored valid content and traceable admin writes            |
| 10    | Approved assets, performance, package budget, operations, legal prep    | Complete; PR #11 merged | Engineering gates pass; external release evidence fails closed  |
| 11    | V1 release candidate, regression, freeze, recovery drills               | Complete; PR #12 merged | Full V1 engineering DoD; explicit external gates remain blocked |
| 12+   | Server-authoritative real-time PvP                                      | Blocked by V1 gate      | PvP gates without breaking V1 replay compatibility              |

## Phase 0 acceptance

- Root workspace and version policy are reproducible on Node 24 and pnpm 10.
- Strict TypeScript, linting, formatting, unit tests, coverage, build, secret scanning, content validation, and asset provenance checks execute locally and in CI.
- Docker Compose defines loopback-only development state services and optional observability, with healthchecks and persistent volumes.
- Required status, architecture, legal, security, operations, and testing documents exist and describe real behavior and limits.
- No credential, personal data, unapproved release asset, mock production integration, or undocumented core placeholder is committed.
- Phase branch is published only after all locally available gates pass; CI must be green before normal squash merge.

Phase 0 met these conditions and was squash-merged through PR #1 as `4a18436`.

Phase 1 met these conditions and was squash-merged through PR #2 as `dec0fd6`.

Phase 2 met these conditions and was squash-merged through PR #3 as `ef3160a`.

Phase 3 met these conditions and was squash-merged through PR #4 as `60bbc54`.

Phase 4 met these conditions and was squash-merged through PR #5 as `8b379497372ce5ed6712761c10513cc11d62a1d7`.

Phase 5 met its automated conditions and was squash-merged through PR #6 as `6c1a70304f0c3e8d61d1ffb708ccee7c39a45fcb`. Its real Creator/device evidence remains correctly tracked under `EXT-001` and `EXT-006` and is not misrepresented as complete release evidence.

Phase 6 met its automated conditions and was squash-merged through PR #7 as `e2d90dee36b761bb67e9cb154cb99101f79d83b5`. Approved release assets and final balance evidence remain later release gates.

Phase 7 met its automated conditions and was squash-merged through PR #8 as `cc4a0cb6fac0806c24d0bbc811477b8b4ea3c636`. Its real WeChat login, deployed infrastructure, and device evidence remain correctly tracked external gates.

Phase 8 met its automated conditions and was squash-merged through PR #9 as `598c8aacd4264ded186e33a8c699738df0a28687` after the required PostgreSQL/Redis integration and all other checks passed.

Phase 9 met its automated conditions and was squash-merged through PR #10 as `e4820770979b4ef218df10d2a9cf856a1ab5ca6f` after content/admin E2E, PostgreSQL/Redis integration, static analysis and all other required checks passed.

Phase 10 met its engineering conditions and was squash-merged through PR #11 as `57366dd308a8d2e2c3fc3656462ccf87c9a8ce7e` after all required checks passed. Approved final media, current official package evidence, production rehearsal, qualified legal approval, public-name clearance and device evidence remain fail-closed external gates.

## Phase 11 acceptance

- The root V1 content minimums are exact executable validations rather than prose-only claims.
- Content `0.2.0` is frozen by catalog path and SHA-256; edits require an intentional lock update and review.
- Content publication rollback targets only the active immutable artifact, then freeze rejects later writes.
- A checked-in legacy save migrates, verifies and resumes without changing played progress or its compatibility dimensions.
- The release workflow rejects an unbound candidate and requires an `x.y.z-rc.n` version plus exact 40-character commit.
- Full local gates and required GitHub checks must pass before merge; no tag or RC may be created while strict external gates remain blocked.

Phase 11 met these engineering conditions and was squash-merged through PR #12 as `d0e8698cd77c12369cf98c5366d6b25980cbd7e8` after all required checks passed. Phase 12+ remains blocked by the V1 gate until the external evidence in `EXTERNAL_BLOCKERS.md` is verified.

## 2026-07-25 private WeChat validation pass

- Installed and verified Cocos Creator 3.8.8, WeChat Developer Tools and Docker
  Desktop; started the local PostgreSQL, Redis and MinIO dependencies.
- Applied all migrations and passed the available integration checks.
- Corrected Cocos portability defects in asset imports, schema initialization
  and the save-migration package boundary.
- Produced a real landscape WeChat Mini Game directory with a non-production
  test AppID.
- Imported the generated directory into the logged-in Developer Tools with a
  sandbox test project and completed the simulator startup smoke check. The
  landscape main menu renders, Settings/Back physical clicks pass, and Standard
  Expedition opens an actual local deterministic battle with terrain, actors,
  aiming, energy, objectives and touch controls.
- Exercised the battle inside the real Developer Tools game context: firing
  consumed four energy and mutated terrain, enemy/environment phases resolved,
  the hold objective progressed once per round, and the third defended round
  produced a deterministic victory.
- Replaced client-shipped array spreads over `Set`, `Map` and generic iterables
  with Cocos-compatible `Array.from` conversions after the generated runtime
  exposed invalid transpilation. Rebuilt successfully and passed 210 focused
  tests across the client, battle, terrain, AI, expedition and save-migration
  packages.
- Separated Cocos `Graphics` into background, terrain and aim child layers so
  the rendered battlefield remains visible instead of being covered by the
  background.
- Improved the private battle touch pass with explicit angle/power plus and
  minus controls, larger invisible hit areas, immediate press scaling,
  visually distinct fire/end/back actions and settings-aware light/medium
  vibration. Restored the Developer Tools simulator from a forced 30% floating
  preview to a detached 100% 844x390 window for direct interaction.
- Enabled the WeChat engine plugin with a pinned minimal 2D module set, narrowed
  client-shipped protocol entry points and removed the disabled Creator default
  splash assets after each build. The real compiled package now contains 27
  files and totals 1,876,241 bytes, so `PKG-001` is closed without increasing
  the 1,887,436-byte internal budget.
- The earlier self-contained package remains the latest successful Developer
  Tools runtime smoke. Cocos requires a developer-opened AppID to exercise
  engine separation, so the optimized plugin runtime remains fail-closed under
  `EXT-001`.
- Next: complete a signed physical-device matrix and capture current
  authoritative platform-limit evidence before any upload or release-candidate
  work.

## Compatibility discipline

Rules, content, save, replay, protocol, client, and server versions remain independent. Phase 1 established `rulesVersion`, `replaySchemaVersion`, and `protocolVersion` at `0.1.0`. Phase 2 advanced only `rulesVersion` to `0.2.0`. Phase 3 advanced `rulesVersion` to `0.3.0` and `protocolVersion` to `0.2.0`. Phase 4 advanced only `rulesVersion` to `0.4.0` and started AI schema `0.1.0`. Phase 5 advanced only `clientVersion` to `0.1.0`. Phase 6 advanced content to `0.1.0`, expedition rules to `0.5.0`, and the PvE client flow to `0.2.0`. Phase 7 advanced client and protocol to `0.3.0` and started save and server schemas at `0.1.0`. Phase 8 advanced client and protocol to `0.4.0`, server to `0.2.0`, and replay schema to `0.2.0`. Phase 9 advanced only protocol to `0.5.0` and server to `0.3.0`. Phase 10 advanced client to `0.5.0` for release/legal navigation and server to `0.4.0` for observability. Phase 11 advances content to `0.2.0` and expedition rules to `0.6.0`; the retained `0.1.0` / `0.5.0` save pair is exercised by an explicit migration corpus and allow-list. Later incompatible changes must increment only affected dimensions and include migrations or compatibility evidence.
