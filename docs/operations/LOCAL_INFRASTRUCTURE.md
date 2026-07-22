# Local Infrastructure

`docker-compose.yml` provides loopback-only PostgreSQL, Redis, and MinIO with healthchecks and persistent named volumes. Prometheus and Grafana are optional through the `observability` profile. Development defaults are intentionally non-production and must be replaced through an untracked `.env`.

Run `pnpm infra:validate` before `pnpm infra:up`. Docker is currently absent on the bootstrap workstation, so container startup remains unverified locally until DEV-001 is resolved. CI must still validate the file and later server phases must run real integration dependencies.
