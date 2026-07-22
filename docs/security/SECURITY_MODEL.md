# Security Model

Trust boundaries are platform login, client/API, admin/API, content publication, replay submission, data stores, queue workers, CI, and release artifacts. The client is untrusted for identity, time, attempts, RNG, score, commands outside legal state, and final results.

Phase 7 implements server-side WeChat code exchange, HMAC-SHA-256 pseudonymous platform subjects, UUIDv7 internal identities, 15-minute access tokens, hashed 30-day rotating refresh tokens, session revocation, strict DTO validation, authorization, security headers, rate limits, 512 KiB request limits, idempotency, non-sensitive API errors, pseudonymous export, and hard account deletion. Raw OpenID, UnionID, session keys, WeChat secrets, and refresh-token hashes are not client-visible fields.

The client stores only the rotating refresh credential needed to restore a session; access tokens remain in memory. The WeChat AppSecret and the HMAC/JWT secrets exist only in server environment configuration. CI scans owned source for committed credential material.

Phase 8 implements server-business-date challenge definitions, PostgreSQL-enforced formal slots, idempotent attempt transitions, bounded replay envelopes, asynchronous trusted verification, server-generated enemy actions, server-recomputed scores, and verified-only leaderboard writes. Public ranking DTOs are allowlisted to generated system code, original robot avatar ID, score, time, turns, status, and rank. Redis transports replay identifiers and caches public pages but cannot authorize attempts or create durable results.

Phase 9 adds admin separation and immutable audit writes. Production secret-store, TLS, network segmentation, Redis/PostgreSQL hardening, monitoring, deletion evidence, and recovery drills remain deployment gates rather than local-test claims.
