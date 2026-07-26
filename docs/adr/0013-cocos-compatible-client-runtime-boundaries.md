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

## Consequences

The same protocol and save validators continue to run on client and server, and
the real WeChat build succeeds without Node built-ins. Both Zod v3 and v4 errors
are recognized by the server exception filter during the compatibility period.
Any later migration back to a single Zod surface requires a real Creator build,
not only Node tests.
