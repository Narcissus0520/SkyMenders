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
pnpm security:secrets
pnpm security:audit
pnpm security:sbom
pnpm build
pnpm cocos:check
```

For an authorized local WeChat build, set untracked `COCOS_CREATOR_PATH` and `WECHAT_MINIGAME_APP_ID`, then run `pnpm cocos:build:wechat`. Service integration and Web E2E gates are added with their applications. Docker services bind to loopback by default. The optional observability profile starts with `docker compose --profile observability up -d`.

## Repository boundaries

- `packages/` contains engine-independent domain logic and shared contracts.
- `apps/` contains the Cocos client, NestJS server/worker, and React tools as their phases land.
- `content/` contains validated, versioned product content.
- `assets/release/` is release-gated by the provenance registry.
- `tools/` contains executable validation, build, replay, balance, and audit tooling.
- `docs/status/` is the source of truth for current phase state and external blockers.

## Current status

Phases 0-8 are merged. Phase 9 adds the validated Content Studio/Gateway pipeline, immutable content delivery, isolated Admin Console authentication, signed publication lifecycle, operational controls, and linked audit records. Real WeChat, deployed infrastructure, approved final assets, legal review, and device evidence remain explicitly external. Run `pnpm test`, `pnpm test:e2e`, `pnpm test:coverage`, `pnpm test:determinism`, `pnpm security:secrets`, and `pnpm infra:validate` for current automated evidence. See `docs/status/PROJECT_STATUS.md` for exact status.
