# Scripting, nodes, UI, tween, audio, animation

Source: manual `scripting/*`, `concepts/*`, `ui-system/*`, `tween/*`, `audio-system/*`, `animation/*`, `particle-system/*`, `engine/event/*`. **[4.0 src]** = checked in the 4.0.0-beta.1 engine.

> **TapCraft:** lifecycle, exit, pause and audio rules in [game-contract](../game-contract.md) win over this page (no `game.end`, pause every `AudioSource` on `platform.onPause`). Full manual: <https://docs.cocos.com/creator/4.0/manual/en/scripting/index.html>.

## Compiler and modules
- TS compiled per file (`isolatedModules`), **`tsconfig.json` is ignored** and **type errors do not fail the build** → run `tsc --noEmit` yourself. No `const enum`, no `export =`/`import =`; re-export types with `export type {}`.
- ESM only: no `require`, no `module.exports`, no Node built-ins. Use `globalThis` (not `window`/`global`).
- Import `.ts` **without** extension; `.js`/`.mjs` **with** extension and no directory imports. npm: bare specifiers via import map then Node resolution; conditions `import`/`default` (+ project "export conditions", default `browser`); the package.json `browser` field is not supported. CJS default-imports as `module.exports`.
- `import { … } from 'cc'` (never global `cc`). Build-time flags from `'cc/env'`: `BUILD PREVIEW EDITOR DEBUG DEV NATIVE HTML5 MINIGAME WECHAT …` (constants → dead-code elimination).
- Load order: `cc` → plugin scripts (JS "Import as Plugin", globals only, cannot be imported) → project modules.
- `@ccclass('Name')` names are **global and unique**; file name is irrelevant; `getComponent('Name')` uses this string (case-sensitive).
- Feature Cropping removes engine modules from `'cc'`; using a cropped module fails at runtime, not at compile time.

## Decorators and properties
- `const { ccclass, property, executeInEditMode, requireComponent, executionOrder, disallowMultiple, menu } = _decorator;`
- Non-primitive properties must declare `type` (`@property(Node)`, `@property({ type: [SpriteFrame] })`, `@property({ type: Enum(MyEnum) })`), else "Type(Unknown)". `CCInteger`/`CCFloat` for number subtypes.
- `_x` fields are hidden but serialized; `serializable: false` skips; `formerlySerializedAs: 'old'` when renaming; `editorOnly` drops at export. `@property get x()` shows but does **not** serialize.
- `@executionOrder(n)` (lower first) affects only `onLoad/onEnable/start/update/lateUpdate`.

## Lifecycle and nodes
- `onLoad → onEnable → start → update → lateUpdate → onDisable → onDestroy`. `onLoad` of all nodes in a scene runs before any `start`. `lateUpdate` runs after animation/particles/physics.
- Components: `node.addComponent(Cls)` (never `new`), `this.node` unavailable in constructor. Scheduler is on Component: `schedule(fn, interval, repeat, delay)` runs `repeat+1` times; keep a stable function ref to `unschedule`.
- `node.destroy()` is deferred to end of frame → check `isValid`. `removeFromParent()` does **not** free the node (leak if you drop it).
- **Readonly transforms**: `node.position/worldPosition/scale/rotation/eulerAngles` return readonly views. `node.position.x = 1` or `worldPosition.add(v)` silently does nothing (always on native). Use `setPosition/setWorldPosition/setScale`, or `const p = node.position.clone(); …; node.setPosition(p)`.
- Native perf (engine core is C++ since 3.6): reading `node.position`, `children`, `active`, `layer` is cached JS-side and cheap; every setter crosses JS↔C++. Batch per-frame writes; avoid touching thousands of nodes each frame.
- Scenes: `director.loadScene(name, cb)` (only scenes in loaded bundles), `director.preloadScene`, `bundle.loadScene` + `director.runScene`. Persist root-level nodes with `director.addPersistRootNode(node)`.
- Layers: node `layer` bitmask & camera `visibility`. Built-ins: `UI_2D = 1<<25`, `UI_3D = 1<<23`, `DEFAULT = 1<<30`; user layers 0–19. Nodes created in code under a UI Canvas need `node.layer = Layers.Enum.UI_2D` or the UI camera skips them.

## Events and input
- Custom events: `new EventTarget()` with `on/once/off/emit` (`emit` max 5 args). Do not use Nodes as event buses.
- Global input: `input.on(Input.EventType.TOUCH_START, (e: EventTouch) => …, this)`; `off` in `onDestroy`. `systemEvent` is deprecated.
- Node touch events need `UITransform`; `e.getUILocation()` for UI space, `getLocation()` screen space. Topmost sibling swallows; `event.preventSwallow = true` to pass through; `BlockInputEvents` on popup backgrounds. Bubbling does not hit-test parents.
- `macro.ENABLE_MULTI_TOUCH = false` for single touch. `screen.on('window-resize' | 'orientation-change', …)`.
- 3D picking: `camera.screenPointToRay(x, y, ray)` + `PhysicsSystem.instance.raycastClosest(ray)`.

## 2D/UI rendering and batching
- A node holds **one** renderable (Sprite, Label, Graphics, Mask, RichText…). 2D renderables need `UITransform` and an ancestor `Canvas`/`RenderRoot2D`. Do not nest Canvases.
- Draw order = node tree pre-order (children on top of parent, later siblings on top). Use `setSiblingIndex()` (runtime, not serialized) or `Sorting2D` (needs module + sorting layers).
- Batching needs: same material+uniforms, texture, blend/depth state, MeshBuffer, adjacency in render order. **Breakers**: Mask, Graphics, UIMeshRenderer, Labels (own texture), different textures. Fixes: Auto Atlas per screen; Label `cacheMode` BITMAP for static text; avoid interleaving sprites and labels.
- Dynamic Atlas only works when `CLEANUP_IMAGE_CACHE` is false. **[4.0 src]** Native and mini-games default `CLEANUP_IMAGE_CACHE = true` → dynamic atlas off. To force on, at module top level (not in `onLoad`): `macro.CLEANUP_IMAGE_CACHE = false; DynamicAtlasManager.instance.enabled = true;` Only frames < 512 px (`maxFrameSize`). Set SpriteFrame `packable = false` for custom shaders that read UVs.
- `UIStaticBatch` bakes a static subtree (`markAsDirty()` to rebake; not with Mask/Graphics/Model).
- `BATCHER2D_MEM_INCREMENT` (KB, default 144 ≈ 4096 verts) sizes 2D mesh buffers.
- Reading `sprite.material`/`renderer.material(s)`/`getMaterialInstance()` **creates an instance** that no longer batches; use `sharedMaterial`/`customMaterial`.
- Opacity: `UIOpacity` on a container (multiplies subtree); for one renderable set `color.a` (cheaper).
- Label: overflow NONE/CLAMP/SHRINK/RESIZE_HEIGHT; `cacheMode` NONE (default), BITMAP (can join dynamic atlas), CHAR (shared 1024×1024 glyph atlas per font/size/color; **new glyphs silently disappear when full**; no SHRINK/bold/italic). Outline/shadow are Label props since 3.8.2.
- Widget **[4.0 src]**: default align mode `ON_WINDOW_RESIZE`; `ONCE` aligns once; `ALWAYS` re-aligns each frame and overwrites manual/animated position & size. Edit `widget.top/left…` not the node, or call `widget.updateAlignment()`.
- Layout changes apply next frame unless `layout.updateLayout()`. Never Widget + Layout on the same ScrollView content.
- Multi-resolution: one design resolution + fit policy for all Canvases (Project Settings). `SafeArea` component on the top UI node for notches.
- ScrollView/long lists: no built-in virtual list; pool item nodes yourself.
- Camera clear flags: the bottom-most camera `SOLID_COLOR`/`SKYBOX`, overlay UI cameras `DEPTH_ONLY`, else flicker/ghosting.

## Tween
- `tween(node).to(0.3, { position: v3(0, 100, 0) }, { easing: 'quadOut' }).call(() => …).start()`; `by`, `set`, `delay`, `sequence`, `parallel`, `repeat(n, embedded?)`, `repeatForever`, `union()`, `tag(n)`, `then`. `repeat(n)` alone repeats only the **last** action → `union()` first.
- 3.8.4+: `pause/resume`, `timeScale`, `reverse()`, `id`, `Tween.pauseAllByTarget`, function-valued props, `onUpdate/onComplete/progress` options.
- Stop on teardown: `Tween.stopAllByTarget(node)` in `onDestroy`; `repeatForever` on persistent targets leaks.
- Tweening a node property calls the setter; tweening a raw `Vec3` requires assigning it back in `onUpdate`.

## Audio
- Only `AudioSource` (no `audioEngine` in 3.x/4.0). `play/pause/stop`, `loop`, `volume`, `clip`, `playOnAwake`; `playOneShot(clip, vol)` for SFX (cannot stop, no end event). Events `AudioSource.EventType.STARTED/ENDED` on the node.
- BGM manager = persist root node + AudioSource. Web needs a user gesture before any audio (even `playOnAwake`). DOM audio on iOS Safari ignores volume (`{audioLoadMode: AudioClip.AudioType.DOM_AUDIO}` forces it).
- Formats: mp3/m4a/wav/ogg (no ogg on iOS).

## Animation
- `Animation` component: `play(name?)`, `crossFade(name, dur)`, `getState(name)` (`speed`, `time`, `wrapMode`, `repeatCount` — set `repeatCount` **after** `wrapMode`), events `Animation.EventType.FINISHED|LASTFRAME…`. Clips record node paths: renaming/moving animated children breaks tracks. Import `Animation` from 'cc' (clashes with DOM `Animation` type).
- Frame events: method name looked up on components of the animation root node.
- 3D: `SkeletalAnimation.useBakedAnimation` (baked = GPU joint texture, cheap, instancing; realtime = sockets/IK/blend). Sockets' target node must be a direct child.
- Marionette (`AnimationController` + Animation Graph): `setValue(var, v)` applied next update; variables only added in the graph editor; cannot coexist with `Animation` on a node.
- Spine `sp.Skeleton` **[4.0 src]**: engine modules `spine-3.8` or `spine-4.2` (one at a time, Feature Cropping). Cache modes REALTIME (all features), SHARED_CACHE (pre-baked, no blending; big win for many identical instances), PRIVATE_CACHE. Premultiplied Alpha default on: flip it if edges show halos/black. DragonBones: same cache modes, `playTimes` (-1 default, 0 loop).

## Particles
- 3D `ParticleSystem`: CPU by default; GPU mode disables Noise and some modifiers; materials must use `builtin-particle(-gpu|-trail)`. Enable `RenderCulling` + bounds for off-screen emitters. Inside a Canvas add `UIMeshRenderer` or it will not draw.
- 2D `ParticleSystem2D` from `.plist`; `autoRemoveOnFinish`, `duration -1` = continuous.

## Workers (4.0 only)
- `createWorker`/`WorkerPool` from 'cc' (Feature Cropping `worker`, `worker-pool`, both off). **On iOS/Android native they run synchronously on the main thread** (no JS threads). Useful only on web/mini-game.
