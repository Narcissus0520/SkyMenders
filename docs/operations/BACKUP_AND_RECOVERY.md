# Backup and Recovery

Status: the isolated PostgreSQL restore drill and CI evidence path are implemented in Phase 10. Production storage, schedules, retention, encryption, off-site targets, RPO/RTO approval and dated production rehearsal remain blocked by `EXT-002`.

## Protected state

- PostgreSQL: encrypted full/base backups plus continuous WAL suitable for point-in-time recovery.
- Immutable content artifacts, manifests and signatures: object versioning plus a separately retained inventory.
- Non-secret configuration: version-controlled deployment manifests and content/rules compatibility matrix.
- Secrets: recover through the approved secret manager, never repository backups.
- Redis: reconstruct leaderboard caches and BullMQ derived state from PostgreSQL/idempotent jobs; do not treat Redis persistence as the system-of-record backup.

The seven-day `save_recovery` row protects a player from an immediately superseded expedition branch. It is account-owned and erased by account deletion; it is not disaster recovery.

## Restore drill

Set `DATABASE_URL` to the source and `RESTORE_DATABASE_URL` to a dedicated database whose name ends in `_restore_drill`, then run `pnpm backup:drill`. The tool uses `pg_dump` custom format, creates a clean isolated database, restores with `pg_restore --exit-on-error`, compares sorted public-table inventories, drops the drill database and removes the temporary archive. Passwords are passed through `PGPASSWORD`, not command arguments.

The Server Integration workflow runs this against its ephemeral PostgreSQL 17 service after migrations. Production acceptance additionally requires sampled row counts and integrity queries, replay/content compatibility checks, application smoke tests, point-in-time selection, encrypted off-site retrieval, access-log review, measured recovery duration and an owner-signed result.

## Targets and cadence

Provisional design targets, pending infrastructure approval: maximum 15-minute PostgreSQL data loss (RPO), four-hour service restoration (RTO), daily full backup, continuous WAL, 35 daily restore points, 12 monthly archives and a quarterly restore rehearsal. These are not confirmed production commitments until `EXT-002` closes.

Any failed backup, missing WAL interval, unverified object version, expired rehearsal, integrity mismatch or RPO/RTO miss is a release/incident gate. Never restore over a production database; restore to isolation, validate, then use an approved cutover plan with a rollback point.
