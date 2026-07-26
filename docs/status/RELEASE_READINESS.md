# Release Readiness

Last reviewed on 2026-07-26.

`pnpm release:check` is the engineering readiness gate and is mandatory in Build CI. `pnpm release:gate` is the fail-closed release-candidate gate. The source of truth is `config/release/release-evidence.json`; prose cannot override it.

| Gate                                           | Automated control                                                   | Current state                                                          |
| ---------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Full regression and deterministic performance  | Repository quality, integration and E2E workflows                   | Passed locally and in Phase 11 PR #12                                  |
| Frozen V1 content                              | Catalog SHA-256 lock and strict V1 count validation                 | Passed locally for content `0.2.0` / rules `0.6.0`                     |
| Save migration and content rollback            | Serialized legacy corpus and isolated rollback/freeze drills        | Passed locally                                                         |
| Candidate identity and submission materials    | RC version/commit binding plus checked-in submission draft          | Engineering control passed; no actual candidate declared               |
| No open P0/P1                                  | Release preflight parses `KNOWN_ISSUES.md`                          | Passed; `PKG-001` is closed with compiled-package evidence             |
| Original/licensed assets and fonts             | Registry v2 plus `assets:audit`                                     | Blocked: `EXT-005`; release directory contains no final media          |
| Complete music/SFX and accessible alternatives | Audio catalog plus runtime critical-cue validation                  | Blocked: `EXT-005`; required cue slots intentionally have no asset IDs |
| Real WeChat package and current limits         | Compiled-package analyzer plus dated official evidence              | Internal compiled budget passes; blocked by `EXT-001` and `EXT-006`    |
| Supported device matrix                        | Signed device report                                                | Blocked: `EXT-006`                                                     |
| Privacy, publishing, rating and legal          | Data/SDK inventories, drafts and signed checklist                   | Blocked: `EXT-003`                                                     |
| Restorable production backup                   | CI restore drill plus dated production drill                        | CI mechanism present; production evidence blocked by `EXT-002`         |
| Production operations                          | Health, metrics, alert matrix, runbook and routed staging rehearsal | Engineering contract present; deployment blocked by `EXT-002`          |
| Public name                                    | Dated trademark and platform similarity decision                    | Blocked: `EXT-004`                                                     |
| Operating identity                             | Verified entity, AppID and server-side secret installation          | Blocked: `EXT-001`                                                     |

The strict release gate must also bind a candidate semantic version and 40-character commit. It is correct for that command to fail now. No current branch, CI result or local substitute authorizes production deployment, WeChat submission or a public V1 claim.
