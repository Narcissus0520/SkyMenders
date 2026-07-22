# Security Policy

Report suspected vulnerabilities privately to the repository owner through GitHub's private vulnerability reporting channel. Do not open a public issue containing secrets, exploit details, user identifiers, or production infrastructure data.

The client is never authoritative for score, time, random state, terrain state, battle outcome, or platform identity. Secrets belong in a managed secret store and must not enter client bundles, content bundles, logs, screenshots, or test fixtures.

The repository secret policy is a fast local gate, not a substitute for GitHub secret scanning, dependency review, SAST, or manual incident response.
