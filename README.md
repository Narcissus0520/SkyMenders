# SkyMenders

SkyMenders is an original landscape 2D turn-based engineering tactics roguelite for WeChat Mini Game. This repository is the product monorepo; it is not a gameplay demo. Product boundaries, compliance requirements, phase gates, and the Definition of Done are governed by `AGENTS.md`.

The public product name is not final. “SkyMenders”, “Project Skyforge”, and “浮岛工坊” are working identifiers until trademark and platform similarity reviews are complete.

## Prerequisites

- Node.js 24 LTS
- pnpm 10
- Git and GitHub CLI
- Docker Desktop or a compatible Docker Engine with Compose v2
- Cocos Creator 3.8 LTS when Phase 5 client work begins

## First setup

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm workspace:check
pnpm infra:validate
pnpm infra:up
```

Copy `.env.example` to an untracked `.env` and replace only local development values. Never place WeChat, production database, content-signing, or session secrets in a committed file.

## Quality gates

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:coverage
pnpm test:determinism
pnpm content:validate
pnpm assets:audit
pnpm security:secrets
pnpm security:audit
pnpm security:sbom
pnpm build
```

Service integration, Web E2E, and Cocos gates are added with the phases that introduce those applications. Docker services bind to loopback by default. The optional observability profile starts with `docker compose --profile observability up -d`.

## Repository boundaries

- `packages/` contains engine-independent domain logic and shared contracts.
- `apps/` contains the Cocos client, NestJS server/worker, and React tools as their phases land.
- `content/` contains validated, versioned product content.
- `assets/release/` is release-gated by the provenance registry.
- `tools/` contains executable validation, build, replay, balance, and audit tooling.
- `docs/status/` is the source of truth for current phase state and external blockers.

## Current status

Phase 0 is establishing governance, build tooling, automated policy checks, CI, Compose infrastructure, documentation, and asset/content gates. See `docs/status/PROJECT_STATUS.md` for current evidence.
