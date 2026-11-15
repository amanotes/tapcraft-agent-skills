# Textures, atlases, fonts, Spine, materials, shaders, physics

Source: manual `asset/{image,texture,sprite-frame,atlas,auto-atlas,compress-texture,font,label-atlas,spine,dragonbones,tiledmap,prefab,scene,meta,model/*,render-texture}`, `material-system/*`, `shader/*`, `render-pipeline/*`, `physics/*`, `physics-2d/*`, `advanced-topics/dynamic-atlas`.

> **TapCraft:** use the kit's texture presets `hub-art` / `hub-ui` and atlases of 2048 px or less; engine modules (Spine version, physics backend) are fixed by the engine profile, so check it before relying on one. Full manual: <https://docs.cocos.com/creator/4.0/manual/en/asset/index.html>.

## Images, textures, sprite frames
- An image imports as `ImageAsset` with sub-assets `texture` (Texture2D) and `spriteFrame` (SpriteFrame, when type = sprite-frame). Load by sub-path + type (`img/spriteFrame`). Runtime: `SpriteFrame.createWithImage(imageAsset)` or `tex.image = img; sf.texture = tex`.
- Import options: `type` (raw / texture / normal map / sprite-frame / texture cube), **Fix Alpha Transparency Artifacts** (bleeds edge colour into transparent pixels; turn on for alpha sprites to kill dark halos), mipmaps, filter (Nearest for pixel art), wrap (sprite-frame forces clamp). WebGL1 NPOT textures cannot repeat.
- SpriteFrame: `packable` (atlas eligibility), trim (Auto/Custom/None), 9-slice borders. Animations with baked offsets: trim off + Sprite `sizeMode = RAW`.
- `.meta` holds uuid + import settings; commit it with the asset; moving files outside the editor must move the `.meta` too (else new uuid → broken references). `library/` is a rebuildable import cache.

## Atlases
- **Auto Atlas** (`.pac`): packs every SpriteFrame in its folder at **build** time (MaxRects, max 2048 etc., padding, extrude/"Padding Bleed", POT/square, compress texture). Editor/preview still use loose files. Group by screen/usage so a screen draws from 1–2 textures. See [asset-bundles](asset-bundles.md) for the bundle size trap.
- TexturePacker `.plist + .png`: TP 4.x format only; load `SpriteAtlas` then `getSpriteFrame(name)`.
- Tiled maps (3.8.5+): atlas must be extruded 1 px and tileset margin 1 / spacing 2, else seams. `ENABLE_TILEDMAP_CULLING` off for rotated/skewed maps.

## Texture compression
- Per image/atlas: `useCompressTexture` + `presetId`; presets in Project Settings → Texture Compression per platform (`android`, `ios`, `web`, `miniGame`, `pc`). Formats: `astc_4x4…12x12`, `etc1_rgb(_a)`, `etc2_rgb(a)`, `pvrtc_*`, `webp`, `png`, `jpg`.
- Recommended mobile: **ASTC** (iOS 9+/A8+, Android 5+). UI/2D 5x5 or 6x6, 3D 6x6 or 8x8. **Always add a fallback** (png/jpg or etc) in the same preset; the build only emits configured formats and the engine picks the first supported one in `macro.SUPPORT_TEXTURE_FORMATS` order.
- PNG/JPG/WEBP "compression" shrinks download only, not decode time or GPU memory. GPU formats (ASTC/ETC/PVR) cut memory and upload time.
- Opaque vs alpha: when both RGB and RGBA variants exist in a preset, the build picks by the image's alpha channel.
- `skipCompressTexture` speeds dev builds. Custom compressors via build plugin `assetHandlers.compressTextures` or "Custom Compress Format".

## Fonts and labels
- System font, TTF (dynamic; per-label texture unless CHAR cache), BMFont (`.fnt` + png set to sprite-frame, keep together; batches with atlas sprites), LabelAtlas (fixed-grid digits; set start char).
- Score counters that change every frame: BMFont or CHAR cache, never NONE/BITMAP TTF (re-renders a texture each change).

## Spine / DragonBones
- 4.0 has engine modules `spine-3.8` and `spine-4.2` (one active). Data must match the runtime major version; export from the matching Spine editor. Files: `.json` or `.skel` + `.atlas` + png.
- Remote Spine without a bundle: load atlas text, skel/json and png, then build `sp.SkeletonData` manually (`atlasText`, `textures`, `textureNames`, `skeletonJson` or `_nativeAsset`, any `_uuid`). Easier: put Spine assets in a remote bundle and `bundle.load(path, sp.SkeletonData)`.
- Cache modes and premultiplied alpha: see [scripting-ui](scripting-ui.md).

## Materials and effects
- `Material.initialize({ effectName: 'builtin-unlit', defines: { USE_TEXTURE: true }, technique: 0 })`; macros fixed after init (re-`initialize`/`reset` to change). Uniforms: `setProperty(name, v, pass?)`; hot path: `const h = pass.getHandle('x'); pass.setUniform(h, v)`.
- Shared vs instance: getters `renderer.material`, `.materials`, `getMaterialInstance()` create a per-renderer instance (breaks batching). Use `sharedMaterial`/`getSharedMaterial`, assign with `setSharedMaterial`/`customMaterial`. 2D components accept one `customMaterial` (2D shader: copy `builtin-sprite.effect`).
- `.effect` = YAML `CCEffect %{ techniques → passes → { vert: prog:entry, frag, properties, blendState, depthStencilState, rasterizerState } }%` + GLSL `CCProgram name %{ … }%`. Do not write `main`.
- Shader rules: non-sampler uniforms only inside named UBO blocks; no `vec3` members; order members to avoid std140 padding; `mat4` only. Custom macros are always defined (0/1) → `#if FOO`, never `#ifdef FOO`. Tag with `#pragma define-meta NAME range([0,3])|options([a,b])`. Includes: `#include <builtin/uniforms/cc-global>` (`cc_time`, `cc_screenSize`, matrices), `<builtin/uniforms/cc-local>` (`cc_matWorld`), `<legacy/input>`, 2D: `CCSampleWithAlphaSeparated(cc_spriteTexture, uv)`.
- RenderTexture sampling needs `SAMPLE_FROM_RT` + `CC_HANDLE_RT_SAMPLE_FLIP(uv)` or it renders upside down on some backends.
- Precompile shader variants (effect Inspector) to avoid first-use hitches.
- Instancing (3D): material `USE_INSTANCING`; custom per-instance attrs via `meshRenderer.setInstancedAttribute(name, value)`. Static batching: `BatchingUtility.batchStaticModel`.

## Render pipeline
- Builtin pipeline = Customizable Render Pipeline (`rendering.setCustomPipeline`); `legacy-pipeline` still exists in 4.0 as a module. Per-camera `BuiltinPipelineSettings` (MSAA native only, shading scale, bloom, FXAA, FSR). For 2D mobile games keep it simple: no post-process, MSAA off.
- Lights: one directional light; shadows cost; on mobile keep shadow maps small or use planar shadows.

## Physics essentials
- 3D: `PhysicsSystem.instance` (`fixedTimeStep` 1/60, `maxSubSteps` 1, gravity). Collision events need a non-builtin backend and a non-static body; triggers via `isTrigger`. Listen `collider.on('onTriggerEnter', cb, this)`. Raycast results live in `PhysicsSystem.instance.raycastResults`/`raycastClosestResult` (return value is a bool). Group/mask are bitmasks separate from render layers.
- 2D: `PhysicsSystem2D.instance` (gravity (0,−320) px/s², PTM 32). `RigidBody2D.enabledContactListener = true` to get `Contact2DType.BEGIN_CONTACT` callbacks; do not keep the `contact` object; changes to bodies inside a callback apply after the step. Box2D has no scale: scale a visual child, not the body node.
- Move dynamic bodies with velocity/forces, kinematic bodies with transforms. Physics syncs after `lateUpdate`.
