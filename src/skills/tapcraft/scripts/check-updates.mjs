#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, parse, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = new Set(process.argv.slice(2));
const force = args.has('--force');
const asJson = args.has('--json');
const noNetwork = args.has('--no-network');
const ttlMs = 24 * 60 * 60 * 1000;

function stable(version) {
  const match = String(version ?? '').trim().match(/^v?(\d+)\.(\d+)\.(\d+)$/);
  return match ? match.slice(1).map(Number) : null;
}

function compare(a, b) {
  const av = stable(a);
  const bv = stable(b);
  if (!av || !bv) return null;
  for (let i = 0; i < 3; i += 1) {
    if (av[i] !== bv[i]) return av[i] < bv[i] ? -1 : 1;
  }
  return 0;
}

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return null;
  }
}

async function findUp(start, relativePath) {
  let current = resolve(start);
  const root = parse(current).root;
  while (true) {
    const candidate = join(current, relativePath);
    if (await readJson(candidate)) return candidate;
    if (current === root) return null;
    current = dirname(current);
  }
}

async function requestJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);
  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'tapcraft-agent-skills-update-check',
      },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function cachePath() {
  if (process.env.TAPCRAFT_UPDATE_CACHE) {
    return resolve(process.env.TAPCRAFT_UPDATE_CACHE);
  }
  const base =
    process.env.XDG_CACHE_HOME ??
    (process.platform === 'darwin'
      ? join(homedir(), 'Library', 'Caches')
      : join(homedir(), '.cache'));
  return join(base, 'tapcraft-agent-skills', 'update-check.json');
}

async function loadReleaseInfo() {
  if (process.env.TAPCRAFT_RELEASE_INFO) {
    return readJson(resolve(process.env.TAPCRAFT_RELEASE_INFO));
  }
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const path = await findUp(scriptDir, 'release-info.json');
  return path ? readJson(path) : null;
}

async function loadProjectKit() {
  const start = process.env.TAPCRAFT_PROJECT_ROOT ?? process.cwd();
  const installedPath = await findUp(
    start,
    join('node_modules', 'com.amanotes.tapcraft-kit', 'package.json'),
  );
  const installed = installedPath ? await readJson(installedPath) : null;
  const projectPath = await findUp(start, 'package.json');
  const project = projectPath ? await readJson(projectPath) : null;
  const declared =
    project?.devDependencies?.['com.amanotes.tapcraft-kit'] ??
    project?.dependencies?.['com.amanotes.tapcraft-kit'] ??
    null;
  return {
    installed: installed?.version ?? null,
    declared,
  };
}

function status(local, minimum, latest) {
  if (!stable(local)) return 'unknown';
  if (compare(local, minimum) < 0) return 'unsupported';
  if (!stable(latest)) return 'supported';
  return compare(local, latest) < 0 ? 'behind' : 'current';
}

const release = await loadReleaseInfo();
if (!release) {
  console.error('[tapcraft] release-info.json is missing');
  process.exitCode = 1;
} else {
  const warnings = [];
  const cacheFile = cachePath();
  const cached = await readJson(cacheFile);
  const cacheFresh =
    cached?.checkedAt &&
    Date.now() - Date.parse(cached.checkedAt) < ttlMs &&
    cached.githubRepository === release.githubRepository;

  let latestPlugin = cacheFresh && !force ? cached.latestPlugin : null;
  let latestKit = cacheFresh && !force ? cached.latestKit : null;
  let source = cacheFresh && !force ? 'cache' : noNetwork ? 'offline' : 'network';

  if (!noNetwork && (!cacheFresh || force)) {
    try {
      const github = await requestJson(
        `https://api.github.com/repos/${release.githubRepository}/releases/latest`,
      );
      latestPlugin = stable(github.tag_name) ? github.tag_name.replace(/^v/, '') : null;
    } catch (error) {
      warnings.push(`plugin latest unavailable: ${error.message}`);
      try {
        const main = await requestJson(
          `https://raw.githubusercontent.com/${release.githubRepository}/main/release-info.json`,
        );
        latestPlugin = stable(main.pluginVersion) ? main.pluginVersion : null;
      } catch (fallbackError) {
        warnings.push(`plugin main unavailable: ${fallbackError.message}`);
      }
    }

    try {
      const npm = await requestJson(
        'https://registry.npmjs.org/com.amanotes.tapcraft-kit/latest',
      );
      latestKit = stable(npm.version) ? npm.version : null;
    } catch (error) {
      warnings.push(`kit latest unavailable: ${error.message}`);
    }

    if (latestPlugin || latestKit) {
      try {
        await mkdir(dirname(cacheFile), { recursive: true });
        await writeFile(
          cacheFile,
          `${JSON.stringify(
            {
              checkedAt: new Date().toISOString(),
              githubRepository: release.githubRepository,
              latestPlugin,
              latestKit,
            },
            null,
            2,
          )}\n`,
        );
      } catch (error) {
        warnings.push(`cache unavailable: ${error.message}`);
      }
    }
  }

  const kit = await loadProjectKit();
  const result = {
    checkedAt: new Date().toISOString(),
    source,
    plugin: {
      installed: release.pluginVersion,
      minimum: release.minimumPluginVersion,
      latest: latestPlugin,
      status: status(
        release.pluginVersion,
        release.minimumPluginVersion,
        latestPlugin,
      ),
      releaseUrl: `https://github.com/${release.githubRepository}/releases/latest`,
    },
    kit: {
      installed: kit.installed,
      declared: kit.declared,
      minimum: release.minimumKitVersion,
      verified: release.verifiedKitVersion,
      latest: latestKit,
      status: status(kit.installed, release.minimumKitVersion, latestKit),
      packageUrl: 'https://www.npmjs.com/package/com.amanotes.tapcraft-kit',
    },
    compatibility: {
      engineVersion: release.engineVersion,
      engineProfile: release.engineProfile,
    },
    warnings,
  };

  if (asJson) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    const value = (v) => v ?? 'unknown';
    console.log(
      `[tapcraft] plugin ${value(result.plugin.installed)} (${result.plugin.status}); latest ${value(result.plugin.latest)}`,
    );
    console.log(
      `[tapcraft] kit ${value(result.kit.installed)} (${result.kit.status}); minimum ${result.kit.minimum}; verified ${result.kit.verified}; latest ${value(result.kit.latest)}`,
    );
    if (result.kit.declared && !result.kit.installed) {
      console.log(`[tapcraft] kit declared as ${result.kit.declared}, but not installed`);
    }
    for (const warning of warnings) console.warn(`[tapcraft] ${warning}`);
  }
}
