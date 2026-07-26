# Cocos and WeChat Validation

## Automated local and CI checks

```bash
pnpm cocos:check
pnpm --filter @skymenders/game-client test:coverage
pnpm --filter @skymenders/game-client test:performance
```

The static project gate verifies the exact Cocos version, 2D project type, bootstrap scene/component linkage, landscape WeChat configuration, empty committed AppID, enabled engine plugin, pinned minimal 2D engine modules, disabled default splash assets, and absence of credential-shaped values in client TypeScript. Client tests cover adapter contracts, lifecycle, settings, accessibility semantics, explicit aim confirmation, camera arbitration, bounded feedback, presentation-only event handling, and the shared reducer gateway.

## Real build

Set these values outside the repository:

```text
COCOS_CREATOR_PATH=<absolute path to CocosCreator.exe 3.8.8>
WECHAT_MINIGAME_APP_ID=<authorized Mini Game AppID>
```

Then run:

```bash
pnpm cocos:build:wechat
```

The wrapper creates a temporary build config, injects the AppID, invokes Creator with the project and config path, accepts the documented success status, validates `build/wechatgame/game.json`, disables and removes the unused Creator default splash assets, and removes the temporary directory. The post-process fails closed if Creator's pinned first-screen template drifts. A manual Windows workflow is available for a self-hosted runner labelled `cocos-3.8.8`.

## Device acceptance

Import the generated package into WeChat Developer Tools, then run the matrix in `DEVICE_MATRIX.md`. Record screenshots/logs and the exact Creator, Developer Tools, base library, WeChat, OS, and device versions. Required evidence includes landscape startup, safe-area layout, touch priority, aim confirmation, camera suppression, background/resume, network loss/recovery, audio/vibration controls, all accessibility options, sustained frame pacing, memory peak, and package/subpackage results.

As of 2026-07-26 this workstation has Cocos Creator 3.8.8 and WeChat Developer
Tools installed. A local simulator package built successfully with Cocos Creator
using a non-production test AppID. The earlier self-contained output contained
38 files and totaled 6,102,124 bytes; it was imported into the logged-in
Developer Tools, compiled, and exercised in a detached 100% scale 844x390
simulator. The standard-expedition entry opened a playable deterministic local
battle; firing, terrain mutation, enemy and environment settlement, objective
progress, victory, enlarged touch controls and settings-aware vibration routing
were validated without a runtime exception.

The later engine-plugin output contains 27 generated files, requests landscape
orientation, and totals 1,876,241 bytes. The sandbox AppID cannot resolve the
Cocos public plugin in Developer Tools. This is an expected external-evidence
boundary rather than a successful optimized-runtime smoke: the
[Cocos Creator 3.8 engine-plugin instructions](https://docs.cocos.com/creator/3.8/manual/zh/editor/publish/wechatgame-plugin.html)
state that engine separation must be tested with an AppID opened by the
developer. A product-owned, plugin-authorized AppID is required to close this
runtime check.

This evidence closes the local tool-install/build portion only. It does not
satisfy `EXT-001` because no product-owned AppID or verified entity was used, and
it does not satisfy `EXT-006` because no physical-device matrix has been run.
The generated files pass the repository's 1,887,436-byte internal budget by
11,195 bytes. Current plugin-inclusive platform accounting and official limits
remain fail-closed under `EXT-006`.
