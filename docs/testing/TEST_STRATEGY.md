# Test Strategy

Testing is layered:

- Unit and property tests cover deterministic math, rules, content policies, migrations, scoring, and invariants.
- Golden replays detect intentional and accidental rule drift.
- Integration tests use real PostgreSQL and Redis dependencies for API, queue, idempotency, and deletion behavior.
- Playwright covers Content Studio and Admin Console workflows.
- Cocos smoke, WeChat Developer Tools, and real devices cover presentation, input, resume, package, and performance behavior.
- Security tests cover identity spoofing, replay, authorization, tampering, injection, request limits, secrets, dependencies, and deletion completeness.

Core deterministic packages must reach at least 95% statement and 90% branch coverage; other core packages target 85% statement and 80% branch coverage. Coverage complements, not replaces, behavioral gates.

## Phase 2 terrain evidence

- Unit tests cover all four material contracts, state invariants, dirty-chunk seams, damage, repair, support capacity, root attachment, collapse ordering/placement, map-validation issue codes, and terrain operation checkpoints.
- A seeded property suite generates 64 bounded terrain cases and checks damage monotonicity, immutable input state, repeat equality, deterministic support/collapse, valid material/integrity pairs, and identical state hashes.
- The large-collapse golden test freezes the operation checkpoints, final state hash, event hash, component size, inspected-cell bound, and repeat execution result.
- The terrain performance command exercises the same scenario after warmup and enforces the documented p95 budget.
