# Phase 9 Report: Content and Administrative Control Plane

## Delivered

- A reusable content-pipeline package that parses the complete catalog, validates schemas, references and localization, validates authored maps, simulates deterministic expedition routes across fixed seeds, computes SHA-256 catalog/artifact hashes, produces bounded diffs, signs artifacts, and rejects invalid publication transitions.
- A loopback-only Fastify Content Gateway with catalog allow-listing, revision compare-and-swap, atomic writes, draft autosave, validation, packaging, staging, two-person approval, signing, explicit confirmation, rollback, freeze, and local audit.
- A React/Vite Content Studio with map, route, robot/module, enemy/AI, event/tutorial and daily-challenge modules; structured fields; deterministic authority inspection; undo/redo; dirty state; autosave; import/export; field-specific errors; validation; simulation; artifact diff; and explicit staging.
- A separate React/Vite Admin Console covering content versions, daily preview, leaderboard quarantine, system-code reset requests, deletion processing, service health, compatibility, audit, announcements, and risk switches.
- Separate administrator authentication with its own secret, issuer, audience, short-lived session and guard. The browser token is memory-only and player authentication is never shared.
- A PostgreSQL migration and in-memory/Prisma adapters for admin users/sessions, content versions, announcements, risk switches, operational actions, and linked audit records.
- A mandatory staged → approved → signed → published lifecycle, plus freeze and rollback. All privileged writes require reasons; dangerous writes require target-bound second confirmation.
- Immutable public content manifest/version endpoints with pipeline-validated embedded content.
- Playwright coverage of valid structured authoring/staging, isolated admin approval with confirmation/audit, and invalid cross-catalog content blocking publication.

## Compatibility

| Dimension                           | Change        | Reason                                                                             |
| ----------------------------------- | ------------- | ---------------------------------------------------------------------------------- |
| `protocolVersion`                   | 0.4.0 → 0.5.0 | Content manifests and separate admin DTOs                                          |
| `serverVersion`                     | 0.2.0 → 0.3.0 | Content delivery, admin authentication, publication and audit APIs                 |
| client/content/rules/save/replay/AI | unchanged     | No player runtime, authored catalog, rule, save, replay or AI compatibility change |

## Security and privacy boundaries

- Content Gateway refuses non-loopback binding and arbitrary paths.
- Production signing secrets remain server-side.
- Admin tokens are neither stored in local/session storage nor reused as player tokens.
- Admin views and responses do not expose OpenID, UnionID, WeChat nickname/avatar, phone, region, or device identity.
- Every admin write is represented by an audit action with actor, target, reason, time, previous hash and entry hash.
- Source editing never directly writes production content.

## Acceptance evidence

- Valid content can be edited through structured fields, saved with optimistic concurrency, validated, deterministically packaged and staged without manual JSON editing.
- Missing localization or invalid references produce field paths and block artifact creation and publication.
- A content author cannot self-approve a gateway artifact; production content cannot skip approval or signature.
- Wrong confirmations, wrong publication states, invalid admin credentials and absent admin tokens are rejected.
- Browser E2E exercises both applications against real HTTP services and a temporary content copy.
- PostgreSQL integration applies the real migration and exercises admin sessions, content transition, risk switch and audit persistence in Server Integration CI.
- Local gates passed with 368 tests, two PostgreSQL-only tests deferred to mandatory CI, all coverage thresholds, three Playwright journeys, deterministic replay/property checks, performance budgets, content/catalog validation, asset provenance, secret scanning, dependency audit, SBOM generation, build, and the static Cocos check.

## External evidence still required

- Production secret-store installation, infrastructure, human reviewer identities and deployment approval remain `EXT-002`/`EXT-007` inputs.
- Final licensed assets, publishing/legal approval, trademark review and device evidence remain Phase 10-11 external gates.
- No production publication, public name approval or platform submission is claimed by this phase.
