# ADR 0012: Release content freeze and legacy resume

- Status: Accepted
- Date: 2026-07-23

## Context

The original Phase 6 pack met its then-schema but did not meet the root V1 content minimums: multi-purpose maps were counted across encounter classes, and events, hidden goals, workshop choices, environment mechanics, and cosmetics were below the mandatory scale. Correcting the pack adds content without removing existing IDs, while encounter map selection must become type-aware.

## Decision

Content advances to `0.2.0` and rules to `0.6.0`. Each battle, engineering, elite, or Boss map has exactly one encounter class; route generation selects only a compatible map. The schema enforces 24 battle, 12 engineering, 8 elite and 4 Boss maps, 30 events, 8 workshop services, 8 environment mechanics, 20 hidden objectives, and 12 cosmetics.

The release content tree is locked by a deterministic SHA-256 catalog manifest. Any content edit invalidates `content:freeze:check` until an intentional freeze update is reviewed.

Existing content `0.1.0` / rules `0.5.0` expedition saves remain explicitly supported because every referenced ID and authoritative mechanic is retained. Recovery verifies old snapshots against their own stored version pair; only an explicit allow-list authorizes that pair. Unknown pairs fail closed.

## Consequences

- A single flexible map can no longer satisfy several content minimums.
- Content changes after freeze are visible as hash changes and require a reviewed lock update.
- Legacy saves resume deterministically without rewriting their stored content or rules identity.
- Future ID removal or incompatible rule change requires a new migration fixture and compatibility decision.
