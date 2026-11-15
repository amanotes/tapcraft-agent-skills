import { access, readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];

async function json(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    errors.push(`${relative(root, path)}: ${error.message}`);
    return null;
  }
}

async function filesUnder(path) {
  const result = [];
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const child = join(path, entry.name);
    if (entry.isDirectory()) result.push(...(await filesUnder(child)));
    else result.push(child);
  }
  return result.sort();
}

async function digestMap(path) {
  const map = {};
  for (const file of await filesUnder(path)) {
    const bytes = await readFile(file);
    map[relative(path, file)] = createHash('sha256').update(bytes).digest('hex');
  }
  return map;
}

function equal(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

const info = await json(join(root, 'release-info.json'));
const packageManifest = await json(join(root, 'package.json'));
const claudeManifest = await json(
  join(root, 'packages', 'claude', '.claude-plugin', 'plugin.json'),
);
const cursorManifest = await json(
  join(root, 'packages', 'cursor', '.cursor-plugin', 'plugin.json'),
);
const claudeMcp = await json(join(root, 'packages', 'claude', '.mcp.json'));
const cursorMcp = await json(join(root, 'packages', 'cursor', 'mcp.json'));
const claudeMarketplace = await json(
  join(root, '.claude-plugin', 'marketplace.json'),
);
const cursorMarketplace = await json(
  join(root, '.cursor-plugin', 'marketplace.json'),
);

for (const [label, manifest] of [
  ['Claude manifest', claudeManifest],
  ['Cursor manifest', cursorManifest],
]) {
  if (manifest?.name !== 'tapcraft') errors.push(`${label}: name must be tapcraft`);
  if (manifest?.version !== info?.pluginVersion) {
    errors.push(`${label}: version must match release-info.json`);
  }
}
if (packageManifest?.version !== info?.pluginVersion) {
  errors.push('package.json version must match release-info.json');
}
if (claudeManifest?.icon !== 'assets/icon.png') {
  errors.push('Claude manifest must use the TapCraft app icon');
}
if (cursorManifest?.logo !== 'assets/icon.png') {
  errors.push('Cursor manifest must use the TapCraft app icon');
}

for (const [label, marketplace] of [
  ['Claude marketplace', claudeMarketplace],
  ['Cursor marketplace', cursorMarketplace],
]) {
  const plugin = marketplace?.plugins?.[0];
  if (marketplace?.name !== 'tapcraft' || plugin?.name !== 'tapcraft') {
    errors.push(`${label}: marketplace and plugin names must be tapcraft`);
  }
  if (plugin?.version !== info?.pluginVersion) {
    errors.push(`${label}: version must match release-info.json`);
  }
}

if (claudeMcp?.mcpServers?.tapcraft?.url !== info?.mcpUrl) {
  errors.push('Claude MCP URL does not match release-info.json');
}
if (cursorMcp?.mcpServers?.tapcraft?.url !== info?.mcpUrl) {
  errors.push('Cursor MCP URL does not match release-info.json');
}

const sourceSkill = join(root, 'src', 'skills', 'tapcraft');
const claudeSkill = join(root, 'packages', 'claude', 'skills', 'tapcraft');
const cursorSkill = join(root, 'packages', 'cursor', 'skills', 'tapcraft');
const sourceDigest = await digestMap(sourceSkill);
if (!equal(sourceDigest, await digestMap(claudeSkill))) {
  errors.push('Claude skill differs from canonical source');
}
if (!equal(sourceDigest, await digestMap(cursorSkill))) {
  errors.push('Cursor skill differs from canonical source');
}
const sourceCommands = await digestMap(join(root, 'src', 'commands'));
if (
  !equal(
    sourceCommands,
    await digestMap(join(root, 'packages', 'claude', 'commands')),
  )
) {
  errors.push('Claude commands differ from canonical source');
}
if (
  !equal(
    sourceCommands,
    await digestMap(join(root, 'packages', 'cursor', 'commands')),
  )
) {
  errors.push('Cursor commands differ from canonical source');
}
if (
  !equal(
    await digestMap(join(root, 'src', 'rules')),
    await digestMap(join(root, 'packages', 'cursor', 'rules')),
  )
) {
  errors.push('Cursor rules differ from canonical source');
}
const sourceAssets = await digestMap(join(root, 'assets'));
if (
  !equal(
    sourceAssets,
    await digestMap(join(root, 'packages', 'claude', 'assets')),
  ) ||
  !equal(
    sourceAssets,
    await digestMap(join(root, 'packages', 'cursor', 'assets')),
  )
) {
  errors.push('Generated package assets differ from canonical assets');
}
const icon = await readFile(join(root, 'assets', 'icon.png'));
if (
  icon.subarray(1, 4).toString() !== 'PNG' ||
  icon.readUInt32BE(16) !== 1024 ||
  icon.readUInt32BE(20) !== 1024
) {
  errors.push('assets/icon.png must be the 1024x1024 TapCraft PNG');
}

const skillPath = join(sourceSkill, 'SKILL.md');
const skill = await readFile(skillPath, 'utf8');
if (skill.split('\n').length > 500) errors.push('SKILL.md exceeds 500 lines');
if (!skill.startsWith('---\nname: tapcraft\n')) {
  errors.push('SKILL.md frontmatter name must be tapcraft');
}
for (const trigger of [
  'TapCraft',
  'com.amanotes.tapcraft-kit',
  'remote asset bundles',
  'TapCraft MCP',
]) {
  if (!skill.includes(trigger)) errors.push(`SKILL.md description misses ${trigger}`);
}
for (const [path, values] of [
  [
    join(root, 'README.md'),
    [
      info.pluginVersion,
      info.verifiedKitVersion,
      info.engineVersion,
      info.engineProfile,
    ],
  ],
  [
    skillPath,
    [info.verifiedKitVersion, info.engineVersion, info.engineProfile],
  ],
  [
    join(sourceSkill, 'references', 'game-contract.md'),
    [info.verifiedKitVersion, info.engineVersion, info.engineProfile],
  ],
]) {
  const text = await readFile(path, 'utf8');
  for (const value of values) {
    if (!text.includes(value)) {
      errors.push(`${relative(root, path)}: missing release value ${value}`);
    }
  }
}

const checkedRoots = [
  join(root, 'README.md'),
  join(root, 'src'),
  join(root, 'packages'),
];
const checkedFiles = [];
for (const target of checkedRoots) {
  if (extname(target)) checkedFiles.push(target);
  else checkedFiles.push(...(await filesUnder(target)));
}

const secretPatterns = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\bgh[opsu]_[A-Za-z0-9]{30,}\b/,
  /\bAIza[A-Za-z0-9_-]{30,}\b/,
  /\bAKIA[A-Z0-9]{16}\b/,
];
const stalePatterns = [
  /\btap-craft-game-dev\b/,
  /catalog\/v2\//,
  /\bpromote_build\b/,
  /\bpublish_catalog\b/,
];

for (const file of checkedFiles) {
  if (!['.md', '.mdc', '.mjs', '.json', '.ts'].includes(extname(file))) continue;
  const text = await readFile(file, 'utf8');
  for (const pattern of secretPatterns) {
    if (pattern.test(text)) errors.push(`${relative(root, file)}: likely secret`);
  }
  for (const pattern of stalePatterns) {
    const offending = text
      .split('\n')
      .find(
        (line) =>
          pattern.test(line) &&
          !/\b(never|removed|legacy|do not use)\b/i.test(line),
      );
    if (offending) {
      errors.push(`${relative(root, file)}: stale contract: ${offending.trim()}`);
    }
  }

  if (extname(file) === '.md' || extname(file) === '.mdc') {
    for (const match of text.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
      const href = match[1].split('#')[0];
      if (!href || /^(https?:|mailto:)/.test(href)) continue;
      try {
        await access(resolve(dirname(file), href));
      } catch {
        errors.push(`${relative(root, file)}: broken link ${match[1]}`);
      }
    }
  }
}

if (errors.length) {
  for (const error of errors) console.error(`[check] ${error}`);
  process.exit(1);
}

console.log(
  `[check] plugin ${info.pluginVersion}; ${Object.keys(sourceDigest).length} canonical skill files; no errors`,
);
