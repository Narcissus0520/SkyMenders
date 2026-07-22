# Content Pipeline

Phase 0 provides a strict versioned manifest and executable validator. Later phases add Zod schemas, reference/localization validation, map solvability, batch simulation, deterministic packaging, hashing, change manifests, staged approval, signing, publication, freeze, and rollback.

Content never executes arbitrary JavaScript. Daily challenges bind an immutable content and rules version for their full server-date window. Production publication cannot be triggered by Content Studio without validation and authorized approval.
