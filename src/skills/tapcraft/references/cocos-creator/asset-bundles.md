# Asset Bundles, remote assets, caching, releasing (Cocos Creator 4.0)

Source: manual `asset/bundle`, `asset-manager`, `dynamic-load-resources`, `preload-load`, `release-manager`, `cache-manager`, `downloader-parser`, `options`, `pipeline-task`, `editor/publish/build-guide`, `build-options`, `advanced-topics/hot-update*`. Lines marked **[4.0 src]** were checked against the 4.0.0-beta.1 engine/builder source and real build output; they override the manual, which is largely 3.8 text.

> **TapCraft:** this is the engine reference behind the kit's `content` loader. Game code still loads bundles, assets and JSON through `content` (see [content-assets](../content-assets.md)); never call `assetManager.loadBundle`, `loadRemote`, `cacheManager.clearCache()` or `native.AssetsManager` in a TapCraft game. Use this page to understand bundle layout, priorities, the disk cache and releasing. Full manual: <https://docs.cocos.com/creator/4.0/manual/en/asset/bundle.html>, <https://docs.cocos.com/creator/4.0/manual/en/asset/cache-manager.html>, <https://docs.cocos.com/creator/4.0/manual/en/asset/release-manager.html>.

## 1. Mental model

- Everything ships as bundles. Built-ins: `internal` (engine defaults, priority 21), `start-scene` (20, mini-games only), `resources` (8), `main` (7: scenes ticked in Build panel + deps). Never name a custom bundle `internal|resources|main|start-scene`.
- A bundle = a folder with **Is Bundle** ticked. Built bundle = `config` (manifest: paths, uuids, deps, packs, versions) + `index.js` (bundle scripts) + `import/` (serialized JSON) + `native/` (raw files: png, mp3, bin…).
- `loadBundle` downloads only the manifest + scripts. Assets come later via `bundle.load*`.
- The bundle folder should hold **entry assets** (scenes, prefabs, things you load by path). Their dependencies outside the folder are pulled in automatically. Do not dump every texture into the folder: only paths directly inside a bundle folder are written to its config, and loose assets bloat it.
- No nesting: a bundle folder must not contain another bundle folder.
- Assets referenced by nothing and outside any bundle/scene are not built → loading them by path gives a 404 at runtime.

## 2. Config (editor Inspector → folder → Is Bundle)

| Option | Notes |
|---|---|
| Bundle Name | default = folder name. Keep stable, lowercase. Name is the cache key at runtime (§4). |
| Priority (1–20) | Decides where a **shared** dependency lives (below). |
| Compression Type | `merge_dep` (default), `none`, `merge_all_json`, `subpackage` (mini-game only), `zip` (mini-game only). |
| Is Remote | built into `remote/<name>/` instead of `assets/<name>/`; you upload `remote/`. |
| Bundle Filter Config | include/exclude rules (Asset or URL: glob / begins / ends / contains); **Preview** shows the final list. |
| Build Bundle (3.8+) | build one bundle without a full build (also CLI `--build "stage=bundle;configPath=…"`). |

**[4.0 src]** Project files instead of 3.8's `settings/v2/packages/builder.json`:
- folder `.meta` → `userData: { isBundle: true, bundleName, priority, bundleConfigID }`. Edit `userData` only, never the `uuid`.
- `settings/cocos.config.json` → `builder.bundleConfig.custom.<id>.configs.{native|web|miniGame}` → `preferredOptions: { isRemote, compressionType }` (+ optional `fallbackOptions`, `configMode: auto|fallback|overwrite`, `overwriteSettings` per platform). Unknown `bundleConfigID` → builder warns and uses the default (local, `merge_dep`).
- Native and web-mobile accept only `none | merge_dep | merge_all_json`. **Zip is not available on native.**

### Priority / shared assets
- Asset used by bundles of **different** priority → stored once in the **higher** priority bundle; the lower one records a dependency (`config.deps` + a `redirect` per shared asset) and **you must load the higher bundle first**. **[4.0 src]** Nothing loads `deps` for you: loading a redirected asset throws `Please load bundle <x> first`. Read `bundle.deps` and load them before `bundle.load*`.
- Same priority → **copied into each** bundle (no deps, bigger total size).
- So: put shared atlases/audio in a dedicated higher-priority "core" bundle, or keep them local. Keep custom priorities ≤ 7 so built-ins (main 7, resources 8) keep shared engine/UI assets.

### Compression types
- `merge_dep`: JSON of an asset merged with its deps → fewer requests, still per-asset loading. Best default for remote.
- `merge_all_json`: one JSON for the whole bundle → fewest requests but every first load parses everything. Only for small bundles always loaded whole.
- `none`: one file per asset; useful while debugging.

### Scripts in bundles
- All scripts in a bundle folder are merged into its `index.js` and removed from main. Scripts in different bundles should not import each other (share via a global namespace if unavoidable).
- "Embed Shared Script in Bundle" (Bundle Build only): off → shared code goes to `src/chunks/bundle.js` (bundle only works inside this project); on → self-contained but bigger.
- Policy for remote content: keep **all code local**, remote bundles hold assets only (iOS review + no downloaded code). Prefabs in remote bundles may reference components whose scripts are in `main`.
- **[4.0 src]** On native the bundle `index.js` is fetched only when `config.hasPreloadScript` is true (`.jsc` when encrypted).

### Atlases in bundles
- Auto Atlas (`.pac`) packs all SpriteFrames in its folder **at build time only** (editor/preview use loose images). If the `.pac` sits inside a bundle folder, the loose Texture2D/Image are also exported → bigger bundle. Tick the "Remove unused texture/image/sprite atlas in Bundle" options, or keep the `.pac` outside and let bundle entries pull it in by reference.

## 3. Build output and URLs

```
<build>/data/assets/<bundle>/   local bundles      (native: data/; web: build root)
<build>/data/remote/<bundle>/   Is Remote bundles  → upload the whole remote/ folder
<build>/data/src/settings.json  assets.server, assets.remoteBundles, assets.bundleVers, projectBundles, preloadBundles
```
- **[4.0 src]** Native bundles use `cc.config[.<md5>].json`; web uses `config[.<md5>].json`. Do not hardcode the manifest filename in tools; detect either.
- **[4.0 src]** `settings.json` is categorized: the server address is `assets.server`, not top-level `server` as the manual's build-guide shows.
- Runtime URL resolution **[4.0 src]** (`downloader.ts`, native adapter):
  - `loadBundle('name')` → if `name` ∈ `remoteBundles`: `<server>remote/<name>`; else `assets/<name>`.
  - `loadBundle('https://cdn/x/remote/name')` → used as is (full URL bypasses `server`). Lets one build point at many CDNs/versions.
  - Native also accepts an absolute path under `native.fileUtils.getWritablePath()` (bundle you downloaded yourself; structure must be identical to the built bundle).
  - Version: `options.version` or `settings.assets.bundleVers[name]` → `cc.config.<ver>.json` / `index.<ver>.js`.
- **Resource Server Address** in the Build panel = `assets.server` (needs trailing `/`). Remote bundle + empty server → builder warns; fine if you always load by full URL.
- **MD5 Cache** renames every file with a content hash and records versions in `bundleVers` + each bundle's `versions`. Turn it on for web/CDN cache busting. Native hot-update (`AssetsManager`) samples say turn it **off**. Third-party code that builds asset URLs by hand breaks with md5: convert with `assetManager.utils.getUrlWithUuid(assetManager.utils.getUuidFromURL(url))`.
- Release builds compress UUIDs in configs (`Build.Utils.decompressUuid('425o80X…')` in Build DevTools to decode). Engine is cached per (debug, modules, sourceMaps, platform, engine version).

## 4. Loading API (callback-only; wrap in Promises yourself)

```ts
import { assetManager, AssetManager, resources, Prefab, SpriteFrame, Texture2D, ImageAsset, director, instantiate } from 'cc';

const loadBundle = (nameOrUrl: string, opts: Record<string, any> = {}) =>
  new Promise<AssetManager.Bundle>((ok, ko) => assetManager.loadBundle(nameOrUrl, opts, (e, b) => (e ? ko(e) : ok(b))));

const load = <T extends import('cc').Asset>(b: AssetManager.Bundle, path: string, type: new () => T,
  onProgress?: (done: number, total: number) => void) =>
  new Promise<T>((ok, ko) => b.load(path, type, onProgress ?? null, (e, a) => (e ? ko(e) : ok(a))));
```

| Need | Call |
|---|---|
| Bundle | `assetManager.loadBundle(nameOrUrl, {version?}, cb)`; `assetManager.getBundle(name)`; `assetManager.removeBundle(b)` |
| One asset | `bundle.load(path, Type, onProgress?, cb)` — path relative to bundle, **no extension** |
| Many | `bundle.load([paths], Type, …)`, `bundle.loadDir(dir, Type, …)` |
| Scene | `bundle.loadScene(name, cb)` then `director.runScene(scene)` (does not auto-run). `director.loadScene` only finds scenes in loaded bundles. |
| Download only | `bundle.preload / preloadDir / preloadScene` (no parse, low priority) then `load` later reuses the bytes |
| Lookup | `bundle.get(path, Type)` (already loaded), `getInfoWithPath`, `getDirWithPath` (paths list) |
| Arbitrary URL / device file | `assetManager.loadRemote<ImageAsset>(url, {ext: '.png'}, cb)` |
| resources | same API on `resources` (it is just the built-in bundle) |

Rules that bite:
- **Sub-assets need the sub path and type**: image → `img/spriteFrame` + `SpriteFrame`, `img/texture` + `Texture2D`; loading `img` gives an `ImageAsset`. Model parts: `Monster/monster` (Mesh), `Monster/Armature` (Skeleton)…
- Same name, different types in one folder (`player.anim` + `player.png`) → always pass the type.
- TexturePacker `.plist` atlas: load the `SpriteAtlas` then `atlas.getSpriteFrame(name)`.
- `loadRemote` gives raw types only (ImageAsset, AudioClip, TextAsset, JsonAsset). No SpriteFrame/Atlas/Prefab/TiledMap from a raw URL; use a bundle for that. Build a SpriteFrame yourself:
  ```ts
  const tex = new Texture2D(); tex.image = imageAsset; const sf = new SpriteFrame(); sf.texture = tex;
  ```
  URL without extension → pass `{ext: '.png'}`. Web: needs CORS on the server.
- `loadDir` callback no longer returns paths; use `getDirWithPath`.
- No global `onProgress`; pass a progress callback per call.
- **[4.0 src]** `loadBundle` caches by `path.basename(nameOrUrl)`. Loading `https://cdn/v2/remote/levels` while `levels` from v1 is loaded returns the **old** bundle. To switch versions: release its assets, `removeBundle`, then load the new URL.
- Bundle deps are not auto-loaded (§2). After `loadBundle`, for each name in `bundle.deps` not in `assetManager.bundles`, load it (by name, or by full URL from the same base when you load remote bundles by URL), then load assets.

## 5. Download tuning and priorities

**[4.0 src]** defaults (manual numbers are 3.x):

| Setting | 4.0 default |
|---|---|
| `downloader.maxConcurrency` | 15 (or `settings.assets.downloadMaxConcurrency`) |
| `downloader.maxRequestsPerFrame` | 15 |
| `downloader.maxRetryCount` / `retryInterval` | 3 in builds (0 in editor) / 2000 ms |
| presets `preload` / `scene` / `bundle` / `remote` | 6 conc, 2 per frame, prio −1 / 20, 20, prio 1 / 20, 20, prio 2 / retry 4 |
| native `jsb.Downloader` | 32 tasks, 30 s timeout; set via `settings.assets.jsbDownloaderMaxTasks` / `jsbDownloaderTimeout` (not by editing main.js in 4.0) |

- Priority: bundle/script 2 > scene 1 > manual load 0 > preload −1. Override per call: `{priority: 3}`.
- Option precedence: per-call options > preset (`assetManager.presets.x`, or your own + `{preset: 'x'}`) > downloader/parser globals.
- Reserved option names (don't reuse for custom params): `uuid url path dir scene type priority preset audioLoadMode ext bundle onFileProgress maxConcurrency maxRequestsPerFrame maxRetryCount version xhrResponseType xhrWithCredentials xhrMimeType xhrTimeout xhrHeader reloadAsset cacheAsset cacheEnabled`.
- Byte-level progress for big files: `{onFileProgress: (loaded, total) => …}`.
- Custom formats: `assetManager.downloader.register('.ext', (url, opts, cb) => …)` + `assetManager.parser.register('.ext', (file, opts, cb) => …)`; extension must start with `.`. Then `assetManager.loadAny({url}, opts, cb)`.
- Pipeline hooks: `assetManager.pipeline.insert((task, done) => { task.output = task.input; done(); }, index)`; three built-in pipelines: url transform, load (download+parse), preload (download only).

## 6. Caching on disk

- **Web**: browser HTTP cache only; the engine does not manage it. Use MD5 Cache or versioned URLs.
- **Native [4.0 src]**: every remote file is stored under `<writablePath>/gamecaches/<bundle>/…` and indexed in `gamecaches/cacheList.json` (written ≤ every 2 s). Lookup order: in package → in cache → download to cache. **Keyed by URL, never revalidated, no size limit, always on** (`cacheEnabled` is ignored). Consequence: never overwrite files at the same URL; publish new content under a new path or new md5 names.
- `assetManager.cacheManager` (null on web): `getCache(url)`, `removeCache(url)`, `clearCache()` (all; re-creates folders), `clearLRU()` (native: drops the oldest third, skipping `internal`, deleting one file per 500 ms). Mini-games: temp dir + LRU on quota, cleaned on exit.
- After an engine upgrade old cached files can break loading/rendering: md5 names or `clearCache()` once on version change.

## 7. Releasing memory

- Loaded assets live in `assetManager.assets` until released. Releasing destroys GPU/data and drops the cache entry.
- **Static refs** (set in the editor, stored in scene/prefab data) are ref-counted automatically: loading A adds +1 to each direct dependency; releasing A −1, recursively.
- **Dynamic refs** (you assign a loaded asset in code) are **not counted**. Pattern:
  ```ts
  sf.addRef(); sprite.spriteFrame = sf;        // hold
  // later / onDestroy
  sprite.spriteFrame = null; sf.decRef(); this.sf = null;   // decRef tries auto release (deferred to next tick)
  ```
- Scene **Auto Release Assets** (scene asset Inspector): releases the old scene's deps on switch. Turn it on for every scene except a hub/main scene you return to often. Persist nodes keep their refs.
- Explicit release skips the check for the asset itself (always released), deps still go through ref checks: `assetManager.releaseAsset(a)` (asset object only, no uuid/url/array), `bundle.release(path, Type)`, `bundle.releaseAll()` (also shared deps outside the bundle; careful), `assetManager.releaseAll()`. (`releaseUnusedAssets` exists but is `@engineInternal` in 4.0.)
- `removeBundle(b)` does **not** release its assets. Order: `b.releaseAll()` (or targeted releases) → `assetManager.removeBundle(b)`.
- Never release an asset a live node still uses (it renders broken or errors). Releasing a `Prefab` does not destroy instances already created.
- **[4.0 src]** Ref-count releases (`decRef` reaching 0) run on the next tick; forced ones (`releaseAsset`, `bundle.release*`) run immediately.
- Build/macro `CLEANUP_IMAGE_CACHE` drops the CPU copy of an image after GPU upload (saves RAM, but you can no longer read pixels or re-upload).

## 8. Native hot update (`native.AssetsManager`)

**Forbidden in TapCraft games** (`tapcraft check` rejects it): the app owns updates; games ship content as remote bundles. Kept for reading other projects.

Use only for whole-app patching on native; remote bundles + versioned URLs are simpler for content. Facts:
- Manifest JSON: `packageUrl`, `remoteManifestUrl`, `remoteVersionUrl` (small file, checked first), `version`, `engineVersion`, `assets: {path: {md5, size?, compressed?(zip)}}`, `searchPaths`. Generated by the sample's `version_generator.js -v <ver> -u <url> -s <build dir> -d <out>`.
- Diff-based (any old version → latest, no patch chains). Downloads to `<storage>_temp/`, moved into the storage dir only on success; resumable (file and byte level; server needs `Accept-Ranges`).
- API: `new native.AssetsManager(manifestUrl, storagePath)`, `setVersionCompareHandle((a, b) => number)`, `setVerifyCallback((path, asset) => bool)`, `setMaxConcurrentTask(n)`, events `native.EventAssetsManager.*` (`UPDATE_PROGRESSION` → `getPercent/getPercentByFile/getDownloadedBytes…`, `UPDATE_FAILED` → `downloadFailedAssets()`).
- Activation = **search paths**: prepend `getLocalManifest().getSearchPaths()` to `native.fileUtils.setSearchPaths` **in main.js before any script loads**, persist them in `localStorage`, then **restart** the game (`game.restart()`) because classes and bundle configs are already loaded.
- Build without MD5 Cache; debug builds for the sample (release `.jsc` outranks the hot-updated `.js`). On a store update, wipe the old storage dir (compare a saved version). Never hot-update across engine versions (`cc.js` and the C++ binary must match).
- `jsb.fileUtils` vs `native.fileUtils`: TS code imports `native` from 'cc'; `jsb.*` only in plain JS (main.js).
