# Security Model

Trust boundaries are platform login, client/API, admin/API, content publication, replay submission, data stores, queue workers, CI, and release artifacts. The client is untrusted for identity, time, attempts, RNG, score, commands outside legal state, and final results.

Controls include server-side platform exchange, HMAC pseudonymous platform subjects, short access tokens, hashed rotating refresh tokens, DTO validation, authorization, rate limits, idempotency, request limits, redacted structured logs, admin separation, immutable audit records, replay verification, secret stores, dependency/SAST/license/SBOM gates, and complete privacy deletion. Exact controls land with the owning phase and must have tests.
