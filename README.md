# SkyMenders

SkyMenders is an original landscape 2D turn-based engineering tactics roguelite for WeChat Mini Game. This repository is the product monorepo; it is not a gameplay demo. Product boundaries, compliance requirements, phase gates, and the Definition of Done are governed by `AGENTS.md`.

The public product name is not final. “SkyMenders”, “Project Skyforge”, and “浮岛工坊” are working identifiers until trademark and platform similarity reviews are complete.

## Prerequisites

- Node.js 24 LTS
- pnpm 10
- Git and GitHub CLI
- Docker Desktop or a compatible Docker Engine with Compose v2
- Cocos Creator 3.8.8 for the client build

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
pnpm test:performance
pnpm test:e2e
pnpm content:validate
pnpm assets:audit
pnpm package:budget
pnpm content:freeze:check
pnpm save:migration:drill
pnpm content:rollback:drill
pnpm release:check
pnpm security:secrets
pnpm security:audit
pnpm security:sbom
pnpm build
pnpm cocos:check
```

`pnpm release:gate` is stricter than ordinary CI and must fail until a real immutable candidate has approved media, current official package-limit evidence, device results, production recovery/operations evidence and qualified compliance approval. To exercise PostgreSQL disaster-recovery mechanics against a dedicated safe target, set `DATABASE_URL` and an isolated `RESTORE_DATABASE_URL` ending in `_restore_drill`, then run `pnpm backup:drill`.

For an authorized local WeChat build, set untracked `COCOS_CREATOR_PATH` and `WECHAT_MINIGAME_APP_ID`, then run `pnpm cocos:build:wechat`. Service integration and Web E2E gates are added with their applications. Docker services bind to loopback by default. The optional observability profile starts with `docker compose --profile observability up -d`.

## Repository boundaries

- `packages/` contains engine-independent domain logic and shared contracts.
- `apps/` contains the Cocos client, NestJS server/worker, and React tools as their phases land.
- `content/` contains validated, versioned product content.
- `assets/release/` is release-gated by the provenance registry.
- `tools/` contains executable validation, build, replay, balance, and audit tooling.
- `docs/status/` is the source of truth for current phase state and external blockers.

## Current status

Phases 0-11 are merged. Phase 11 freezes content `0.2.0` / rules `0.6.0`, enforces the full V1 content inventory, and adds executable save-migration and content-rollback drills plus immutable candidate identity checks. Real WeChat, deployed infrastructure, approved final assets, legal review, and device evidence remain explicitly external; no RC is declared, and the Phase 12 PvP gate remains closed. Run `pnpm release:check` with the ordinary quality suite for current engineering evidence. See `docs/status/PROJECT_STATUS.md` for exact status.
