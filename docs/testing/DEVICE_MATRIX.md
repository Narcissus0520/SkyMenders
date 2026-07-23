# Device Matrix

Real-device execution is a Phase 5 external acceptance gate. Each run must record device model/class, OS, WeChat version, Developer Tools/base-library version, renderer, memory, network, cold start, first interaction, sustained FPS, p95 frame time, frames over 100 ms, memory peak, background/resume, touch accuracy, audio, vibration, accessibility settings, and package/subpackage behavior.

| Class                         | Target coverage                           | Performance target                            | Current evidence       |
| ----------------------------- | ----------------------------------------- | --------------------------------------------- | ---------------------- |
| Supported low-end Android     | 2 devices across supported OS range       | Sustained 30 FPS, no routine task over 100 ms | Blocked by EXT-006     |
| Mid-range Android             | 2 devices                                 | Target 60 FPS with graceful 30 FPS fallback   | Blocked by EXT-006     |
| High-end Android              | 1 device                                  | Target 60 FPS                                 | Blocked by EXT-006     |
| Supported iPhone low baseline | 1 device                                  | Sustained 30 FPS                              | Blocked by EXT-006     |
| Current iPhone                | 1 device                                  | Target 60 FPS                                 | Blocked by EXT-006     |
| WeChat Developer Tools        | Windows simulator plus package inspection | Landscape, no missing assets, valid startup   | Blocked by EXT-001/006 |

## Mandatory scenarios

1. Cold start and first interaction in landscape, including safe areas and orientation recovery.
2. Aim-handle drag, precise buttons, power slider, explicit confirmation, cancellation, single-finger inspect, two-finger pan/zoom, and UI/aim/camera touch priority.
3. Actor/projectile/objective/boss camera requests, manual-inspection suppression, reduced motion, and zero shake mode.
4. Foreground/background, audio pause/resume, vibration off, network loss/recovery, offline screen, and retryable errors.
5. Every color-vision preset, high contrast, 80%-140% text, left/right UI, reduced flash, reduced motion, and minimum touch targets.
6. Thirty-minute battle soak with frame, memory, audio voice, particle, debris, and presentation-queue peaks.
7. Initial package, Asset Bundle/subpackage load, cache update, and a clean-install/update comparison.

Current state: no physical-device or Developer Tools evidence. Automated tests and synthetic telemetry are recorded in `PHASE_05_REPORT.md`, but they do not pass this matrix.

## Evidence record

Each row must link an immutable candidate commit/build hash and a dated record containing tester, device model/class, OS, WeChat/base-library/Developer Tools versions, renderer, available/peak memory, install and subpackage bytes, network profile, cold/interactive timings, 30-minute FPS/frame-time samples, frames over 100 ms, resume result, touch/input result, audio/visual-alternative result and accessibility preset results. Failures require an issue ID and rerun evidence. A screenshot or “works on my phone” note is not sufficient.

The QA owner may mark `device-matrix` passed in `config/release/release-evidence.json` only after every supported class and mandatory scenario is represented for the same immutable candidate. Current official package limits must be captured separately in `package-budget.json` with a verification date and authoritative source.
