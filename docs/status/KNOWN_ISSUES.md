# Known Issues

## Open

| ID       | Severity | Area          | Description                                                                                                  | Disposition                                                                                                                    |
| -------- | -------- | ------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| DEV-001  | P2       | Local tooling | Docker CLI is not installed on the current workstation, so Compose containers cannot yet be started locally. | Attempt tool installation during Phase 0; CI and static Compose validation remain required.                                    |
| ART-001  | P2       | Assets        | Release-quality original artwork and audio are not present.                                                  | Tracked as an external release blocker; development placeholders must remain clearly marked and cannot enter `assets/release`. |
| NAME-001 | P2       | Brand         | Public product name has not completed trademark and platform similarity review.                              | Continue using working identifiers internally only.                                                                            |

## Closed

No implementation defects are closed yet. Governance findings are not gameplay completion evidence.

P0 and P1 issues block phase completion and merge. P2 acceptance requires an explicit owner, impact, and release disposition.
