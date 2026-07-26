# ADR 0013: Cocos-compatible client runtime boundaries

- Status: Accepted
- Date: 2026-07-25

## Context

Cocos Creator 3.8.8 imports every TypeScript asset through its SystemJS-based
editor and build pipeline. The first real WeChat build exposed three
incompatibilities that Node/Vitest did not:

- asset-local imports ending in `.js` were not resolved back to `.ts`;
- Zod 4's ESM initialization graph failed while Cocos preloaded client scripts;
- the root save-migration export pulled a Node-only migration drill and
  `node:fs/promises` into the mini-game graph.

It also produced a 6,102,124-byte main package, far above the repository's
1,887,436-byte internal budget. Most of the excess came from embedding the full
engine instead of the platform engine plugin; aggregate package entry points
and Creator's unused default splash images added avoidable bytes.

## Decision

- `apps/game-client` uses TypeScript `Bundler` module resolution and
  extensionless relative imports beneath `assets/scripts`.
- Protocol schemas shipped to the client use Zod's supported `zod/v3`
  compatibility surface. Shared helpers provide UUID, ISO timestamp and
  recursive JSON schemas while preserving runtime validation.
- The save-migration package exposes `./runtime`; Cocos imports that subpath,
  while Node-only migration drills remain available only from the package root.
- The root Cocos build command builds the game client's workspace dependencies
  before invoking Creator so clean workstations do not depend on stale `dist`
  output.
- WeChat builds keep the Cocos engine plugin enabled and pin the exact 2D,
  graphics, WebGL, UI, intersection and legacy-pipeline module list in the
  committed build configuration. Static validation rejects drift.
- Client protocol imports use purpose-specific exported subpaths so Creator
  does not retain unrelated schema entry points.
- The default Creator splash is disabled. Because Creator 3.8.8 still copies
  and enables its default logo in the generated first-screen template, the
  build wrapper deterministically flips that single pinned template marker and
  removes `logo.png` and `slogan.png`; it fails if the template changes.

## Alternatives considered

- Raising the internal package budget was rejected because the first build had
  clear removable engine and splash overhead and no release evidence justified
  weakening the gate.
- Moving code into nominal subpackages was rejected as the immediate remedy
  because the generated feature bundles contained no compiled bytes and would
  not remove the embedded engine.
- Editing generated output manually was rejected because it would not be
  reproducible. The build wrapper owns the post-process and tests the exact
  template boundary.

## Consequences

The same protocol and save validators continue to run on client and server, and
the real WeChat build succeeds without Node built-ins. Both Zod v3 and v4 errors
are recognized by the server exception filter during the compatibility period.
Any later migration back to a single Zod surface requires a real Creator build,
not only Node tests.

The optimized real build is 1,876,241 bytes and passes the unchanged internal
raw-file budget. The sandbox AppID cannot resolve the public Cocos engine plugin;
Cocos requires a developer-opened AppID for that test, so optimized-runtime
evidence remains external under `EXT-001`. The engine-module list and Creator
first-screen marker are pinned compatibility surfaces: upgrades require an
actual build, package measurement and an authorized Developer Tools smoke test.
These changes do not affect rules, content, save, replay or protocol versions.
