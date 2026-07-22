# Performance Budget

- Mid/high devices: target 60 FPS.
- Supported low-end baseline: stable 30 FPS.
- Routine main-thread work: no task over 100 ms.
- Authority simulation: independent of render frame rate.
- Terrain work: dirty-chunk and bounded collapse budgets.
- Server normal API: target p95 below 300 ms under defined test conditions.
- Replay verification: asynchronous worker path with queue and duration metrics.

## Phase 2 terrain benchmark

The checked-in benchmark builds a 192 by 96 logical grid, destroys a bridge connection, inspects 2,519 locally connected occupied cells across nine chunks, and collapses a 2,200-cell island. It runs three warmups and fifteen measured samples. CI fails when p95 exceeds 100 ms.

Development baseline on 2026-07-22:

- median: 11.17 ms
- p95: 15.67 ms
- collapsed cells: 2,200
- inspected cells: 2,519 of 18,432 possible grid cells

The measurement is a deterministic authority microbenchmark, not a client frame-rate claim. Cocos rendering, contour generation, memory, package, scene, device, and load budgets are measured and frozen in Phase 10; platform package limits are read from current configuration rather than hard-coded here.

## Phase 4 AI benchmark

The checked-in AI benchmark creates an expert-difficulty enemy phase with all four bosses plus driller, magnet, repairer, and wind-controller prototypes. It executes the full bounded planning pipeline and shared battle reducer for 19 legal decisions, with one warmup and eight measured samples. CI fails when p95 exceeds 1,500 ms for the complete eight-actor phase.

Development baseline on 2026-07-22:

- median: 289.72 ms
- p95: 309.43 ms
- actors: 8
- legal decisions: 19

This is an authority throughput gate, not a render-frame budget. Phase 5 presentation schedules enemy thinking and animations independently of the deterministic result, while Phase 8 worker load tests will set concurrency and replay-verification service budgets.

## Phase 5 presentation benchmark

The checked-in client benchmark parses and maps 10,000 validated battle events into a presentation queue capped at 256 entries while recording a synthetic 30 FPS frame stream. CI fails if the event pass exceeds 1,000 ms or the synthetic telemetry leaves its frame budget.

Development baseline on 2026-07-22:

- 10,000 events: 31.98 ms
- final presentation queue: 256 entries
- synthetic target: 30 FPS in budget

This isolates event and telemetry overhead. It is not a render, GPU, thermal, memory, WeChat runtime, or real-device FPS claim. The latter remains blocked by `EXT-006` and must be recorded in `DEVICE_MATRIX.md`.

## Phase 8 daily and replay benchmarks

The checked-in daily-definition benchmark creates 500 complete fixed challenges, including route and battle assignments, with a five-second CI ceiling. The replay benchmark performs 100 trusted verifications that reconstruct server-owned initial states, execute the submitted player commands and server AI path, compare hashes, and recompute scores. Replay verification fails CI when p95 exceeds 100 ms.

Development baseline on 2026-07-22:

- 500 daily definitions: 2,415.59 ms
- trusted replay verification p95: 10.62 ms
- replay samples: 100

These are isolated deterministic authority measurements on the development/CI class of CPU. They are not production throughput, queue-latency, Redis, PostgreSQL, autoscaling, or capacity claims; those require Phase 10 deployment load evidence.
