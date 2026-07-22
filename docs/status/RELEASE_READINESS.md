# Release Readiness

Current conclusion: **not ready for release**. Phases 0-7 are merged and the Phase 8 daily/leaderboard scope is locally implemented, but remote CI, real platform login, deployed infrastructure, physical WeChat device evidence, later tooling phases, approved assets, and release operations are not complete.

| Gate                                         | State              | Evidence / next action                                                                 |
| -------------------------------------------- | ------------------ | -------------------------------------------------------------------------------------- |
| Engineering build and CI                     | In progress        | Phases 0-7 merged; Phase 8 local gate passed, PR/CI pending                            |
| Deterministic battle/replay                  | In progress        | Trusted daily replay verification is local; production load/operations remain gated    |
| Cocos/WeChat client                          | In progress        | Automated shell and build wrapper exist; EXT-001/006 block real build/device evidence  |
| Complete PvE V1 content                      | In progress        | Phase 6 engineering scope merged; approved assets and final balance remain later gates |
| Cloud save and privacy deletion              | In progress        | Phase 7 merged; real deployed infrastructure and platform evidence remain pending      |
| Verified daily leaderboard                   | In progress        | Phase 8 local implementation complete; PostgreSQL/Redis CI and operations pending      |
| Content/admin tooling                        | Not started        | Phase 9                                                                                |
| Performance, package, backup/recovery        | Not started        | Phases 10-11                                                                           |
| Approved final assets                        | Blocked externally | EXT-005                                                                                |
| Legal, publishing, privacy, trademark review | Blocked externally | EXT-003, EXT-004                                                                       |

No `v1.0.0` tag, production deployment, WeChat submission, public-release claim, device-performance claim, or finished-art claim is permitted until all applicable Definition of Done items are evidenced.
