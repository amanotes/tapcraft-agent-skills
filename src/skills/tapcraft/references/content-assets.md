# Assets and content on TapCraft

TapCraft asset policy is stricter than normal Cocos development. The installed pack is small and offline-first; later content streams from immutable remote bundles.

## Project layout

```text
game/
├── game.json
├── assets/
│   ├── boot/                  start scene and tiny loading UI
│   ├── scripts/               all scripts; scripts/hub is kit-owned
│   ├── core/                  local bundle, hub-local preset
│   └── content/
│       ├── shared/            shared remote assets
│       └── song-a/            remote content bundles, no scripts
├── build-templates/native/application.ejs
├── files/
│   ├── data/                  runtime JSON
│   └── assets/                supported raw files
└── settings/cocos.config.json
```

Run `npx com.amanotes.tapcraft-kit@1.2.0 create <slug>` for a new project or install the dependency and run `npx tapcraft init` for an existing one. Re-run `init` after a kit update so kit-owned runtime and templates match.

## Decide local versus remote

1. Every Cocos asset belongs to a bundle.
2. Keep boot, loading UI, menu, first level/song, shared UI/SFX, and anything needed during the first 30 seconds or offline in local bundles.
3. Group later content by one player decision: a world, song, level set, or shop section.
4. Prefer 1–5 MB per remote bundle; hard limit 20 MB. One remote file is at most 2 MB; all remote content is at most 250 MB.
5. Data that changes without a build may be JSON in `files/data/`; include a compatible local fallback.

Do not place prefabs, textures, audio, Spine, scenes, or scripts in `files/data`. Do not fetch art/audio from arbitrary URLs.

## Loader

```ts
const loaded = await content.load('song-a', { priority: 'critical' });
if (!loaded.ok) return showRetry(loaded.reason);

const clip = await content.asset(loaded.bundle, 'song', AudioClip);
if (!clip.ok) return showRetry(clip.reason);

content.prefetch('song-b');
content.pin('song-a');
content.release('song-a');
const songs = await content.json<Song[]>('data/songs.json');
const bannerUrl = content.url('assets/banner.json');
```

- Handle result values; do not assume network success.
- `content.load` resolves dependency bundles first.
- Prefetch downloads but does not decode; instantiate/decode at a natural break.
- Destroy nodes and game references before `content.release`.
- Register game-owned pool cleanup with `content.onLowMemory`.
- Never clear the engine download cache manually.

## Remote cache: designing songs and levels

Cocos keeps every remote file it downloads on disk, and TapCraft relies on that so content downloaded once plays offline afterwards. Know how the cache behaves before you cut songs and levels into bundles.

**How the native cache works [4.0 src]**

- Each downloaded file is stored under `<writablePath>/gamecaches/<bundle>/…` (the app gives every game its own writable folder; the cache survives app restarts and pack updates) and indexed in `gamecaches/cacheList.json` (written about 2 s after the last download; the kit writes it before the game unloads).
- Lookup order on every load: in the pack → in the disk cache → download into the cache. Once a song or level bundle is in the cache, `content.load` works in airplane mode, also after the app restarts.
- The cache is **keyed by URL and never revalidated**, always on, with no size limit. `md5Cache` makes every changed file a new URL, so a new build fetches only what changed; old files stay on disk until the cache is cleared.
- `content.release` frees **memory** (assets and the loaded bundle), not disk. A released bundle loads again from disk without network.
- `content.prefetch` downloads into the disk cache without decoding (Wi-Fi only unless `{ anyNetwork: true }`). The next `content.load` reads from disk.

**Song design (one song = one remote bundle)**

- Bundle per song: `song-<id>` holding the audio clip, chart/beatmap asset and song-specific art. The song list itself is JSON in `files/data/` (`content.json('data/songs.json')`), so a new song needs no new pack.
- First songs (the tutorial song and anything playable offline on day one) stay local.
- When the player opens a song detail or the list scrolls near it, `content.prefetch('song-<id>')`; `content.load` at play time then reads from disk.
- Show "downloaded" state honestly: a song played or prefetched once is cached, but the cache can be cleared by the OS or the app, so always handle `load` failure with retry, never assume it is still there.
- Shared song UI, hit sounds and note skins go in a higher-priority shared bundle (or local), not copied into every song bundle.
- After a song ends, release it (`content.release`) unless the player is likely to replay; `pin` only the song currently playing.

**Level design (level packs, not one bundle per level)**

- Group levels into packs by player progress, e.g. `levels-001-030` (local), `levels-031-090`, `levels-091-150` (remote). One bundle per level means hundreds of small manifests and requests; one bundle for all levels means a huge first download.
- Level layouts that are pure data can be JSON inside the pack bundle; level art shared across packs belongs in a shared bundle so each pack stays small.
- While the player is in pack *n*, prefetch pack *n + 1* when they pass about two thirds of it; release pack *n − 1* after they leave it.
- Never change a published level in place: a fix ships as new md5 files in a new build (the old cached file is never refetched at the same URL).

**What not to do**

- Do not call `assetManager.cacheManager.clearCache()` / `clearLRU()` or delete `gamecaches`: it throws away every downloaded song and level, breaks offline play and costs the player data. Cache housekeeping belongs to the app.
- Do not use `loadRemote` with your own URLs to "cache" art or audio; it bypasses bundles, md5 versioning and the kit's retries.
- Do not cache downloaded bytes yourself in `saves` or `localStorage`.

Details: [cocos-creator/asset-bundles.md](cocos-creator/asset-bundles.md) §6 (caching) and §7 (releasing memory); Cocos manual <https://docs.cocos.com/creator/4.0/manual/en/asset/cache-manager.html>, <https://docs.cocos.com/creator/4.0/manual/en/asset/preload-load.html>, <https://docs.cocos.com/creator/4.0/manual/en/asset/release-manager.html>.

## Cocos bundle rules

- Bundle names are stable lowercase `[a-z0-9-]`.
- Remote bundles contain no scripts.
- An asset shared by bundles belongs in a higher-priority shared bundle.
- `md5Cache` is on (the kit build sets it); names and bundle manifests become immutable/versioned.
- Load SpriteFrames as `path/spriteFrame`, without a file extension.
- Keep `resources/` small because it is always packed.
- Use kit texture presets `hub-art` and `hub-ui`; cap atlases at 2048 px.

## Required failure behavior

Remote content must have a local placeholder, visible retry, and a route back to playable local content. A missing shop skin or song must not block the menu or crash the game.
