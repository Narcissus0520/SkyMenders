# Server Modules

Status: planned for Phase 7–9.

The NestJS 11 Fastify application is a modular monolith. Auth, accounts, profiles, unlocks, saves, expeditions, content, challenges, attempts, replays, leaderboards, telemetry, privacy, admin, health, audit, and platform-compliance modules communicate through explicit services or domain events. Tables are not cross-module APIs. External input uses shared runtime schemas; writes use idempotency, authorization, rate limits, stable errors, and audit where required.
