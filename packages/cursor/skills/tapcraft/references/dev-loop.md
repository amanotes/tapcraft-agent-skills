# Build, check, and device loop

Run commands from the game root. The CLI comes from the project's `com.amanotes.tapcraft-kit` devDependency.

## Build

```bash
npx tapcraft build ios
npx tapcraft build android
npx tapcraft build all
```

The kit applies the engine profile, release settings, `md5Cache`, texture presets, and native application hook. Output is `build/<platform>-hub/data/`.

Run `tsc --noEmit` separately when the project has TypeScript. Cocos can otherwise build despite type errors.

## Check

```bash
npx tapcraft check
npx tapcraft check --json
```

Errors block release. Typical errors include:

- invalid `game.json`, engine/profile mismatch, or non-kit build;
- offline start depending on a remote bundle;
- missing bundle config/dependency, scripts in remote content, or compression failure;
- forbidden exit, bridge, path, and hot-update APIs;
- pack over 15 MB, remote bundle over 20 MB, remote file over 2 MB, or total remote over 250 MB;
- debug hosts, localhost/private IPs, or debug flag files in a release.

Warnings require human review: pack over the 8 MB target, remote bundle over 5 MB, large/uncompressed images, large WAV files, metadata, and missing lifecycle calls.

## Serve

```bash
npx tapcraft serve
```

The server exposes a storage-v4-shaped dev URL and `dev.json`. In the internal TapCraft app, set Dev content server to the printed URL. Rebuild and restart the server after content changes.

## Device checklist

- [ ] Airplane mode reaches menu and first gameplay.
- [ ] Platform loading hides only after the local loading UI draws.
- [ ] `gameReady` fires when menu input works.
- [ ] Remote failure shows placeholder/retry without blocking local play.
- [ ] Gameplay sustains target frame time without decode hitches.
- [ ] Memory returns near baseline after leaving content.
- [ ] Twenty exit/relaunch cycles preserve saves and do not grow memory.
- [ ] Background/resume and ads pause gameplay and every audio path.
- [ ] Release logs have no hot-loop spam or uncaught errors.
- [ ] iOS and Android both load the same logical remote bundles.

Preview/editor tests are useful but do not replace this native loop.
