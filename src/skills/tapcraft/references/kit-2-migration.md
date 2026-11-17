# Porting a kit 1.x game to kit 2.0

Summary of the kit's `docs/migration-2.md`. Kit 2.0 speaks **protocol 2**: the 2.0 app hides games built with kit 1.x until they are rebuilt with kit 2 and republished. One facade, `Tapcraft`, replaces `platform`, `saves`, `content` and AmaGDK; nothing of the old runtime stays.

**Kit 1.x saves are not migrated** (engine `localStorage` is not read): players of the republished game start empty. Tell the user and get a decision before publishing; there is no tool or flag for it.

## Steps

1. `npm i -D com.amanotes.tapcraft-kit@^2 && npx tapcraft init`. `init` adds `"postinstall": "tapcraft sync"`, writes `assets/tapcraft/` + `tapcraft.lock.json`, and removes `assets/scripts/hub/` when it holds only kit files (otherwise `sync` names your files: move them out, delete the folder).
2. Replace imports: `import { platform } from './hub/platform'` → `import { Tapcraft } from '../tapcraft/index'` (relative to the script; `assets/scripts/ui/x.ts` → `../../tapcraft/index`). Same for `saves`, `content`, `vendor/amagdk`.
3. Apply the mapping below. `npx tapcraft check` lists every leftover (`localStorage`, `AmaGDK`, `./hub/*`, `__AMA_GDK__`, `jsbBridgeWrapper`).
4. `npx tapcraft build ios && npx tapcraft check`, test on a device (`tapcraft serve`), `tapcraft pack all`, publish a new build and version through the MCP ([publishing.md](publishing.md)).
5. Commit `assets/tapcraft/`; remove `legacyKeys` from `game.json` (ignored).

## Mapping

| Kit 1.x | Kit 2.0 |
|---|---|
| `await platform.init()` (boolean) | `await Tapcraft.init()` → `{ ok, host, storage, modules }` |
| `platform.firstFrameReady/hidePlatformLoadingScreen/gameReady/gameplayStart/gameplayStop/requestExit` | `Tapcraft.lifecycle.<same name>` |
| `platform.onPause/onResume` | `Tapcraft.lifecycle.onPause/onResume` (still return unsubscribe); also `onBeforeUnload`, `onMemoryWarning` |
| `platform.game`, `platform.launch` | `Tapcraft.game`, `Tapcraft.launch` |
| `platform.showRewarded(p)` → string | `await Tapcraft.ads.showRewarded(p)` → `{ outcome }` (read `.outcome`) |
| `platform.showInterstitial(p)` → string | `await Tapcraft.ads.showInterstitial(p)` → `{ outcome }` |
| `platform.isAdReady(f, p)` | `Tapcraft.ads.isReady(f, p)` |
| `platform.haptic('light'…'soft')` | `Tapcraft.caps.haptics.impact(style)`; `success/warning/error` → `notify(type)`; `selection` → `selection()` |
| `platform.hapticPattern(e)` | `Tapcraft.caps.haptics.pattern(e)` |
| `platform.audioEnabled` | `Tapcraft.system.audioEnabled` (+ `onAudioEnabledChange`) |
| `platform.system.*` | `Tapcraft.system.*` |
| `saves.get/set/remove/keys/clear/getJson/setJson/schema/setSchema` | `Tapcraft.storage.<same>` (+ `has`); writes return `false` when refused |
| `saves.flush()` (sync) | `await Tapcraft.storage.flush()` → `{ status, revision, code }` |
| `localStorage.*`, `sys.localStorage.*` | `Tapcraft.storage.*` |
| `content.*` | `Tapcraft.content.*` (same semantics) |
| `AmaGDK.*`, `gdk.*`, `Ads.Default`, `Haptics.Native` | the matching `Tapcraft.*` module |
| `globalThis.__AMA_GDK__` | gone; read `Tapcraft.game` / `Tapcraft.launch` |

## Behavior changes to test

- Storage is in memory with a native commit (1 s after a change, on pause, before unload); `flush()` at milestones. `status === 'unavailable'` means reads return `null` and writes return `false`.
- Async calls resolve, never reject; `unavailable` and `error` are values, also outside the app.
- Before `await Tapcraft.init()` resolves, calls answer `unavailable`.
- Ads have no SDK timeout (as in kit 1.2).
- Boot with `Boot.ts` from [../templates/boot.ts](../templates/boot.ts) as the model.
