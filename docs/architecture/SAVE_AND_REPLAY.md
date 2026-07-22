# Save and Replay Architecture

Status: replay and runtime snapshot foundation implemented in Phase 1; durable expedition/account persistence is planned for Phase 7.

## Replay contract

Replay schema `0.1.0` stores:

- `replaySchemaVersion`, `rulesVersion`, and `contentVersion`;
- a reproducible `fixtureId` and `uint32` root seed;
- canonical initial state;
- ordered runtime-validated battle commands;
- one expected state checkpoint per command;
- the expected final logical state hash.

Replay parsing is strict and bounded to 100,000 commands and checkpoints. Verification recomputes all events and state; stored hashes are evidence to compare, never a source of authoritative state. Golden fixtures live under `packages/test-fixtures/replays/` and are executed by `tools/replay-runner`.

## Runtime snapshot contract

Snapshot schema `0.1.0` contains rules, content, and replay schema versions; turn and command indices; the explicit state of every used RNG substream; canonical battle state; and a logical state hash. Snapshot creation detaches caller-owned objects. Restoration checks the schema, exact expected compatibility versions, RNG shape, and hash before returning another detached state object.

Phase 1 snapshots are in-memory/runtime structures. They are not yet a durable save format and do not claim database persistence, cloud synchronization, conflict resolution, encryption, or migration support.

## Phase 7 integration rules

Durable saves must wrap the runtime snapshot rather than serializing arbitrary application objects. Account progress, expedition state, and turn-start battle recovery remain separate records with their own `saveSchemaVersion`. Persistence must retain RNG states and version dimensions unchanged.

On recovery:

1. Validate the storage envelope and save schema.
2. Select or migrate compatible rule, content, replay, and save versions.
3. Verify the embedded runtime snapshot before using it.
4. Resume at the saved turn boundary with identical RNG states.
5. If a battle snapshot is corrupt, fall back to the node-start snapshot.
6. If migration is unavailable, preserve the original record and return a recoverable incompatibility result; never silently delete the expedition.

Cloud conflict handling, logical clocks, node-level autosave, restart quotas, and account deletion are Phase 7 deliverables and remain explicitly unimplemented here.

## Security properties

The deterministic logical hash is suitable for drift detection and replay comparison, but not for hostile-client authentication. Daily challenge and PvP submissions must be recomputed by a trusted worker/server and protected with cryptographic integrity controls. No client-provided final state or logical hash is accepted as a result by itself.
