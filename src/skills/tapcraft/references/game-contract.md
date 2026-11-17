# TapCraft game contract

## Compatibility

| Contract | Baseline |
|---|---|
| Kit | `com.amanotes.tapcraft-kit` 2.0.0 (SDK 2, protocol 2) |
| Engine | Cocos Creator 4.0.0-beta.1 |
| Engine profile | `8ec328` |
| Protocol | 2: the pack carries `tapcraft.json` `{ kit, protocol, sdk }`; the 2.0 app hides games built with kit 1.x until they are republished |
| Orientation | portrait, 9:16 through 9:21 |
| Start scene | `db://assets/boot/boot.scene` unless `game.json.startScene` overrides |
| Graphics | iOS Metal; Android GLES3/GLES2, arm64 |

`tapcraft build` owns engine modules, `md5Cache`, texture presets, release/debug settings, source maps, and the native application template. A game cannot add native code or enable a module absent from the profile.

## Forbidden APIs

| Do not use | Use instead |
|---|---|
| `game.end`, `director.end`, `game.restart`, `sys.close`, quit UI | `Tapcraft.lifecycle.requestExit()` |
| `assetManager.loadBundle`, custom remote loaders, `jsb.AssetsManager` | `Tapcraft.content` |
| `setSearchPaths`, `setWritablePath`, absolute paths | app sandbox and kit APIs |
| `native.reflection`, `native.bridge`, `jsb.reflection`, `jsb.jsbBridgeWrapper`, `__tapcraftBridge` | the matching `Tapcraft.*` module |
| native libraries or third-party ads/analytics/payment SDKs | request a platform capability |
| `AmaGDK`, `__AMA_GDK__`, `vendor/amagdk`, imports of `./hub/platform`, `./hub/saves`, `./hub/content` (kit 1.x, removed) | `import { Tapcraft } from '../tapcraft/index'` |
| `eval`, `new Function`, downloaded code, scripts in remote bundles | all code in the pack |
| `localStorage`, `sys.localStorage` (any use) | `Tapcraft.storage` |
| editing `assets/tapcraft/` | `npx tapcraft sync`; it is kit-owned and locked |

## Lifecycle

Every launch is a cold launch. Keep module initialization cheap.

1. `await Tapcraft.init()` (loads saves, wires lifecycle).
2. Draw the small local loading scene.
3. Call `Tapcraft.lifecycle.firstFrameReady()`.
4. After that scene has drawn, call `Tapcraft.lifecycle.hidePlatformLoadingScreen()`.
5. Read saves, load local core/menu.
6. Call `Tapcraft.lifecycle.gameReady()` only when the menu accepts input.

On every pause reason, stop input, gameplay, timers, physics, tweens, and all audio. Resume only from `onResume`. `onBeforeUnload` is synchronous and short; do not wait for promises. The SDK flushes saves (pause, before unload, exit) and the content cache index.

Wrap each level, song, or run in `Tapcraft.lifecycle.gameplayStart()` and `gameplayStop()`. Interstitials are skipped while gameplay is open.

## Saves

- Use `Tapcraft.storage` (`get/set/remove/has/keys/clear`, `getJson/setJson`, `flush`). Reads and writes are in memory; the SDK commits to the device off the JS thread (1 s after a change, on pause, before unload). `await Tapcraft.storage.flush()` at milestones.
- One value is at most 1 MiB; one game is at most 5 MiB. Writes return `false` when refused or when `storage.status` is not `ready`.
- Use `storage.schema` and `setSchema` for migrations; production saves must remain readable.
- Kit 1.x saves (engine `localStorage`) are **not** migrated to kit 2; `game.json` `legacyKeys` is removed.
- No cloud sync is guaranteed. Large levels/replays are content, not saves.

## Network and security

- The installed pack must reach menu and first gameplay offline.
- HTTPS only. Never collect identifiers, contacts, or location.
- Do not link to external stores or imitate the hub UI.
- Every `Tapcraft` call resolves with a value; handle unavailable, cancellation, no-fill, and error as normal outcomes. Ad calls have no timeout (they settle when the ad closes); add your own deadline where a flow must not wait.

## `game.json`

```json
{
  "id": "beat-star",
  "orientation": "portrait",
  "local": ["main", "core"],
  "prefetch": [],
  "budgets": { "packMB": 8 }
}
```

`id` is the permanent platform slug (`^[a-z0-9][a-z0-9-]{1,39}$`),
catalog id, storage folder, and save namespace. Confirm it before first platform
creation. `local` lists every bundle needed by the start scene and
offline-first path. `prefetch` is a manifest hint/allowlist; it does not start
downloads by itself. Game code still calls `Tapcraft.content.prefetch()` after the menu
is ready.
