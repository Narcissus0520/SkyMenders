# Deterministic Battle Architecture

Status: planned for Phase 1–4.

Authoritative coordinates, velocity, angles, power, collision, damage, terrain, state effects, and random decisions use fixed integers and explicit seeded streams. Canonical state serialization and a cross-runtime stable hash connect commands, events, snapshots, golden replays, daily verification, and later PvP adjudication.

Forbidden inputs include `Math.random()`, `Date.now()`, device frame time, Cocos physics results, locale-sensitive ordering, and unstable object traversal. The Phase 0 determinism policy scans authority packages so these dependencies fail before replay implementation lands.
