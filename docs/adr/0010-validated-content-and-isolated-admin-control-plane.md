# ADR 0010: Validated content and isolated admin control plane

- Status: Accepted
- Date: 2026-07-23

## Context

The complete PvE catalog must be maintainable without hand-editing JSON, while production content and administrative writes remain reviewable, reversible, and isolated from player authentication. A browser editor must not become a path that can write unchecked data directly to production.

## Decision

Use four explicit boundaries:

1. `content-pipeline` parses every catalog, validates schemas and references, runs authored-map checks and deterministic route simulations, computes catalog and artifact SHA-256 hashes, produces bounded structural diffs, and owns the allowed publication state machine.
2. `content-gateway` is loopback-only. It exposes an allow-listed catalog API, revision compare-and-swap, atomic file replacement, draft autosave, deterministic packaging, staging, two-person approval, signing, rollback, freeze, and an append-only local audit trail. It never accepts an arbitrary repository path.
3. `content-studio` uses structured fields and specialized map, route, actor/module, AI, event/tutorial, and daily-challenge workspaces. It supports undo/redo, dirty state, draft autosave, import/export, diff access, field-specific errors, simulation, and explicit packaging/staging. It cannot bypass validation.
4. `game-server` owns production delivery and administration. Player and administrator JWTs have different secrets, issuers, audiences, sessions, guards, and repositories. Production content follows staged, approved, signed, published, frozen, or rolled-back states. Every administrative write requires a reason, risky actions require an exact second confirmation, and writes append a linked SHA-256 audit record.

The admin browser keeps its short-lived token only in memory. It does not display raw platform identity and cannot use player authentication.

## Consequences

- Invalid schemas, references, localization, maps, or batch simulations cannot create a publishable artifact.
- Source editing, staging, review, signing, production publication, freeze, and rollback remain distinguishable events.
- Content artifacts are immutable and addressable by hash and content version.
- Admin operations remain auditable in both in-memory tests and PostgreSQL production persistence.
- Real production credentials, human approval policy, deployment targets, and final compliance approval remain external release gates.
