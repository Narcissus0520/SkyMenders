# Phase 00: Governance and infrastructure

## 阶段目标

Establish a reproducible Node.js 24 pnpm/Turborepo monorepo, executable governance gates, CI, local infrastructure definition, security/supply-chain controls, asset/content policy, and the required project documentation before authoritative gameplay code begins.

## 主要实现

- Strict TypeScript workspace with a single lockfile and independent product compatibility dimensions.
- Tested workspace, authority-boundary, secret, Compose, content-manifest, asset-provenance, vulnerability, and SBOM gates.
- PostgreSQL, Redis, MinIO, Prometheus, and Grafana Compose definition with loopback bindings, healthchecks, and persistent volumes.
- Eight CI workflow families for quality, determinism, content/assets, security, build/infrastructure, later server integration, later Web E2E, and guarded release candidates.
- Status, architecture, testing, security, operations, legal, contribution, and release-readiness documentation.

## 架构变化

ADR 0001 fixes pnpm/Turborepo as the repository structure and keeps authoritative simulation packages independent from Cocos, wall-clock time, device frame time, and unseeded randomness. Phase 1 will implement fixed math, RNG substreams, canonical state, hashing, snapshots, commands, events, and golden replays behind this boundary.

## 数据库或协议变化

No database schema, user data, network protocol, save, or replay migration is introduced. All compatibility dimensions start at `0.0.0`. Compose provides development dependencies only.

## 安全与隐私影响

No personal information, platform identity, or credential is collected. `.env.example` contains blank or local-only values. Secret scanning covers tracked and untracked repository files. Official npm high-severity audit reports no known vulnerabilities. CI generates a 225-component CycloneDX 1.6 SBOM and production license inventory.

## 测试结果

- Frozen install, format, lint, typecheck, unit tests, coverage, determinism policy, content validation, asset audit, secret scan, vulnerability audit, SBOM generation, and build: passed locally.
- 16 unit tests passed.
- Coverage: shared types 88.88% statements / 85.71% branches; project guard 98.50% / 89.74%; content validator 100% / 83.33%; asset auditor 100% / 85.71%.
- Docker container startup: pending Linux CI because Docker is unavailable on the bootstrap workstation.
- Server integration, Web E2E, database migration, and Cocos build are not Phase 0 capabilities and are path-gated until their owning applications are introduced.

## 性能结果

Tooling gates complete in seconds after installation. Gameplay, device, server-load, terrain, and package performance measurements begin in their implementing phases; none are claimed here.

## 内容与素材检查

The versioned content manifest validates at `0.0.0`. The release asset registry is empty and the audit passes because no release assets exist. No placeholder is represented as final art or audio.

## 已知限制

- No deterministic gameplay implementation exists before Phase 1.
- Docker Desktop is not installed locally; CI is the Phase 0 runtime infrastructure evidence.
- No Cocos, NestJS, worker, Content Studio, or Admin Console application is claimed complete.

## 外部阻塞

WeChat credentials/entity, production infrastructure, publishing/legal/privacy review, trademark review, final authorized assets, device matrix, and any mandatory repository review remain explicitly tracked in `EXTERNAL_BLOCKERS.md`.

## AGENTS.md Gate 检查

- [x] 阶段功能完整
- [x] 核心测试通过
- [x] 确定性策略测试通过
- [x] 内容校验通过
- [x] 资产审计通过
- [x] 文档已更新
- [x] 无秘密泄漏
- [x] 无未经授权素材
- [x] 无 P0/P1 缺陷

Remote CI must be green before normal squash merge.
