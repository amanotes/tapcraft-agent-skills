# Build, publish, native projects, debugging

Source: manual `editor/publish/*`, `editor/project`, `editor/preview`, `release-notes/*`, `advanced-topics/{native-*,engine-customization,profiler,memory-leak-detector,java/oc-reflection,js-*-bridge,jsb-*,thread-safety,data-storage}`. The manual's build pages are 3.8 text driving the **Creator editor**; Cocos 4 here is built headless with **cocos-cli**.

> **TapCraft:** release builds come only from `npx tapcraft build`, which owns the build config, engine modules, `md5Cache` and the native template. Games ship no native code: `native/engine` edits, `native.bridge`, `native.reflection`, `jsb.*` and hot update are forbidden (see [game-contract](../game-contract.md)). Read this page for build output, `settings.json`, debugging and profiling. Full manual: <https://docs.cocos.com/creator/4.0/manual/en/editor/publish/index.html>.

## Toolchain (4.0)
- CLI: `cocos build -j <project> -p <platform> -c <config.json>` (`cocos create|import|info|start-mcp-server` too). Config JSON = the Build panel's exported options: common keys at top level, platform keys under `packages.<platform>` (e.g. `packages.ios.{bundleIdentifier, renderBackEnd:{metal:true}, skipUpdateXcodeProject}`, `packages.android.{packageName, appABIs, apiLevel, orientation, renderBackEnd:{vulkan,gles3,gles2}, sdkPath, ndkPath, keystore…}`).
- Common keys **[4.0 src]** (`cocos-cli/src/core/builder/@types/public/options.ts`): `debug`, `md5Cache`, `sourceMaps` (bool or `'inline'`), `startScene`, `scenes`, `mainBundleCompressionType`, `mainBundleIsRemote`, `server` (Resource Server Address), `skipCompressTexture`, `overwriteProjectSettings.includeModules` (e.g. `{ 'spine-3.8': 'off', 'spine-4.2': 'on' }`), `buildPath`, `outputName`, `useSplashScreen`.
- Creator editor CLI (3.8, for reference): `CocosCreator --project <p> --build "platform=android;debug=false;configPath=./x.json"`; exit code **36 = success**, 32 bad params, 34 build error; needs a GUI session; `stage=build|make|bundle`, `buildScriptsOnly=true`.
- Project config: `settings/cocos.config.json` (4.0) replaces `settings/v2/packages/*.json` / `profiles/v2/packages/builder.json` (3.8). Commit `assets/` (with every `.meta`), `settings/`, `extensions/`, `native/`, `package.json`; `library/`, `temp/`, `build/` are disposable caches.

## Build output
```
build/<task>/data/            what the app runs (native)  ← assets/<bundle>/, remote/<bundle>/, src/settings.json,
                                                             src/chunks, cocos-js/, jsb-adapter/, main.js, application.js
build/<task>/proj/            generated IDE project (Xcode / Android Studio), cfg.cmake
build/web-mobile/             index.html, application.<md5>.js, cocos-js/, assets/, remote/, src/
```
- Debug off = release: UUIDs compressed, scripts minified, JSON merged. Debug + Source Maps for readable stacks.
- `settings.json` is categorized (3.6+): `assets{server, remoteBundles, bundleVers, preloadBundles, projectBundles, downloadMaxConcurrency, jsbDownloaderMaxTasks, jsbDownloaderTimeout}`, `launch{launchScene}`, `engine{debug, macros, engineModules}`, `screen{designResolution, orientation, frameRate}`, `rendering`, `physics`, `plugins{jsList}`, `profiling{showFPS}`. Read at runtime: `settings.querySettings(category, key)`; override early via `game.init({ overrideSettings })` / `game.onPostBaseInitDelegate`.
- Startup hooks (3.6+ `application.js`): `game.onPreBaseInitDelegate`, `onPostBaseInitDelegate`, `onPostInfrastructureInitDelegate`, `onPostSubsystemInitDelegate`, `onPostProjectInitDelegate`.
- Customize generated web files with `build-templates/<platform>/` (`index.ejs`, …; copied over output after ejs render). For native use `native/engine/` instead.
- Runtime 404 after build = asset loaded by path but not in a bundle/`resources`, failed import (Reimport), or a deleted dependency. Decode release UUIDs: `Build.Utils.decompressUuid(...)`.
- Engine compile is cached globally per (debug, modules, sourceMaps, platform, engine version): toggling any recompiles (slow).

## Native projects

**Not used on TapCraft**: the app owns the native project; games ship only `data/`.
- Hand-maintained native code lives in `native/engine/{common,ios,android,mac,win64}` (commit it); `build/<platform>/proj` is regenerated. Existing `native/engine` is **never auto-updated** on engine upgrade: diff or delete+rebuild.
- Rebuilding an existing task does not regenerate the IDE project; iOS re-runs CMake each build unless `skipUpdateXcodeProject` (then new C++ files are not picked up either).
- Add C++ to `CC_COMMON_SOURCES` / `CC_PROJ_SOURCES`; Obj-C only in platform dirs. iOS: Metal only, default target 12.0 (`TARGET_IOS_VERSION` in `cfg.cmake`). Android: JDK 17, AGP/Gradle 8, `namespace` not `applicationId`, ABIs via `PROP_APP_ABI` in `gradle.properties` (Clean Project when changing ABIs).
- Never hot-update or reuse a `data/` pack across engine versions: `cocos-js` and the native binary must match.

## Engine modules (Feature Cropping)
- Unticked modules are stripped: size win, runtime error if code uses them. 4.0 module ids include `spine-3.8`/`spine-4.2`, `dragon-bones`, `physics-{ammo,physx,cannon,builtin}`, `physics-2d-{box2d,box2d-wasm,box2d-jsb,builtin}`, `legacy-pipeline`/`custom-pipeline`, `worker`, `worker-pool`.
- 3D physics: builtin (triggers only, tiny) < cannon (~141 KB) < Bullet/ammo (~1.5 MB, default) < PhysX (~5 MB, fastest on native). 2D: builtin (no rigidbodies/joints, BEGIN/END contact only) vs Box2D.
- Remove WebView/VideoPlayer modules if unused (App Store review flags WebView).
- Wasm vs asm.js per build ("Bundle Mode Of Native Code"); wasm Brotli = smaller, slower load.

## JS ↔ native

**Forbidden in TapCraft games**: use the kit's `platform`. Kept for reading other projects.
- All JS runs on the game (GL) thread. Native → JS must hop: Android `CocosHelper.runOnGameThread`, C++/ObjC `CC_CURRENT_ENGINE()->getScheduler()->performFunctionInCocosThread(...)`. JS → Android UI: `runOnUiThread`.
- `native.bridge.sendToNative(cmd, payload)` / `native.bridge.onNative = (cmd, payload) => …` (strings only, one-way, single `onNative` slot) or `native.jsbBridgeWrapper.addNativeEventListener/dispatchEventToNative` (event names). Java `JsbBridge.setCallback/sendToScript`, ObjC `[JsbBridge sharedInstance]`.
- Reflection: `native.reflection.callStaticMethod('com/x/Cls', 'fn', '(ILjava/lang/String;)Z', …)` (static, int/float/bool/String only, slow on Android; ObjC selector needs every colon; App Review risk). For frequent calls write a SWIG binding (`native/tools/swig-config/genbindings.js`).
- `jsb.*` names are legacy; in TS use `import { native } from 'cc'` (`native.fileUtils`, `native.AssetsManager`, `native.reflection`). Guard with `NATIVE` from 'cc/env' or `sys.isNative`.

## Storage and networking
- Saves: TapCraft games use `Tapcraft.storage`, never `sys.localStorage` (`tapcraft check` fails on it; kit 2 storage is a native key-value store).
- HTTP: standard `fetch` / `XMLHttpRequest` (native implementation). WebSocket client = standard `WebSocket`.
- Files on native: `native.fileUtils.getWritablePath()`, `isFileExist`, `writeStringToFile`, `getDataFromFile`, `createDirectory`, `removeDirectory`, `listFilesRecursively`, `setSearchPaths`.

## Debugging and profiling
- JS on device (debug build, same LAN): Chrome `devtools://devtools/bundled/js_app.html?v8only=true&ws=<device-ip>:6086/00010002-0003-4004-8005-000600070008`. **[4.0 src]** port/address come from `_debuggerInfo` in `native/engine/common/Classes/Game.cpp` (6086, `0.0.0.0`, enabled when `CC_DEBUG`); the manual's 5086/43086 are older values, check the app log. Release: `USE_V8_DEBUGGER_FORCE` + `_debuggerInfo.enabled = true`.
- JS stack from lldb: `po se::ScriptEngine::getInstance()->getCurrentStackTrace()`.
- `profiler.showStats()` / settings `profiling.showFPS` for FPS + draw calls. Native profiler: Feature Cropping "Debug Renderer" + `CC_USE_PROFILER 1` in `native/cocos/base/Config.h`. C++ leak detector: `USE_MEMORY_LEAK_DETECTOR 1` (engine leaks only, not JS).
- Preview first: a scene that fails in preview fails in the build; script errors block `settings.json` generation.
