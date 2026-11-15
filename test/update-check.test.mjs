import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const script = new URL(
  '../src/skills/tapcraft/scripts/check-updates.mjs',
  import.meta.url,
);

async function fixture({ plugin = '1.0.0', kit, latestPlugin, latestKit }) {
  const root = await mkdtemp(join(tmpdir(), 'tapcraft-updates-'));
  const project = join(root, 'game');
  const releasePath = join(root, 'release-info.json');
  const cachePath = join(root, 'cache.json');
  await mkdir(project, { recursive: true });
  await writeFile(
    join(project, 'package.json'),
    JSON.stringify({
      devDependencies: { 'com.amanotes.tapcraft-kit': `^${kit}` },
    }),
  );
  await mkdir(
    join(project, 'node_modules', 'com.amanotes.tapcraft-kit'),
    { recursive: true },
  );
  await writeFile(
    join(project, 'node_modules', 'com.amanotes.tapcraft-kit', 'package.json'),
    JSON.stringify({ name: 'com.amanotes.tapcraft-kit', version: kit }),
  );
  await writeFile(
    releasePath,
    JSON.stringify({
      pluginVersion: plugin,
      minimumPluginVersion: '1.0.0',
      minimumKitVersion: '1.1.0',
      verifiedKitVersion: '1.1.0',
      engineVersion: '4.0.0-beta.1',
      engineProfile: '8ec328',
      githubRepository: 'phuongntamanotes/tapcraft-agent-skills',
    }),
  );
  if (latestPlugin || latestKit) {
    await mkdir(dirname(cachePath), { recursive: true });
    await writeFile(
      cachePath,
      JSON.stringify({
        checkedAt: new Date().toISOString(),
        githubRepository: 'phuongntamanotes/tapcraft-agent-skills',
        latestPlugin,
        latestKit,
      }),
    );
  }
  return { root, project, releasePath, cachePath };
}

function run(f) {
  const result = spawnSync(
    process.execPath,
    [script.pathname, '--json', '--no-network'],
    {
      cwd: f.project,
      encoding: 'utf8',
      env: {
        ...process.env,
        TAPCRAFT_PROJECT_ROOT: f.project,
        TAPCRAFT_RELEASE_INFO: f.releasePath,
        TAPCRAFT_UPDATE_CACHE: f.cachePath,
      },
    },
  );
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test('rejects a kit below the supported baseline', async () => {
  const f = await fixture({ kit: '1.0.0' });
  try {
    const result = run(f);
    assert.equal(result.kit.status, 'unsupported');
    assert.equal(result.kit.minimum, '1.1.0');
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});

test('accepts the verified baseline offline', async () => {
  const f = await fixture({ kit: '1.1.0' });
  try {
    const result = run(f);
    assert.equal(result.kit.status, 'supported');
    assert.equal(result.plugin.status, 'supported');
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});

test('reports newer stable plugin and kit versions from cache', async () => {
  const f = await fixture({
    kit: '1.1.0',
    latestPlugin: '1.1.0',
    latestKit: '1.2.0',
  });
  try {
    const result = run(f);
    assert.equal(result.source, 'cache');
    assert.equal(result.plugin.status, 'behind');
    assert.equal(result.kit.status, 'behind');
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});
