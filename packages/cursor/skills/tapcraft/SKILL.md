---
name: tapcraft
description: Develop, port, debug, optimize, test, and publish Cocos Creator games for the TapCraft platform using com.amanotes.tapcraft-kit, AmaGDK, remote asset bundles, and the TapCraft MCP. Use for every task in a TapCraft game, whenever the user mentions TapCraft or tapcraft, when a project depends on com.amanotes.tapcraft-kit, or when working with tapcraft build, check, serve, pack, game.json, platform, content, saves, TapCraft performance budgets, or TapCraft publishing. TapCraft rules override generic Cocos guidance.
---

# TapCraft

TapCraft runs many games inside one shared Cocos engine. A normal Cocos solution can break the hub or the next game. **The TapCraft contract overrides generic Cocos defaults** for assets, content loading, lifecycle, exit, saves, platform services, engine modules, build settings, performance, and publishing.

## Start every TapCraft task

1. Run the bundled read-only version check:

   ```bash
   node <skill-directory>/scripts/check-updates.mjs
   ```

   It must not update the plugin, install packages, or edit the game. Work offline when the check cannot reach GitHub or npm.
2. Inspect `package.json`, `game.json`, and the current build before proposing changes.
3. Baseline contract: `com.amanotes.tapcraft-kit` **1.2.0**, also the minimum (AmaGDK 1.1.0), Cocos Creator **4.0.0-beta.1**, engine profile **8ec328**. Kit 1.2 adds `platform.system`, `platform.launch`, `hapticPattern` and unsubscribe functions from `onPause` / `onResume`, with no engine profile change: a game on an older kit updates with `npm install --save-dev com.amanotes.tapcraft-kit@1.2.0`, `npx tapcraft init` and a new build. Kit 1.1 and later require a storage-v4 app that injects `content.cdn`; it is incompatible with an old `content.server` app. Prefer a newer stable kit only after reading its changelog and confirming compatibility with the installed TapCraft app. Ask before changing an existing dependency.
4. Read only the references required by the task.

## Non-negotiable overrides

### Assets and content

- Game code uses the kit's `content`; do not call `assetManager.loadBundle` or invent another loader.
- Every Cocos asset belongs to a bundle. Keep boot, menu, first gameplay, shared UI/SFX, and everything needed in the first 30 seconds or offline in local bundles. Put later content in remote bundles.
- Remote bundles contain assets, never scripts. Load them by stable bundle name; the kit resolves dependencies, retries, references, cache, and release.
- Runtime JSON belongs under project `files/data/` and is read with `content.json`. Raw files belong under `files/assets/` and use `content.url`. Do not hard-code a CDN, content version, or storage path.
- Storage v4 root is `<cdn>miniapps/<slug>/`; the app injects `content.cdn`. Never use legacy `content.server` or `games/<slug>/files/`.
- Release dynamically loaded content with `content.release`; clear game-owned pools in `content.onLowMemory`.

Read [references/content-assets.md](references/content-assets.md).

### Runtime and platform

- Import only the kit modules `platform`, `content`, and `saves`. Game code never calls AmaGDK, native bridges, ad SDKs, payment SDKs, or the Cocos quit lifecycle directly.
- Boot order: `platform.init()` → first loading frame → `firstFrameReady()` → `hidePlatformLoadingScreen()` → load local core/menu → `gameReady()`.
- Exit with `platform.requestExit()`. Never call `game.end`, `director.end`, `game.restart`, `sys.close`, or native reflection/bridge APIs.
- Save with `saves`; never call `localStorage.clear()`. Pause gameplay and all audio for every `platform.onPause` reason (`hubMenu`, `background`, `ad`, `exit`, `system`); a component that subscribes calls the returned unsubscribe function in `onDestroy`.
- Wrap actual runs in `gameplayStart()` / `gameplayStop()` and close every pair.

Read [references/game-contract.md](references/game-contract.md) and [references/platform.md](references/platform.md).

### Build and verification

- Use `npx tapcraft build ios|android|all`; do not use a hand-written Cocos build configuration for a release.
- Run `npx tapcraft check` and resolve every error. Review every warning rather than suppressing it.
- Test through `npx tapcraft serve` on the internal app, including airplane mode, background/resume, ads, exit/relaunch, remote failure, frame time, and memory return.
- Pack target is 8 MB, hard limit 15 MB. First frame target is 1.5 s, playable target 3 s offline, gameplay p95 17 ms, and peak memory target 300 MB on low-tier devices.

Read [references/dev-loop.md](references/dev-loop.md) and [references/performance.md](references/performance.md).

### Publishing

- Only the TapCraft MCP writes platform storage. Do not upload with Firebase, GCS, or custom scripts.
- Build → check → upload `remote/`, `data/`, and any `assets/` used by `content.url` with MCP → `tapcraft pack all` → create builds → create/update version → show final state → ask before publish.
- Always ask before `publish_version`, `unpublish`, `delete_files`, `delete_version`, `move_game`, or changing membership/roles.
- The MCP prompts and resources are authoritative when they differ from prose bundled in this plugin.

Read [references/publishing.md](references/publishing.md).

## Task routing

| Task | Read |
|---|---|
| Rules, forbidden APIs, lifecycle, storage, `game.json` | [references/game-contract.md](references/game-contract.md) |
| Local/remote split, loaders, storage v4, release | [references/content-assets.md](references/content-assets.md) |
| AmaGDK surfaces, ads, unavailable capabilities | [references/platform.md](references/platform.md) |
| Build, check, serve, device checklist | [references/dev-loop.md](references/dev-loop.md) |
| Startup, pack size, frame time, memory | [references/performance.md](references/performance.md) |
| MCP uploads, builds, versions, store page | [references/publishing.md](references/publishing.md) |
| Cocos 4 pitfalls specific to TapCraft | [references/cocos.md](references/cocos.md) |
| Boot component example | [templates/boot.ts](templates/boot.ts) |

## Completion standard

A change is not done because it works in Preview. It is done when the native TapCraft build passes `tapcraft check`, remains playable offline from the pack, handles remote failure, obeys lifecycle/save/exit rules, stays within budgets, and has no undocumented platform dependency.
