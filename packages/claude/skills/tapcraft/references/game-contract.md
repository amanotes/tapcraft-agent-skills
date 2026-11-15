# TapCraft game contract

## Compatibility

| Contract | Baseline |
|---|---|
| Kit | `com.amanotes.tapcraft-kit` 1.1.0 |
| Engine | Cocos Creator 4.0.0-beta.1 |
| Engine profile | `8ec328` |
| Orientation | portrait, 9:16 through 9:21 |
| Start scene | `db://assets/boot/boot.scene` unless `game.json.startScene` overrides |
| Graphics | iOS Metal; Android GLES3/GLES2, arm64 |

`tapcraft build` owns engine modules, `md5Cache`, texture presets, release/debug settings, source maps, and the native application template. A game cannot add native code or enable a module absent from the profile.

## Forbidden APIs

| Do not use | Use instead |
|---|---|
| `game.end`, `director.end`, `game.restart`, `sys.close`, quit UI | `platform.requestExit()` |
| `assetManager.loadBundle`, custom remote loaders, `jsb.AssetsManager` | kit `content` |
| `setSearchPaths`, `setWritablePath`, absolute paths | app sandbox and kit APIs |
| `native.reflection`, `native.bridge`, `jsb.reflection` | kit `platform` |
| native libraries or third-party ads/analytics/payment SDKs | request a platform capability |
| `eval`, `new Function`, downloaded code, scripts in remote bundles | all code in the pack |
| `localStorage.clear()` | kit `saves.clear()` |

## Lifecycle

Every launch is a cold launch. Keep module initialization cheap.

1. `await platform.init()`.
2. Draw the small local loading scene.
3. Call `platform.firstFrameReady()`.
4. After that scene has drawn, call `platform.hidePlatformLoadingScreen()`.
5. Load saves and local core/menu.
6. Call `platform.gameReady()` only when the menu accepts input.

On every pause reason, stop input, gameplay, timers, physics, tweens, and all audio. Resume only from `onResume`. `onBeforeUnload` is synchronous and short; do not wait for promises. The kit flushes saves and its content cache.

Wrap each level, song, or run in `gameplayStart()` and `gameplayStop()`. Interstitials are skipped while gameplay is open.

## Saves

- Use `saves.get/set/getJson/setJson/remove/keys/clear`.
- One value is at most 1 MiB; one game is at most 5 MiB.
- Use `saves.schema` and `setSchema` for migrations; production saves must remain readable.
- `game.json.legacyKeys` can migrate known old unprefixed values once.
- No cloud sync is guaranteed. Large levels/replays are content, not saves.

## Network and security

- The installed pack must reach menu and first gameplay offline.
- HTTPS only. Never collect identifiers, contacts, or location.
- Do not link to external stores or imitate the hub UI.
- Handle timeout, unavailable, cancellation, and no-fill as normal outcomes.

## `game.json`

```json
{
  "id": "beat-star",
  "orientation": "portrait",
  "local": ["main", "core"],
  "prefetch": [],
  "budgets": { "packMB": 8 },
  "legacyKeys": []
}
```

`id` is the permanent platform slug (`^[a-z0-9][a-z0-9-]{1,39}$`),
catalog id, storage folder, and save prefix. Confirm it before first platform
creation. `local` lists every bundle needed by the start scene and
offline-first path. `prefetch` is a manifest hint/allowlist; it does not start
downloads by itself. Game code still calls `content.prefetch()` after the menu
is ready.
