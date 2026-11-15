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

When generic Cocos documentation conflicts with `tapcraft build`, `tapcraft check`, the current kit, or the platform MCP, follow TapCraft.
