# Client Architecture

## Boundaries

`apps/game-client` is a Cocos Creator 3.8.8 2D landscape project. Cocos owns scene lifecycle, rendering, input, audio playback, asset loading, and visual effects. It does not own battle truth.

```text
touch / WeChat lifecycle
        |
        v
input + platform adapters ----> settings / camera / audio / UI state
        |
        v
quantized BattleCommand
        |
        v
BattleSession ----> battle-core reducer <---- ai-core planner
        |
        v
validated BattleEvent[] ----> bounded presentation cues ----> Cocos visuals
```

`BattleSession` is the sole client command gateway. It keeps the command index and command log, parses player commands, rejects system commands from the player path, calls the shared reducer, and forwards validated events to presentation listeners. No scene or HUD API exposes a direct state setter.

## Input and camera

The aiming controller converts screen gestures into integer milli-degrees, permille power, and logical target coordinates. Gesture release never fires; it creates a pending-confirmation state. The default half-trajectory preview and extended full preview are explicit policies.

Gesture ownership is deterministic: aim handle, then UI, then camera. Two-finger camera gestures never steal an active aim or UI touch. `CameraDirector` arbitrates overview, actor follow, manual inspection, aiming, projectile follow, objective focus, and boss mechanic focus. Manual inspection suppresses ordinary automatic focus for 2.5 seconds; a high-priority boss mechanic may still request focus.

## Platform boundary

`PlatformAdapter` exposes safe area, connectivity, login code exchange, local storage, vibration, preferred frame rate, and foreground/background signals. The WeChat implementation wraps a narrow injected API; the mock implementation is deterministic and used by automated tests. The interface has no nickname, avatar, location, contact, media, microphone, or free-text profile capability.

## Accessibility and feedback

Every critical semantic uses at least color plus outline, pattern, icon, and text. Touch targets are at least 56 logical pixels. Settings apply locally on load/update and cover color vision, text size, contrast, flashes, motion, shake, handedness, aim/camera sensitivity, explicit fire confirmation, five audio controls, vibration, and preferred frame rate.

Critical sound cues require both text and icon fallbacks. Backgrounding pauses audio; foregrounding resumes it. Audio voices, visual cues, particles, and decorative debris have hard upper bounds.

## Loading and packaging

The bootstrap scene is the only start scene and constructs the initial accessible shell programmatically. Main navigation models idle, loading, ready, offline, and retryable error states. The collection entry dynamically loads the `feature-collection` Asset Bundle; its Creator 3.8 project setting builds it as a local WeChat mini-game subpackage. Later authored feature content follows this pattern. Engine-as-plugin remains disabled until package and device validation exists.

The repository build config never stores the WeChat AppID. `pnpm cocos:build:wechat` validates the project, injects the runtime AppID into a temporary config, invokes the pinned editor CLI, checks landscape output, and always removes temporary data.
