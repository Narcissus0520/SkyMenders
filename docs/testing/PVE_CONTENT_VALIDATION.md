# PvE Content Validation

Run:

```bash
pnpm content:validate
pnpm --filter @skymenders/content-runtime test:determinism
pnpm --filter @skymenders/content-runtime test:performance
```

The content gate checks strict JSON shapes, semantic versions, exact core IDs, unique entries, cross-catalog references, localization coverage, module slots and upgrade ownership, objective role placement, progression prerequisites, energy-free critical interactions, map capabilities, the guaranteed route-duration budget, and authority-code alignment. It enforces the V1 scale inventory, checks region ownership and node-type compatibility, and materializes all 48 templates through the terrain pre-battle validator.

The deterministic corpus regenerates routes and locked rewards at boundary seeds. A 250-seed duration corpus requires every generated plan to expose a twelve-node path inside the configured 35-45 minute target. The full expedition test visits twelve nodes across four regions and checks recovery, defeat, completion, restart, and resource accounting. Reward tests cover compatibility, diversity, ownership weighting, attack-category suppression, and lock stability. Tutorial tests reject out-of-order actions.

The benchmark generates 5,000 four-region plans and fails above 5 seconds on the CI-class development environment. It is an algorithm regression budget, not a real-device frame-rate claim.
