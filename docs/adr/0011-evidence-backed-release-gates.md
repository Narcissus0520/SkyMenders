# ADR 0011: Evidence-backed release gates

- Status: Accepted
- Date: 2026-07-23

## Context

SkyMenders can automate source quality, deterministic replay, content validation, provenance structure and isolated recovery, but a public WeChat release also depends on final licensed media, a current platform package inspection, real devices, operating-entity credentials, production infrastructure and qualified legal/trademark decisions. Treating missing external inputs as either a permanent CI failure or a passed checkbox would respectively stop engineering or create a false release claim.

## Decision

Maintain two executable gates over one versioned evidence manifest.

`pnpm release:check` is mandatory engineering CI. It requires a valid and complete gate inventory, existing evidence references, no open P0/P1 issue, known external blocker IDs, a clean release-asset audit and an internal package budget. A gate may remain explicitly blocked by an owner and `EXT-*` record.

`pnpm release:gate` is mandatory for a release candidate. It additionally requires a compiled WeChat package, dated current official package-limit evidence, immutable candidate version/commit, and every gate in `passed` state. External blockers are failures in this mode.

Release assets require source and license evidence, SHA-256 identity, commercial/modification rights, reviewer/date, AI process approval when applicable, reference sources and a non-placeholder state. Database backup acceptance requires an isolated restore and verification; successful export alone is insufficient.

## Consequences

- Ordinary PRs remain testable without fabricating credentials, devices, legal signatures or final media.
- A release cannot be declared by documentation wording alone; the strict command fails until evidence is recorded.
- Platform limits are not frozen as possibly stale policy in code. Internal budgets remain stable engineering targets, while dated official values and their source are supplied for each candidate.
- Evidence owners must update the manifest when a blocker closes, and reviewers can trace each passed state to repository or access-controlled release records.
