# ADR 0001: Monorepo and authoritative simulation boundaries

- Status: Accepted
- Date: 2026-07-22
- Owners: project architecture

## Context

SkyMenders must ship a Cocos WeChat client, deterministic simulation packages, a NestJS modular monolith and worker, React content/admin tools, versioned content, and shared runtime-validated contracts. Battle replay and later server-authoritative PvP require identical rules across client tooling, replay workers, tests, and servers without importing Cocos physics or frame timing.

## Decision

Use a pnpm workspace coordinated by Turborepo. Authoritative domain packages live under `packages/` and cannot import Cocos APIs, wall-clock APIs, device frame time, or unseeded randomness. Applications depend on domain packages through explicit exports. Cross-application DTOs will live in `packages/protocol`; runtime input validation is mandatory. Content and release assets are separately versioned and audited.

Phase 0 enforces the boundary with static repository checks. Phase 1 replaces policy-only enforcement with fixed-point math, seeded RNG substreams, canonical serialization, hashing, snapshots, commands, events, and golden replays.

## Alternatives considered

1. Multiple repositories: rejected because atomic protocol/rule changes and deterministic cross-runtime testing would be harder, while the current team and product do not need independent repository governance.
2. Keep battle logic inside Cocos: rejected because engine physics, frame time, and client authority would make replay verification and future PvP unsafe.
3. Start as many microservices: rejected because it adds deployment and consistency overhead before scale boundaries are known.

## Consequences

The workspace has one lockfile and consistent quality gates. Package interfaces and version dimensions require deliberate maintenance. Cocos presentation and server orchestration may duplicate adapters, but not authoritative rules. CI must test Windows/Linux-compatible core code and reject forbidden authority dependencies.

## Migration and compatibility impact

This initial decision starts all version dimensions at `0.0.0` and does not migrate user data. Incompatible future rule, protocol, replay, content, or save changes require their own version increment and migration/compatibility evidence.

## Rollback

Packages can later be extracted behind their public exports without changing domain behavior. Reverting to engine-owned or client-authoritative simulation is not an acceptable rollback because it violates product security and determinism requirements.
