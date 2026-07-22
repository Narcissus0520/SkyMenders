# ADR 0002: Deterministic runtime primitives

- Status: Accepted
- Date: 2026-07-22
- Owners: deterministic simulation

## Context

Replays, interrupted-battle recovery, daily challenge verification, and later server-authoritative PvP require the same rule version, content version, seed, and command sequence to produce identical state. JavaScript floating-point edge cases, implicit mutable randomness, object insertion order, engine physics, and frame timing cannot be allowed to decide authoritative outcomes.

The runtime also has to remain usable in Node.js services and a Cocos/WeChat JavaScript client without relying on platform-native binary extensions.

## Decision

1. Use branded safe integers with `FIXED_SCALE = 1000` for authoritative fixed-point values. Every arithmetic operation validates intermediate safety, and multiply/divide round toward zero.
2. Represent angles as integer milli-degrees. Use a pre-generated 0–90 degree integer sine table, deterministic interpolation, and quadrant reflection for sine/cosine.
3. Use a functional 32-bit `xoshiro128**` RNG whose full four-word state is passed and returned explicitly. Derive named subsystem streams from a root `uint32` seed.
4. Canonically serialize JSON-compatible state by recursively sorting keys, preserving array order, and rejecting unsafe or unsupported values.
5. Use a stable 16-hex logical drift hash composed from two seeded FNV-1a 32-bit passes over canonical UTF-8. Treat it as a deterministic checksum, not a security primitive.
6. Runtime-validate all command, event, snapshot, and replay boundaries. Replay execution emits one state checkpoint after every command and fails closed on any mismatch.
7. Set `rulesVersion`, `protocolVersion`, and `replaySchemaVersion` to `0.1.0`; leave unrelated version dimensions at `0.0.0`.

## Alternatives considered

1. Raw JavaScript floating point: rejected for authority logic because rounding and uncontrolled transcendental calls make invariants and cross-runtime drift harder to contain.
2. `BigInt` fixed point: rejected for the initial runtime because JSON interoperability and WeChat/Cocos target compatibility are more complex; checked safe integers satisfy current required precision and range.
3. A global seeded RNG object: rejected because adding a random draw in one subsystem would shift unrelated map, AI, reward, or event outcomes.
4. Native `JSON.stringify` plus insertion order: rejected because equivalent logical states built through different insertion histories would hash differently.
5. A cryptographic hash for every local checkpoint: deferred because the logical hash is a hot-path drift detector. Trusted server submissions still require a cryptographic digest or signature in later phases.
6. Cocos physics or frame simulation as authority: rejected because it couples results to frame rate, engine version, and client control.

## Consequences

Authority code must carry explicit conversions and RNG state, which is more verbose but reviewable. Fixed-point range limits must be documented and tested by each later system. Lookup precision is bounded and cannot be silently changed without golden replay impact. Canonical state excludes dates, maps, sets, class instances, non-finite numbers, and unsafe integers.

Golden replay hashes become compatibility evidence. Any intentional algorithm, table, serialization, or event-order change that alters them requires an affected version increment, migration/compatibility analysis, and updated fixtures reviewed as a rules change.

## Migration and compatibility impact

This is the first implemented rule/protocol/replay contract, so no player migration is required. `rulesVersion`, `protocolVersion`, and `replaySchemaVersion` advance from `0.0.0` to `0.1.0`. `contentVersion`, `saveSchemaVersion`, client, and server versions remain `0.0.0`.

Future replay readers must select the matching rule implementation by version. They must not reinterpret an older fixture with newer semantics and overwrite its expected hashes.

## Rollback

The Phase 1 packages can be reverted before user data exists by returning the three affected dimensions to `0.0.0` and removing the fixture. Once a released replay or save references `0.1.0`, rollback must retain a compatible reader and reducer; deleting the implementation or rewriting stored hashes is not acceptable.
