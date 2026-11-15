# Cocos 4 rules that matter on TapCraft

- Anything loaded by path must live in a bundle folder. Load a SpriteFrame as `path/spriteFrame` and omit extensions.
- `loadRemote` is not the TapCraft content API. Use the kit's `content` for bundles, JSON, and supported URLs.
- Cocos caches bundles by name and does not load dependency bundles for you; the kit handles both.
- Native remote bundle manifests use the versioned
  `cc.config.<ver>.json` name when `md5Cache` is enabled. Hashed names are
  required because native cache entries are URL-keyed and are not revalidated.
- Dynamically loaded assets require references. Use the kit lifecycle and release after destroying nodes that use them.
- `removeBundle` alone does not release retained assets.
- Node transform properties are views; use setters such as `setPosition`.
- Unregister events and stop tweens in `onDestroy`.
- Native dynamic atlas behavior differs from Preview. Build real atlases.
- Reading `renderer.material` can instantiate a material; prefer `sharedMaterial` when mutation is not required.
- Keep scripts out of remote bundles. Remote prefabs may reference components whose scripts are local.
- Cocos build success does not prove TypeScript correctness; run `tsc --noEmit`.
- Avoid `const enum`, CommonJS `require`, `.ts` import extensions, and duplicate `@ccclass` names.
- Do not configure native audio sessions or patch engine/native templates outside the kit.

## Cocos Creator 4.0 reference

Distilled from the Cocos 4.0 manual (mostly 3.8 text) and corrected from the 4.0.0-beta.1 engine source; corrections are marked **[4.0 src]**. Each page starts with what TapCraft changes.

| Topic | Read |
|---|---|
| Bundles, assetManager, loading, disk cache, releasing memory | [cocos-creator/asset-bundles.md](cocos-creator/asset-bundles.md) |
| Components, events, UI and batching, Widget, Label, tween, audio, animation, Spine, particles | [cocos-creator/scripting-ui.md](cocos-creator/scripting-ui.md) |
| Build output, `settings.json`, engine modules, debugging and profiling | [cocos-creator/build-native.md](cocos-creator/build-native.md) |
| Textures, atlases, compression, fonts, materials, shaders, physics | [cocos-creator/rendering-assets.md](cocos-creator/rendering-assets.md) |

To look further, read the online manual at <https://docs.cocos.com/creator/4.0/manual/en/>, then a real build's `data/src/settings.json` and `data/remote/<bundle>/cc.config.*.json`.

When generic Cocos documentation conflicts with `tapcraft build`, `tapcraft check`, the current kit, or the platform MCP, follow TapCraft.
