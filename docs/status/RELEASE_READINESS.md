# Release Readiness

Current conclusion: **not ready for release**. Phases 0-6 are merged and the Phase 7 account/cloud-save scope is locally implemented, but remote CI, real platform login, deployed infrastructure, physical WeChat device evidence, later backend/tooling phases, approved assets, and release operations are not complete.

| Gate                                         | State              | Evidence / next action                                                                  |
| -------------------------------------------- | ------------------ | --------------------------------------------------------------------------------------- |
| Engineering build and CI                     | In progress        | Phases 0-6 merged; Phase 7 local gate passed, PR/CI pending                             |
| Deterministic battle/replay                  | In progress        | Runtime through AI/boss authority exists; server replay verification remains Phase 8    |
| Cocos/WeChat client                          | In progress        | Automated shell and build wrapper exist; EXT-001/006 block real build/device evidence   |
| Complete PvE V1 content                      | In progress        | Phase 6 engineering scope merged; approved assets and final balance remain later gates  |
| Cloud save and privacy deletion              | In progress        | Phase 7 local implementation complete; PostgreSQL CI and real external evidence pending |
| Verified daily leaderboard                   | Not started        | Phase 8                                                                                 |
| Content/admin tooling                        | Not started        | Phase 9                                                                                 |
| Performance, package, backup/recovery        | Not started        | Phases 10-11                                                                            |
| Approved final assets                        | Blocked externally | EXT-005                                                                                 |
| Legal, publishing, privacy, trademark review | Blocked externally | EXT-003, EXT-004                                                                        |

No `v1.0.0` tag, production deployment, WeChat submission, public-release claim, device-performance claim, or finished-art claim is permitted until all applicable Definition of Done items are evidenced.
