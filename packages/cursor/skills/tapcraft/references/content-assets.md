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

Run `npx com.amanotes.tapcraft-kit@1.1.0 create <slug>` for a new project or install the dependency and run `npx tapcraft init` for an existing one. Re-run `init` after a kit update so kit-owned runtime and templates match.

## Decide local versus remote

1. Every Cocos asset belongs to a bundle.
2. Keep boot, loading UI, menu, first level/song, shared UI/SFX, and anything needed during the first 30 seconds or offline in local bundles.
3. Group later content by one player decision: a world, song, level set, or shop section.
4. Prefer 1–5 MB per remote bundle; hard limit 20 MB. One remote file is at most 2 MB; all remote content is at most 250 MB.
5. Data that changes without a build may be JSON in `files/data/`; include a compatible local fallback.

Do not place prefabs, textures, audio, Spine, scenes, or scripts in `files/data`. Do not fetch art/audio from arbitrary URLs.

## Storage v4

The app sets `globalThis.__AMA_GDK__.content` before Cocos initializes:

```json
{ "cdn": "https://host/", "bundles": null, "remoteBundles": null }
```

Kit 1.1 combines that host with `globalThis.__AMA_GDK__.game.id` and derives
`<cdn>miniapps/<slug>/`. The platform layout is:

```text
platform/catalog/<ios|android>.json
platform/miniapps/<slug>/builds/<ios|android>/<n>.zip
platform/miniapps/<slug>/media/<id>-<name>
miniapps/<slug>/remote/<bundle>/...
miniapps/<slug>/data/...
miniapps/<slug>/assets/...
```

Never use the removed `content.server`, `games/<slug>/files/`, catalog v2, or per-channel content paths.

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

## Cocos bundle rules

- Bundle names are stable lowercase `[a-z0-9-]`.
- Remote bundles contain no scripts.
- An asset shared by bundles belongs in a higher-priority shared bundle.
- Enable `md5Cache`; names and bundle manifests become immutable/versioned.
- Load SpriteFrames as `path/spriteFrame`, without a file extension.
- Keep `resources/` small because it is always packed.
- Use kit texture presets `hub-art` and `hub-ui`; cap atlases at 2048 px.

## Required failure behavior

Remote content must have a local placeholder, visible retry, and a route back to playable local content. A missing shop skin or song must not block the menu or crash the game.
