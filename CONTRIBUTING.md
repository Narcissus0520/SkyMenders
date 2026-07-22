# Contributing

Read `AGENTS.md` before changing code. Work is phase-scoped and delivered through protected branches and pull requests.

1. Start from current `main` and use the phase branch named in the implementation plan.
2. Preserve unrelated local changes.
3. Add or update tests before changing authoritative behavior.
4. Run the affected package checks and the repository gates.
5. Update status documents and ADRs when compatibility or architecture changes.
6. Use Conventional Commits.

Never commit secrets, unapproved assets, generated build caches, personal data, or platform credentials. A passing build does not waive product, determinism, privacy, legal, or release gates.
