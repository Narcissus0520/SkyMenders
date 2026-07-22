# Test Strategy

Testing is layered:

- Unit and property tests cover deterministic math, rules, content policies, migrations, scoring, and invariants.
- Golden replays detect intentional and accidental rule drift.
- Integration tests use real PostgreSQL and Redis dependencies for API, queue, idempotency, and deletion behavior.
- Playwright covers Content Studio and Admin Console workflows.
- Cocos smoke, WeChat Developer Tools, and real devices cover presentation, input, resume, package, and performance behavior.
- Security tests cover identity spoofing, replay, authorization, tampering, injection, request limits, secrets, dependencies, and deletion completeness.

Core deterministic packages must reach at least 95% statement and 90% branch coverage; other core packages target 85% statement and 80% branch coverage. Coverage complements, not replaces, behavioral gates.
