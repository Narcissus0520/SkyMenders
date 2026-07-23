# Save and Replay Architecture

Status: replay/runtime snapshots implemented in Phase 1; durable account and expedition persistence implemented in Phase 7; trusted daily replay submission and verification implemented in Phase 8.

## Replay contract

Replay schema `0.1.0` stores:

- `replaySchemaVersion`, `rulesVersion`, and `contentVersion`;
- a reproducible `fixtureId` and `uint32` root seed;
- canonical initial state;
- ordered runtime-validated battle commands;
- one expected state checkpoint per command;
- the expected final logical state hash.

Replay parsing is strict and bounded to 100,000 commands and checkpoints. Verification recomputes all events and state; stored hashes are evidence to compare, never a source of authoritative state. Golden fixtures live under `packages/test-fixtures/replays/` and are executed by `tools/replay-runner`.

Daily replay schema `0.2.0` wraps node replays in a server-owned challenge identity. It carries seed, rules/content/replay/client versions, completion status, completed route prefix, recovery count, node commands and hashes, and a claimed score that is compared but never trusted. The API persists and queues this envelope; it does not execute the battle inline.

The Worker reloads the persisted definition and authored content, reconstructs every initial battle state, regenerates enemy commands from the deterministic server AI, executes the shared reducer, compares checkpoints and final hashes, validates route/outcome, and recomputes score. Only the atomic verified formal-attempt completion path can write a leaderboard entry. Rejected submissions remain isolated with a pseudonymous risk event.

## Runtime snapshot contract

Snapshot schema `0.1.0` contains rules, content, and replay schema versions; turn and command indices; the explicit state of every used RNG substream; canonical battle state; and a logical state hash. Snapshot creation detaches caller-owned objects. Restoration checks the schema, exact expected compatibility versions, RNG shape, and hash before returning another detached state object.

Phase 7 embeds these snapshots in strict expedition save documents. The outer document adds an independent save schema, save ID, device kind, revision, logical clock, update time, content/rules versions, expedition state, bounded summary, and integrity hash.

## Durable save and recovery rules

Account progress, expedition state, and turn-start battle recovery remain separate concerns under one `saveSchemaVersion`. Persistence retains RNG states and version dimensions unchanged.

On recovery:

1. Validate the storage envelope and save schema.
2. Select or migrate compatible rule, content, replay, and save versions.
3. Verify the embedded runtime snapshot before using it.
4. Resume at the saved turn boundary with identical RNG states.
5. If a battle snapshot is corrupt, fall back to the node-start snapshot.
6. If both snapshots are unavailable, retain the verified expedition boundary.
7. If migration is unavailable, preserve the original record and return a recoverable incompatibility error; never silently delete the expedition.

Local expedition persistence uses two journal slots. A complete sealed payload is written to the inactive slot before the active pointer changes. Reads verify the active envelope and save, then try the previous slot. Account progress uses field-level monotonic merge; expedition branches require an explicit player choice.

Cloud writes carry the last observed base revision. PostgreSQL compares and replaces that revision atomically and archives the replaced/rejected branch for seven days in the same transaction. Conflicts return only bounded summaries. One restart per node is stored in the sealed expedition ledger, so clearing client cache or switching devices does not restore the allowance after synchronization.

Save schema `0.1.0` supports a tested migration from the internal `0.0.1` shape. The serialized migration corpus proves that the save ID, played expedition state, summary and the retained content `0.1.0` / rules `0.5.0` compatibility dimensions remain unchanged and that its snapshots are verified against their stored pair. Current saves use content `0.2.0` / rules `0.6.0`; only explicitly allow-listed older pairs can resume. Unknown schemas and unavailable rules/content versions fail closed. The original record is never silently deleted.

## Security properties

The deterministic logical hash detects accidental drift and corruption; it is not a message-authentication code against a hostile client. Daily challenge submissions are recomputed by the trusted Worker, and the same rule remains mandatory for PvP. No client-provided final state, logical hash, enemy action, outcome, or score is accepted as a result by itself.
