# Backup and Recovery

Status: production backup implementation and drills remain planned for Phases 10-11. Phase 7 adds transactional seven-day save-branch recovery records; these are not backups.

Production recovery must cover PostgreSQL base/full backups and point-in-time logs, object storage versioning, content artifacts/signatures, configuration without secrets, Redis reconstruction strategy, restore isolation, integrity validation, replay/content compatibility, RPO/RTO targets, access audit, and a dated rehearsal. A backup is not accepted until a restore is verified.

The Phase 7 `save_recovery` table protects against an immediately superseded, rejected, or deleted expedition branch. It is account-owned, expires after seven days, and is erased by account deletion. It does not protect against database loss and does not satisfy the release backup gate.
