# TapCraft Agent Plugin

Agent skill + MCP for building, porting, optimizing, and publishing Cocos
Creator games on TapCraft.

## Install

**Claude Code**

```bash
claude plugin marketplace add amanotes/tapcraft-agent-skills
claude plugin install tapcraft@amanotes
```

**Cursor**: Settings → Plugins → Add from GitHub Repository →
`https://github.com/amanotes/tapcraft-agent-skills`.

Then enable the `tapcraft` MCP, sign in, and ask the agent to run `whoami`.

## Usage

Just ask the agent about your TapCraft game. To start a project:

```bash
npx com.amanotes.tapcraft-kit@2.0.0 create <slug>   # new game
npm i -D com.amanotes.tapcraft-kit@2.0.0 && npx tapcraft init   # existing game
```

Game code imports one facade, `import { Tapcraft } from '../tapcraft'`;
update a game with `npm i com.amanotes.tapcraft-kit@latest` (syncs
`assets/tapcraft/`). Kit 1.x games are hidden by the 2.0 app until ported and
republished; the skill has a migration guide.

Check for updates with `/tapcraft:check-updates`, then
`claude plugin update tapcraft@amanotes` or reinstall from Cursor Settings.

## Compatibility

Plugin 2.0.0 · `com.amanotes.tapcraft-kit` 2.0.0 (SDK 2, protocol 2) · Cocos Creator 4.0.0-beta.1
(engine profile `8ec328`)

## Development

Edit `src/` or `release-info.json`, never `packages/` (generated). Run
`npm test` to build and validate.

Apache-2.0 · [Privacy](PRIVACY.md)
