# Server Modules

Status: Phase 7 account/profile/save/privacy foundation implemented; challenge, replay, leaderboard, admin, and audit modules continue in Phases 8-9.

The NestJS 11 Fastify application is a modular monolith. Auth, profiles, saves, privacy, and health are the first implemented boundaries. Challenge, attempt, replay, leaderboard, telemetry, admin, audit, and platform-compliance modules extend the same application later. Tables are not cross-module APIs.

`GameRepository` is the application persistence boundary. Production uses the Prisma PostgreSQL adapter; tests use an in-memory adapter against the same services and controllers. Prisma-generated source is build output and is not committed. The checked-in migration is the database source of truth.

Authentication exchanges a WeChat code on the server, pseudonymizes OpenID with a keyed HMAC, and returns only internal account/session credentials. Access-token claims contain account and revocable session IDs. The guard verifies both token signature/expiry and current session state.

All external bodies use shared Zod schemas. Protected writes require authorization and, where replay is meaningful, an idempotency key. Expedition saves additionally use database compare-and-swap, because idempotency alone does not prevent two distinct devices from racing on one revision. Fastify enforces a 512 KiB body limit, global rate limits, and security headers. Unexpected failures are logged server-side while clients receive a stable non-sensitive error envelope.

Phase 7 endpoints are:

- `POST /v1/auth/wechat`, `/refresh`, and `/logout`;
- `GET/PATCH /v1/profile`, plus unlock and achievement reads;
- `GET/PUT/DELETE /v1/saves/expedition` and `POST /v1/saves/resolve-conflict`;
- `GET/PUT /v1/saves/progress`;
- `POST /v1/privacy/export`, `DELETE /v1/privacy/account`, and privacy-request status;
- `GET /health/live`, `/openapi.json`, and `/docs`.
