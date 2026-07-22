# Server Modules

Status: Phase 7 account/profile/save/privacy, Phase 8 challenge/replay/leaderboard, and Phase 9 content-delivery/admin/audit boundaries are implemented.

The NestJS 11 Fastify application is a modular monolith. Player auth, profiles, saves, privacy, daily challenge, attempt, replay submission, leaderboard, immutable content delivery, isolated admin auth, content lifecycle, operational controls, audit, and health are implemented boundaries. A separate BullMQ Worker owns replay execution while sharing repository contracts and deterministic domain packages. Tables are not cross-module APIs.

`GameRepository` is the application persistence boundary. Production uses the Prisma PostgreSQL adapter; tests use an in-memory adapter against the same services and controllers. Prisma-generated source is build output and is not committed. The checked-in migration is the database source of truth.

Authentication exchanges a WeChat code on the server, pseudonymizes OpenID with a keyed HMAC, and returns only internal account/session credentials. Access-token claims contain account and revocable session IDs. The guard verifies both token signature/expiry and current session state.

All external bodies use shared Zod schemas. Protected writes require authorization and, where replay is meaningful, an idempotency key. Expedition saves additionally use database compare-and-swap, because idempotency alone does not prevent two distinct devices from racing on one revision. Fastify enforces a 512 KiB body limit, global rate limits, and security headers. Unexpected failures are logged server-side while clients receive a stable non-sensitive error envelope.

Administrator tokens use a distinct secret, issuer, audience, 15-minute session, guard, and PostgreSQL tables. They cannot authenticate a player route, and a player token cannot authenticate an admin route. The Admin Console retains the token only in JavaScript memory. Content approval, signing, publication, freeze, rollback, announcements, risk switches, score quarantine, system-code reset requests, and deletion-processing requests require role checks and append a linked audit hash. Risky writes also require an exact target-bound confirmation phrase.

Phase 7 endpoints are:

- `POST /v1/auth/wechat`, `/refresh`, and `/logout`;
- `GET/PATCH /v1/profile`, plus unlock and achievement reads;
- `GET/PUT/DELETE /v1/saves/expedition` and `POST /v1/saves/resolve-conflict`;
- `GET/PUT /v1/saves/progress`;
- `POST /v1/privacy/export`, `DELETE /v1/privacy/account`, and privacy-request status;
- `GET /health/live`, `/openapi.json`, and `/docs`.

Phase 8-9 additions are:

- daily challenge, attempt, replay-submission, and anonymous leaderboard routes;
- `GET /v1/content/manifest` and `GET /v1/content/versions/:version`;
- separate `POST /v1/admin/auth/session`;
- admin overview, content lifecycle, daily preview, audit, announcement, risk-switch, quarantine, system-code-reset, and deletion-processing routes.
