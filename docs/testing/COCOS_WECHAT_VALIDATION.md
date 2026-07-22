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

As of 2026-07-22 this workstation has no Cocos Creator executable, authorized AppID, WeChat Developer Tools evidence, or physical-device report. `pnpm cocos:build:wechat` therefore exits with blocker code 2 and names `COCOS_CREATOR_PATH`; this is expected external evidence, not a successful device gate.
