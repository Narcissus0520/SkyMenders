# System Overview

SkyMenders is a pnpm/Turborepo monorepo with four architectural planes:

1. **Authoritative domain** — deterministic runtime, terrain, battle, AI, content runtime, protocol, saves, security, and telemetry packages. These packages are engine-independent and versioned by compatibility dimension.
2. **Applications** — Cocos client, NestJS modular monolith, replay/content worker, React Content Studio, local-only Content Gateway, and React Admin Console.
3. **Data and content** — PostgreSQL transactional state, Redis cache/queues/atomic attempt counters, object storage for versioned artifacts, validated repository content, and audited assets.
4. **Operations** — Compose development dependencies, CI gates, structured observability, backups, content/code rollback, and future Kubernetes boundaries.

The client submits commands, not authoritative outcomes. PvE can execute locally for responsiveness, but replay verification and daily scoring re-run the same versioned domain rules on the server/worker. Future PvP runs those rules authoritatively on server battle workers.

Phase 0 establishes repository and policy boundaries. Detailed deterministic battle, terrain, save/replay, server, content, and PvP architecture documents are completed with their implementing phases.
