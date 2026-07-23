# Alert Matrix

Status: thresholds and ownership are defined for Phase 10; routing endpoints and production baseline tuning remain blocked by `EXT-002`.

| Signal                               | Warning                    | Critical                                                 | Initial action                                                               | Owner                |
| ------------------------------------ | -------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------- | -------------------- |
| API ready probe                      | One failure for 2 minutes  | Failure for 5 minutes or multi-instance loss             | Check PostgreSQL, Redis, queue and recent deployment; stop rollout           | API on-call          |
| HTTP 5xx ratio                       | Over 1% for 10 minutes     | Over 5% for 5 minutes                                    | Correlate request/trace IDs, isolate route/release, rollback if causal       | API on-call          |
| API p95 latency                      | Over 300 ms for 15 minutes | Over 1 s for 5 minutes                                   | Check dependency latency, saturation and slow queries                        | API on-call          |
| Replay queue oldest age              | Over 60 seconds            | Over 5 minutes                                           | Check worker readiness, Redis, retry/dead-letter counts and replay cost      | Worker on-call       |
| Replay verification rejection change | Twofold baseline shift     | Sustained fivefold shift or trusted-path failures        | Quarantine affected content/client version and inspect anonymous risk events | Game integrity owner |
| Database connections/storage         | 70% capacity               | 85% capacity                                             | Reduce nonessential load, inspect leaks/growth, scale through change control | Data owner           |
| Backup freshness/WAL continuity      | Missed expected interval   | RPO exposure or failed restore drill                     | Protect current state, repair pipeline, perform isolation restore            | Data owner           |
| Content signature/publication        | Validation/signing retry   | Hash/signature mismatch or unauthorized state transition | Freeze publication, retain audit chain and roll back immutable manifest      | Content owner        |
| Account deletion backlog             | Oldest over 12 hours       | Any request over approved deadline                       | Inspect worker/repository failure without exposing account identifiers       | Privacy owner        |
| Client crash/startup/30 FPS          | Baseline regression        | Supported device cannot start or sustain minimum         | Halt rollout, segment by client/device class, reproduce from signed build    | Client owner         |

Alerts must contain service, environment, release, UTC timestamp, aggregate signal and trace/request links, never OpenID, login code, token, save body or secret. Warning pages the business-hours owner unless correlated impact requires escalation; critical pages the on-call immediately. Every critical alert receives a timeline, impact, mitigation, evidence links and follow-up owner.
