# Phase 11 Recovery Drills

Last reviewed on 2026-07-23. These are repository and CI rehearsals, not evidence of a production recovery.

## Save migration

`pnpm save:migration:drill` reads the serialized `0.0.1` expedition fixture, migrates it through the supported `0.1.0` save schema, verifies its integrity seal, and proves that save ID, expedition state, summary, rules version, and content version are unchanged. Recovery explicitly permits the retained `0.5.0` rules and `0.1.0` content pair while the current pair is `0.6.0` / `0.2.0`; unknown versions remain rejected.

The fixture uses only IDs retained in content `0.2.0`. Removing one of those IDs requires a new migration and fixture before the content freeze can change.

## Content rollback

`pnpm content:rollback:drill` copies the repository content to an isolated temporary workspace, validates and publishes an original immutable artifact, publishes a changed artifact, rolls the active artifact back to the original, verifies the active pointer, freezes the workspace, and proves that a post-freeze write is rejected. The drill also tests that a stale publication cannot redirect the active pointer and that self-rollback is invalid.

The drill uses local-only signing material and deletes its temporary workspace. It never writes production state.

## Database restore

`pnpm backup:drill` remains mandatory in Server Integration CI against PostgreSQL 17. It exports the migrated test database, restores to an isolated `_restore_drill` database, compares public tables, and removes the drill database. Source and target physical identity checks prevent a restore over the source.

Production backup age, storage, access, restoration time, data reconciliation, and owner sign-off remain blocked by `EXT-002` and must be attached to the strict release evidence before an RC can pass.
