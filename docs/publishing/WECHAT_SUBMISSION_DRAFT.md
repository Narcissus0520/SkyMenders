# WeChat Mini Game Submission Draft

Status: engineering-complete draft; external product, legal, art, QA, and platform fields remain blocked. This document is not a submission authorization.

## Product copy

- Public name: pending trademark and platform-similarity decision (`EXT-004`). Do not submit the internal SkyMenders / Project Skyforge working identifiers as a cleared brand.
- Category: original landscape 2D turn-based engineering tactics roguelite.
- Short description: lead three small engineering robots across floating islands, using construction, repair, terrain control, and deterministic ballistics to complete rescue and maintenance missions.
- Monetization: none in V1.0; no ads, purchases, paid pass, loot boxes, or cash transactions.
- Social features: no free-text nickname, chat, voice, friend import, user avatar, or public personal profile.
- Animation scope: gameplay feedback and procedural action only; no story video, lip sync, or voiced cinematics.

## Data and permissions

- Login uses the server-side WeChat code exchange only. The client contains no AppSecret.
- No contacts, precise location, microphone, camera, album, phone number, WeChat nickname/avatar, advertising identifier, or cross-app tracking is requested.
- Public ranking shows only a server-generated codename, original robot avatar, score, time, rounds, and completion state.
- Account deletion and data deletion routes are implemented; deployed end-to-end evidence requires `EXT-001` and `EXT-002`.
- Policy text must be replaced by qualified approved Chinese text and published URLs before submission (`EXT-003`).

## Required attachments

| Attachment                                                                     | Current state                    |
| ------------------------------------------------------------------------------ | -------------------------------- |
| Approved icon, screenshots, feature graphic, fonts, music and SFX provenance   | Blocked by `EXT-005`             |
| Compiled WeChat package and current official size-limit capture                | Blocked by `EXT-001` / `EXT-006` |
| Developer Tools validation and signed real-device matrix                       | Blocked by `EXT-006`             |
| Operating entity, AppID, domain and platform configuration                     | Blocked by `EXT-001` / `EXT-002` |
| Publishing, filing, anti-addiction, age-rating, privacy and agreement decision | Blocked by `EXT-003`             |
| Public-name search and approval                                                | Blocked by `EXT-004`             |

## Reviewer walkthrough

1. Launch in landscape and complete the six short tutorials.
2. Start a standard expedition, select three robots, complete a node, and resume from a node save.
3. Demonstrate construction, repair, terrain destruction, collapse, precision aiming, accessibility settings, and reduced camera motion.
4. Open privacy policy and user agreement from the main menu without network access.
5. Start a daily practice run, then a scored attempt, and show the anonymous leaderboard.
6. Open account controls and demonstrate deletion in the approved staging environment.

## Submission checklist

The release owner must run `pnpm release:gate` on the exact tag commit. The evidence manifest candidate version and 40-character commit must match the workflow ref. A green engineering PR, this draft, or a locally generated source package is insufficient.
