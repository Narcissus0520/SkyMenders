# ADR 0006: Cocos client presentation and platform boundary

- Status: Accepted
- Date: 2026-07-22

## Context

Phase 5 introduces a Cocos Creator client and WeChat runtime integration without weakening the deterministic authority established in Phases 1-4. Touch coordinates, animation frames, device time, and platform callbacks are not authoritative battle inputs. The client must also support mock execution, accessibility from its first screen, interruption handling, and reproducible command construction.

## Decision

1. Pin the project to Cocos Creator 3.8.8 and keep Cocos imports inside `apps/game-client`. Domain packages remain engine-independent.
2. Route all local PvE state changes through `BattleSession`, which parses commands and invokes the shared battle reducer. Enemy turns use `executeAiEnemyPhase`, which uses that same reducer. Presentation consumes validated events and cannot mutate battle state.
3. Quantize aiming to integer logical coordinates, milli-degrees, and permille power. Releasing the aim gesture enters a pending state; only explicit confirmation produces a `UseModuleCommand`.
4. Put WeChat calls behind a narrow `PlatformAdapter`. The adapter exchanges only the short-lived login code and platform primitives; personal nickname/avatar fields and server credentials are not modeled.
5. Use a mock adapter for local tests. It must preserve the same lifecycle, storage, network, vibration, and frame-rate contracts.
6. Centralize camera arbitration, including manual-inspection suppression, high-priority boss requests, bounds, reduced shake, and touch routing precedence.
7. Make faction, material, and validity meaning redundant through text, icon, outline, and pattern. Enforce a minimum 56-pixel touch target and expose text scale, color-vision presets, high contrast, reduced flash/motion/shake, handedness, sensitivity, volume, vibration, and frame-rate settings.
8. Bound presentation queues, particles, debris, audio voices, and frame samples. Rendering and animation remain decoupled from authority execution.
9. Keep the committed WeChat AppID empty. The build wrapper injects it from the environment into a temporary config and deletes that config after the build.
10. Advance only `clientVersion` from `0.0.0` to `0.1.0`. Rules, protocol, replay, save, content, and server versions do not change.

## Consequences

- Cocos scene scripts are deliberately thin. New screens may orchestrate services but cannot write `BattleState` directly.
- Device-specific platform behavior can be tested through contract doubles before real WeChat access exists.
- A presentation bug cannot alter replay results; an invalid command fails at the protocol or reducer boundary.
- The command-line wrapper provides a repeatable build path, but a physical-device performance claim still requires Cocos Creator, WeChat Developer Tools, an AppID, and the agreed QA device matrix.

## Rollback and compatibility

No released client references `clientVersion` 0.1.0. The Cocos application can be removed without changing rules 0.4.0 replay compatibility. Once a saved account records client-specific settings, the settings schema must be migrated independently from battle and save schemas.
