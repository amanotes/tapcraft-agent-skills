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

Outcomes: `showRewarded` → `granted | cancelled | noFill | unavailable | error`; `showInterstitial` → `shown | skipped | noFill | unavailable | error`. `platform.isAdReady(format, placement)` is a hint for the UI, not a guarantee.

### Rewarded (RW): revive offer

```ts
import { _decorator, Component, Node, Button } from 'cc';
import { platform } from './hub/platform';         // assets/scripts/hub is kit-owned
const { ccclass, property } = _decorator;

@ccclass('ReviveOffer')
export class ReviveOffer extends Component {
    @property(Node) adIcon: Node | null = null;     // "watch ad" badge on the button
    @property(Button) reviveButton: Button | null = null;
    onRevive: () => void = () => {};                // set by the gameplay controller
    onMessage: (text: string) => void = () => {};
    private busy = false;                           // one ad request at a time

    show(): void {
        // The player is already out of the run: gameplayStop() was called on death.
        this.node.active = true;
        if (this.adIcon) this.adIcon.active = platform.isAdReady('rewarded', 'revive');
    }

    async onReviveTap(): Promise<void> {
        if (this.busy) return;
        this.busy = true;
        if (this.reviveButton) this.reviveButton.interactable = false;
        const outcome = await platform.showRewarded('revive');   // settles when the ad closes
        this.busy = false;
        if (!this.node.isValid) return;                           // scene changed meanwhile
        if (this.reviveButton) this.reviveButton.interactable = true;

        if (outcome === 'granted') {
            this.node.active = false;
            this.onRevive();                                      // grant only on 'granted'
            platform.gameplayStart();                             // reopen the run
        } else if (outcome === 'noFill' || outcome === 'unavailable' || outcome === 'error') {
            this.onMessage('No video available right now');       // offer stays; player may skip
        }
        // 'cancelled': player closed the ad early, no reward, keep the offer on screen
    }
}
```

### Interstitial (IS): natural break after a level

```ts
async function onLevelComplete(level: number): Promise<void> {
    platform.gameplayStop();                         // interstitials are skipped while gameplay is open
    await showResultScreen(level);                   // player sees the result first
    await platform.showInterstitial('level_end');    // every outcome continues: shown | skipped | noFill | unavailable | error
    goToNextLevelOrMenu();
}
```

- Never show an interstitial before the first gameplay, on boot, or in the middle of a run.
- Do not check `isAdReady` or count levels before an interstitial; the platform paces and caps (`skipped`).
- Audio and timers stop through `onPause('ad')` and restart in `onResume`, not around the `await`.

### When a flow must not wait

```ts
const timeout = new Promise<'timeout'>((ok) => setTimeout(() => ok('timeout'), 8000));
const outcome = await Promise.race([platform.showRewarded('double_coins'), timeout]);
// On 'timeout' continue without the reward; if the late result is 'granted', grant it then
// (or document why not) so the UI never shows a reward the player did not get.
```

## Unavailable capabilities

Create adapters with no-op/unavailable behavior rather than calling native APIs:

- low-latency or sample-accurate audio;
- in-app purchases;
- analytics and remote config;
- sharing and external URLs.

When a newer kit advertises one of these, read its changelog and platform contract before using it. Do not infer behavior from generic AmaGDK documentation.
