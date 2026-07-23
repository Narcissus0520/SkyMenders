# Third-Party SDK Inventory

Status: source inventory complete for Phase 10; final Cocos export and WeChat package network inspection remain blocked by `EXT-006`.

| Component                     | Product purpose                                                         | Runtime data                                        | Client secret  | Release decision                                            |
| ----------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------- | -------------- | ----------------------------------------------------------- |
| Cocos Creator 3.8 LTS runtime | Rendering, input, audio and resource loading                            | Device/runtime data exposed by the engine           | None           | Required; verify final exported runtime and license notices |
| WeChat Mini Game APIs         | Login-code acquisition, storage, network state, lifecycle and vibration | Login code, network state and platform runtime data | Prohibited     | Required; enable only declared APIs                         |
| SkyMenders first-party API    | Auth, saves, daily challenge, leaderboard and deletion                  | Inventory-listed account/game data                  | None in client | Required; production domains/TLS pending                    |

No advertising, attribution, social graph, analytics, crash-reporting, payment, chat, location, camera, microphone or contact SDK is approved for V1. Transitive build dependencies are not automatically approved as runtime SDKs. Before launch, capture the final package dependency inventory, permissions, outbound hosts and privacy disclosures; any undeclared SDK or host blocks release.
