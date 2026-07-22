# Deterministic Battle Architecture

Status: implemented foundation in Phase 1; terrain and battle rules are added in Phases 2–4.

## Authority boundary

`packages/deterministic-runtime` owns runtime primitives that must produce the same result for the same input on every supported Node.js and client JavaScript runtime. `packages/protocol` validates every command, event, and replay file at runtime. Presentation engines, wall-clock time, frame time, locale ordering, and device physics cannot enter this boundary.

The reducer contract is deliberately small:

```ts
type DeterministicReducer<TState> = (
  state: Readonly<TState>,
  command: BattleCommand,
  commandIndex: number,
  context: Readonly<ReplayContext>,
) => { state: TState; events: readonly BattleEvent[] };
```

The replay context supplies the root seed and independent rules, content, and replay schema versions on every call. The runtime clones canonical input before and after each reducer call, validates emitted events, enforces a contiguous event sequence, and computes a checkpoint after every command. Reducers introduced in later phases must use this contract rather than mutating presentation or service state.

## Numeric model

- Authoritative scalar values use branded safe integers with `FIXED_SCALE = 1000`.
- Addition, subtraction, multiplication, division, and conversion reject unsafe integer intermediates.
- Multiplication and division round toward zero explicitly.
- Angles are integers in milli-degrees; command angles are constrained to `0..359999`.
- Sine and cosine use a checked-in quarter-wave integer lookup table with deterministic linear interpolation. Runtime platform trigonometry is not authoritative.
- Power is expressed in integer permille.

Phase 2 must define world bounds so even worst-case terrain and projectile intermediates remain within the JavaScript safe-integer range.

## Random streams

The RNG is a functional `xoshiro128**` implementation with four `uint32` state words. Seed expansion uses an explicit 32-bit mixer. State is returned with every draw, so hidden mutation and implicit global randomness are impossible.

One root `uint32` seed derives these named independent streams:

`map`, `enemy`, `ai`, `aim_error`, `reward`, `fault`, `event`, and `hidden_objective`.

Stream derivation is stable and adding draws to one stream cannot advance another. Bounded integers use rejection sampling to avoid modulo bias. Tests lock a known sequence and verify isolation.

## Commands and events

Protocol version `0.1.0` defines strict discriminated unions for:

- Commands: `move`, `use_module`, `wait`, and `interact`.
- Events: `command_accepted`, `actor_moved`, `module_resolved`, `turn_waited`, `interaction_completed`, and `state_checkpoint`.

Identifiers are restricted, unknown fields are rejected, coordinates must be safe integers, and all indices are non-negative safe integers. These are foundation contracts; later phase-specific variants must remain runtime-validated and increment `protocolVersion` when compatibility changes.

## Canonical state and hashes

Canonical serialization recursively sorts object keys and preserves array order. It accepts only JSON-compatible data with safe integers, rejects sparse or unsupported values, detects cycles, and limits recursion depth and node count. This avoids dependence on object insertion history, locale, or engine-specific serialization behavior.

Logical state hashes are 16 lowercase hexadecimal characters produced by two independently seeded FNV-1a 32-bit passes over canonical UTF-8. These hashes detect deterministic drift and accidental corruption; they are not a security signature. Server submissions in later phases must additionally use a cryptographic digest or signature and must never treat the logical hash as anti-tamper proof.

## Replay execution

A replay carries independently versioned rules, content, and replay schema identifiers, a root seed, canonical initial state, ordered commands, expected per-command checkpoints, and an expected final hash. Verification re-executes the reducer and fails closed on:

- invalid replay, command, or event shape;
- non-contiguous event sequence;
- checkpoint count, index, or hash mismatch;
- final hash mismatch.

The checked-in `runtime-ledger-v1` fixture exercises every Phase 1 command and event family. CI executes it repeatedly and also runs the repository determinism policy scan.

## Forbidden authority inputs

`Math.random()`, `Date.now()`, device/frame timing, Cocos APIs and physics, locale-sensitive ordering, and unstable traversal are forbidden. Repository policy scanning rejects these dependencies in authority packages. Future native or WebAssembly accelerators require cross-runtime golden evidence and an ADR before adoption.
