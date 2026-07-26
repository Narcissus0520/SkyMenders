# Cocos and WeChat Validation

## Automated local and CI checks

```bash
pnpm cocos:check
pnpm --filter @skymenders/game-client test:coverage
pnpm --filter @skymenders/game-client test:performance
```

The static project gate verifies the exact Cocos version, 2D project type, bootstrap scene/component linkage, landscape WeChat configuration, empty committed AppID, disabled unverified engine plugin, and absence of credential-shaped values in client TypeScript. Client tests cover adapter contracts, lifecycle, settings, accessibility semantics, explicit aim confirmation, camera arbitration, bounded feedback, presentation-only event handling, and the shared reducer gateway.

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

The wrapper creates a temporary build config, injects the AppID, invokes Creator with the project and config path, accepts the documented success status, validates `build/wechatgame/game.json`, and removes the temporary directory. A manual Windows workflow is available for a self-hosted runner labelled `cocos-3.8.8`.

## Device acceptance

Import the generated package into WeChat Developer Tools, then run the matrix in `DEVICE_MATRIX.md`. Record screenshots/logs and the exact Creator, Developer Tools, base library, WeChat, OS, and device versions. Required evidence includes landscape startup, safe-area layout, touch priority, aim confirmation, camera suppression, background/resume, network loss/recovery, audio/vibration controls, all accessibility options, sustained frame pacing, memory peak, and package/subpackage results.

As of 2026-07-25 this workstation has Cocos Creator 3.8.8 and WeChat Developer
Tools installed. A local simulator package built successfully with Cocos Creator
using a non-production test AppID: the output contains 38 files, requests
landscape orientation, and totals 6,102,124 bytes. The generated project was
imported into the logged-in Developer Tools, compiled, and exercised in a
detached 100% scale 844x390 simulator. The standard-expedition entry opens a
playable deterministic local battle; firing, terrain mutation, enemy and
environment settlement, objective progress, victory, enlarged touch controls
and settings-aware vibration routing were validated without a runtime exception.

This evidence closes the local tool-install/build portion only. It does not
satisfy `EXT-001` because no product-owned AppID or verified entity was used, and
it does not satisfy `EXT-006` because no physical-device matrix has been run.
The compiled main package also exceeds the repository's 1,887,436-byte internal
budget; this is tracked as `PKG-001` and must be corrected before a release
candidate.
