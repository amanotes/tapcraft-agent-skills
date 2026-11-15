# TapCraft agent plugin

The official agent skill and MCP configuration for developing, porting,
testing, optimizing, and publishing Cocos Creator games on the TapCraft
platform.

One canonical skill is packaged for both Claude Code and Cursor. TapCraft
contracts override generic Cocos defaults for asset bundles, remote content,
lifecycle, saves, build settings, performance, and publishing.

## Compatibility

| Component | Verified baseline |
|---|---|
| Agent plugin | 1.0.0 |
| `com.amanotes.tapcraft-kit` | 1.1.0 |
| Cocos Creator | 4.0.0-beta.1 |
| Engine profile | `8ec328` |

TapCraft prefers the latest stable plugin and kit. The skill performs a
read-only version check at the beginning of a TapCraft task. It never installs
or upgrades anything automatically.

## Install in Claude Code

From the Amanotes GitLab repository:

```bash
claude plugin marketplace add git@gitlab.amanotes.net:sdk/game-studio/tapcraft-agent-skills.git
claude plugin install tapcraft@tapcraft
```

After the public GitHub mirror is available:

```bash
claude plugin marketplace add amanotes/tapcraft-agent-skills
claude plugin install tapcraft@tapcraft
```

Start a new session or run `/reload-plugins`. Claude automatically discovers
the `tapcraft` skill from its description. `/tapcraft:tapcraft` is the explicit
fallback.

## Install in Cursor

After the GitHub mirror is public:

1. Open **Cursor Settings → Plugins**.
2. Choose **Add from GitHub Repository**.
3. Paste `https://github.com/amanotes/tapcraft-agent-skills`.
4. Install the `tapcraft` plugin.

For local development, build the repository and load `packages/cursor` as a
local Cursor plugin.

The Cursor package includes a small router rule that loads the skill whenever
the prompt mentions TapCraft or the project depends on
`com.amanotes.tapcraft-kit`.

## Connect the platform MCP

Both packages include the same OAuth MCP endpoint. Open the client's MCP panel,
enable `tapcraft`, and complete sign-in. Start with `whoami` to verify account
and studio access.

The repository is safe to publish publicly, but game management and publishing
require an authorized TapCraft account. No tokens or upload credentials belong
in this repository.

## Start or migrate a game

Current verified baseline:

```bash
npm install --save-dev com.amanotes.tapcraft-kit@1.1.0
npx tapcraft init
npx tapcraft build all
npx tapcraft check
npx tapcraft serve
```

For a new project:

```bash
npx com.amanotes.tapcraft-kit@1.1.0 create <slug>
```

Before choosing a newer stable kit, run the update check and read that release's
changelog and app compatibility requirements.

## Updates

Ask the agent to check TapCraft updates. In Claude Code, the explicit command
is `/tapcraft:check-updates`. From a source checkout, either generated package
contains the same read-only script:

```bash
node packages/claude/skills/tapcraft/scripts/check-updates.mjs --force
node packages/cursor/skills/tapcraft/scripts/check-updates.mjs --force
```

Claude Code:

```bash
claude plugin update tapcraft@tapcraft
```

Cursor update behavior depends on how the plugin was installed. Refresh the
GitHub marketplace or reinstall the plugin when an update is reported; this
repository does not claim unsupported automatic updates.

## Repository structure

```text
src/                         canonical source
  skills/tapcraft/
  rules/
  commands/
packages/claude/             generated Claude Code plugin
packages/cursor/             generated Cursor plugin
.claude-plugin/              generated Claude marketplace
.cursor-plugin/              generated Cursor marketplace
scripts/                     build and validation
test/                        update-check tests
```

Do not edit generated package files. Change `src/` or `release-info.json`, then
run:

```bash
npm test
```

The build is deterministic and validation fails when the two distributions
drift, contain stale storage contracts, or expose likely secrets.

## License

Apache-2.0.

See [Privacy](PRIVACY.md) for the update checker and platform MCP data flow.
