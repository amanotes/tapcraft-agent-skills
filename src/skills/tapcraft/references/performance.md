# Performance budgets

Measure on an iPhone XR/11 or Galaxy A14/Redmi 12 class device through the internal TapCraft app.

| Metric | Target | Hard limit |
|---|---:|---:|
| Downloaded pack zip | 8 MB | 15 MB |
| Pack plus remote | — | 250 MB |
| Tap to first frame | 1.5 s | 3 s |
| Tap to playable offline | 3 s | 8 s |
| Gameplay frame p95 | 17 ms | 33 ms |
| Peak memory | 300 MB | 450 MB |
| Memory growth after warm-up | — | 10% |
| Uncaught errors before ready | 0 | 0 |

## Startup

- Keep boot under roughly 300 KB: camera, canvas, solid background, logo, progress.
- Do no heavy work at module scope.
- Draw first, hide the platform loader, then load local menu/core.
- Start no remote request on the path to `gameReady`.
- Defer physics, Spine, particles, pools, audio, and large JSON until needed.

## Pack and GPU memory

- Move content not needed during the first 30 seconds to remote bundles.
- Use real atlases; native dynamic atlas is not a reliable substitute.
- Texture memory is dimensions × format, not compressed source size. A 2048² RGBA texture is 16 MB.
- Apply `hub-art`/`hub-ui` presets; keep atlases at 2048 or less.
- Use compressed mono SFX and compressed/remote music; avoid large WAV files.
- Subset fonts and avoid packaging an entire CJK font unless required.

## Frame time

- Target fewer than 50 draw calls for typical 2D gameplay.
- Pool frequently spawned nodes.
- Do not allocate arrays, closures, strings, or vectors every frame.
- Avoid changing Labels every frame; use suitable cache/BMFont for counters.
- Prefetch during safe time, but decode/instantiate only at a transition.
- Spread heavy setup across frames with an explicit time budget.
- Set 60 fps for gameplay and optionally 30 fps for static screens.

## Memory

- Destroy nodes and clear game references before releasing their bundle.
- Release idle music, level, world, and shop bundles.
- Register pool cleanup before the kit trims bundles on low memory.
- Avoid global maps that retain assets or prefabs indefinitely.
- Measure after warm-up across repeated level transitions, not only once after launch.
