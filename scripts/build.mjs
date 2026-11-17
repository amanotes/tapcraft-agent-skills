import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const info = JSON.parse(await readFile(join(root, 'release-info.json'), 'utf8'));
const description =
  'Develop, port, optimize, test, and publish Cocos Creator games for the TapCraft platform.';
const author = { name: 'Amanotes TapCraft team' };
const marketplaceName = 'amanotes';
const marketplaceDescription = 'Amanotes TapCraft agent plugins';
const repository = `https://github.com/${info.githubRepository}`;

async function json(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function copyShared(target) {
  await cp(join(root, 'src', 'skills'), join(target, 'skills'), {
    recursive: true,
  });
  await cp(join(root, 'src', 'commands'), join(target, 'commands'), {
    recursive: true,
  });
  await cp(join(root, 'assets'), join(target, 'assets'), { recursive: true });
  await cp(join(root, 'README.md'), join(target, 'README.md'));
  await cp(join(root, 'PRIVACY.md'), join(target, 'PRIVACY.md'));
  await cp(join(root, 'LICENSE'), join(target, 'LICENSE'));
  await cp(join(root, 'release-info.json'), join(target, 'release-info.json'));
}

const packages = join(root, 'packages');
const claude = join(packages, 'claude');
const cursor = join(packages, 'cursor');
await rm(packages, { recursive: true, force: true });
await rm(join(root, '.claude-plugin'), { recursive: true, force: true });
await rm(join(root, '.cursor-plugin'), { recursive: true, force: true });
await mkdir(claude, { recursive: true });
await mkdir(cursor, { recursive: true });
await copyShared(claude);
await copyShared(cursor);
await cp(join(root, 'src', 'rules'), join(cursor, 'rules'), {
  recursive: true,
});

await json(join(claude, '.claude-plugin', 'plugin.json'), {
  name: 'tapcraft',
  version: info.pluginVersion,
  description,
  author,
  homepage: repository,
  repository,
  privacyPolicyUrl: `${repository}/blob/main/PRIVACY.md`,
  icon: 'assets/icon.png',
  license: 'Apache-2.0',
  keywords: ['tapcraft', 'cocos-creator', 'game-development', 'tapcraft-sdk'],
});
await json(join(claude, '.mcp.json'), {
  mcpServers: {
    tapcraft: {
      type: 'http',
      url: info.mcpUrl,
    },
  },
});

await json(join(cursor, '.cursor-plugin', 'plugin.json'), {
  name: 'tapcraft',
  version: info.pluginVersion,
  description,
  author,
  homepage: repository,
  repository,
  logo: 'assets/icon.png',
  license: 'Apache-2.0',
  keywords: ['tapcraft', 'cocos-creator', 'game-development', 'tapcraft-sdk'],
  skills: './skills/',
  rules: './rules/',
  commands: './commands/',
  mcpServers: './mcp.json',
});
await json(join(cursor, 'mcp.json'), {
  mcpServers: {
    tapcraft: {
      url: info.mcpUrl,
    },
  },
});

await json(join(root, '.claude-plugin', 'marketplace.json'), {
  $schema: 'https://json.schemastore.org/claude-code-marketplace.json',
  name: marketplaceName,
  version: info.pluginVersion,
  description: marketplaceDescription,
  owner: { ...author, url: 'https://github.com/amanotes' },
  plugins: [
    {
      name: 'tapcraft',
      description,
      version: info.pluginVersion,
      author,
      source: './packages/claude',
      category: 'development',
    },
  ],
});
await json(join(root, '.cursor-plugin', 'marketplace.json'), {
  name: marketplaceName,
  owner: author,
  metadata: {
    description: marketplaceDescription,
    version: info.pluginVersion,
  },
  plugins: [
    {
      name: 'tapcraft',
      source: './packages/cursor',
      description,
      version: info.pluginVersion,
      license: 'Apache-2.0',
      repository,
    },
  ],
});

console.log(`[build] generated Claude and Cursor packages v${info.pluginVersion}`);
