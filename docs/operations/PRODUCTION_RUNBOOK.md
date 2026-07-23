# Production Runbook

Status: deployment-independent procedures are prepared; real domains, credentials, infrastructure, alert routing and rehearsal evidence remain blocked by `EXT-001` and `EXT-002`.

## Release

1. Select an immutable commit and version; freeze content/rules manifests and record hashes.
2. Require green regression, integration, Web E2E, security, provenance, package and strict release gates.
3. Confirm schema compatibility and take a restorable pre-change backup.
4. Deploy server and worker to staging; check `/health/live`, `/health/ready`, `/metrics`, login, saves, deletion, daily replay and admin audit with test identities.
5. Roll out production gradually. Compare 5xx, latency, database, Redis and queue signals to the pre-release baseline before expansion.
6. Retain the previous server, client manifest and content version for rollback; record operator, time, commit, manifests and outcome.

## Incident triage

Use the request ID response header and W3C trace ID to correlate structured `http_request_completed` records. Logs contain method, normalized route, status and duration but no query string, body, network address or account identifier. For suspected replay/content integrity problems, freeze leaderboard publication or content changes through audited controls while preserving raw evidence.

Declare severity from player impact and data/integrity risk. Stabilize first, preserve evidence, then diagnose. Credential exposure requires immediate revocation and rotation. Privacy incidents require the privacy/legal response owner. Do not repair production state with ad hoc SQL; use an reviewed, logged, reversible operation.

## Rollback and recovery

Application rollback must keep database and protocol compatibility. Content rollback selects an already signed immutable version. Database recovery always restores to an isolated `_restore_drill` target first, validates integrity and compatibility, then follows an approved cutover. Redis caches may be discarded and rebuilt; idempotent replay jobs are re-enqueued from durable records.

## Routine operations

- Daily: readiness, alert, backup freshness, queue age/dead letter, storage and deletion backlog review.
- Weekly: capacity/error trend, privileged audit, content signature and dependency/security advisory review.
- Monthly: access review, retained data/deletion sample, backup inventory and package/device support changes.
- Quarterly: timed restore and incident exercise, key rotation rehearsal and runbook owner review.

Exact deployment commands, infrastructure identifiers, contacts and secret-manager paths belong in access-controlled operational records, not this public repository.
