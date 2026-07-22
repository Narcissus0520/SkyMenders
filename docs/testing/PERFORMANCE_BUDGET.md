# Performance Budget

- Mid/high devices: target 60 FPS.
- Supported low-end baseline: stable 30 FPS.
- Routine main-thread work: no task over 100 ms.
- Authority simulation: independent of render frame rate.
- Terrain work: dirty-chunk and bounded collapse budgets.
- Server normal API: target p95 below 300 ms under defined test conditions.
- Replay verification: asynchronous worker path with queue and duration metrics.

Concrete scene, map, memory, package, and load budgets are measured and frozen in Phase 10; platform package limits are read from current configuration rather than hard-coded in this document.
