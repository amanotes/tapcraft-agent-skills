# Platform services and AmaGDK

Game code calls the kit's `platform`; only the kit talks to AmaGDK. Keep platform calls behind small game-owned adapters so tests can use fakes.

```ts
await platform.init();
platform.firstFrameReady();
platform.hidePlatformLoadingScreen();
platform.gameReady();

const offPause = platform.onPause((reason) => app.pause(reason)); // hubMenu | background | ad | exit | system
const offResume = platform.onResume(() => app.resume());         // call both in onDestroy
platform.gameplayStart();
platform.gameplayStop();
const result = await platform.showRewarded('revive');           // no timeout: settles when the ad closes
platform.haptic('light');                                       // light | medium | heavy | rigid | soft | success | warning | error | selection
platform.hapticPattern([{ time: 0, intensity: 1 }]);            // ≤ 2 s, ≤ 16 events
const { platform: os, locale, country, deviceTier, safeArea } = platform.system;
platform.launch?.source;                                        // explore | search | continue | deeplink | push | staging | dev
platform.requestExit();
```

## Supported baseline

| Surface | Kit 1.2 baseline |
|---|---|
| Lifecycle and exit, memory warning | supported |
| Rewarded/interstitial ads | supported; handle every outcome. During development every app build serves a test ad (full-screen "Mock Ad", 3 s countdown, always ready) |
| Saves | supported through `saves` |
| `platform.system`: platform, locale, country, device tier, safe area | supported; device tier from device RAM (older app builds report `mid`), safe area in points (iOS) / dp (Android) |
| `platform.launch` | supported |
| Audio enabled | always `true` (the app has no sound setting yet) |
| Haptics (`haptic`, `hapticPattern`) | supported on devices with a haptic engine or vibrator; no-op elsewhere |
| Banner, low-latency audio, IAP, analytics, remote config, sharing, cloud saves | `@experimental` in the types: do not assume availability |

Types do not prove a capability is enabled; members marked `@experimental` in `amagdk.d.ts` answer `unavailable` or a default today. Handle `unavailable`, `cancelled`, `skipped`, `noFill`, and `error`. Platform calls should not crash gameplay when unavailable.

## Ads

- Placements are logical names such as `revive` and `level_end`.
- Rewarded is opt-in. Show the reward before the ad and grant only on `granted`.
- Interstitials occur only at natural breaks, never before first gameplay or while gameplay is active.
- Make at most one ad request at a time. Ad calls have no timeout: they settle when the ad closes (or `error` when the session ends). If a flow must not wait, race the call against your own timer and keep the UI consistent when the late result arrives.
- Pause all gameplay and audio while the platform reports pause reason `ad`.
- Do not add a second pacing/capping policy; the platform owns it.

## Unavailable capabilities

Create adapters with no-op/unavailable behavior rather than calling native APIs:

- low-latency or sample-accurate audio;
- in-app purchases;
- analytics and remote config;
- sharing and external URLs.

When a newer kit advertises one of these, read its changelog and platform contract before using it. Do not infer behavior from generic AmaGDK documentation.
