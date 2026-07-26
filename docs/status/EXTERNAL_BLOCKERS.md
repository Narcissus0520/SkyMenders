# External Blockers

Last reviewed on 2026-07-25. Engineering release controls, content
freeze/rollback, save migration, account/save/daily/content/admin surfaces and
an isolated CI restore drill are implemented, but real WeChat credentials,
deployed infrastructure, final licensed assets, legal approval and device
evidence remain unsatisfied strict release gates.

These inputs cannot be fabricated or bypassed. Interfaces, local substitutes, validation, and integration documentation will be implemented in the relevant phase, but the external capability will not be reported as complete until verified.

| ID      | Owner                           | Required input                                                                                   | Completion evidence                                                                                   | Blocking phase   |
| ------- | ------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- | ---------------- |
| EXT-001 | Product owner                   | WeChat Mini Game AppID and verified operating entity                                             | Credentials installed through secret store; platform login test passes without client secret exposure | 5, 7, 11         |
| EXT-002 | Product owner / infrastructure  | Production domain, TLS, PostgreSQL, Redis, object storage, queue, monitoring, backup target      | Staging/production environment review and recovery evidence                                           | 7, 8, 10, 11     |
| EXT-003 | Qualified legal/publishing team | Current publishing, ISBN/approval/filing, anti-addiction, privacy, age-rating, and entity review | Signed review checklist and required platform/authority approvals                                     | 10, 11           |
| EXT-004 | Qualified trademark counsel     | China trademark and WeChat/platform similarity search for the public name                        | Dated search record and professional risk decision                                                    | 10, 11           |
| EXT-005 | Art/audio owner                 | Original or commercially authorized final art, fonts, music, and sound effects with source files | Complete provenance registry and release audit approval                                               | 10, 11           |
| EXT-006 | QA owner                        | Supported real-device matrix and WeChat Developer Tools access                                   | Signed device, performance, network, resume, and package-size report                                  | 5, 10, 11        |
| EXT-007 | Repository administrator        | Any mandatory human review required by branch protection                                         | Required GitHub review recorded and PR merged without bypass                                          | Any protected PR |

Local progress on 2026-07-25 does not close these blockers: Cocos Creator
successfully built a simulator package with a non-production test AppID and
WeChat Developer Tools login, import, compile and landscape simulator startup
were confirmed, but no product-owned AppID, verified operating entity, upload,
physical-device report or current official package-limit record was supplied.

Docker Desktop and the local state services are now available. Production
infrastructure, routed monitoring, backup target and production recovery
evidence remain external under `EXT-002`.
