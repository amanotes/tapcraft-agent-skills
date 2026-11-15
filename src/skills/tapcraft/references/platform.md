# Platform services and AmaGDK

Game code calls the kit's `platform`; only the kit talks to AmaGDK. Keep platform calls behind small game-owned adapters so tests can use fakes.

```ts
await platform.init();
platform.firstFrameReady();
platform.hidePlatformLoadingScreen();
platform.gameReady();

platform.onPause((reason) => app.pause(reason));
platform.onResume(() => app.resume());
platform.gameplayStart();
platform.gameplayStop();
const result = await platform.showRewarded('revive');
platform.requestExit();
```

## Supported baseline

| Surface | Kit 1.1 baseline |
|---|---|
| Lifecycle and exit | supported |
| Rewarded/interstitial ads | supported; handle every outcome |
| Saves | supported through `saves` |
| Platform, locale, country, audio enabled | supported |
| Device tier | may be a placeholder |
| Safe area | use Cocos `sys.getSafeAreaRect()` when snapshot values are absent |
| Banner, haptics, low-latency audio, IAP, analytics, remote config, sharing | do not assume availability |

Types do not prove a capability is enabled. Handle `unavailable`, `cancelled`, `skipped`, `noFill`, and `error`. Platform calls should not crash gameplay when unavailable.

## Ads

- Placements are logical names such as `revive` and `level_end`.
- Rewarded is opt-in. Show the reward before the ad and grant only on `granted`.
- Interstitials occur only at natural breaks, never before first gameplay or while gameplay is active.
- Make at most one ad request at a time.
- Pause all gameplay and audio while the platform reports pause reason `ad`.
- Do not add a second pacing/capping policy; the platform owns it.

## Unavailable capabilities

Create adapters with no-op/unavailable behavior rather than calling native APIs:

- haptics;
- low-latency or sample-accurate audio;
- in-app purchases;
- analytics and remote config;
- sharing and external URLs.

When a newer kit advertises one of these, read its changelog and platform contract before using it. Do not infer behavior from generic AmaGDK documentation.
