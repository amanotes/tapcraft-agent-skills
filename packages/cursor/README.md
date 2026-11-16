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
npx com.amanotes.tapcraft-kit@1.2.0 create <slug>   # new game
npm i -D com.amanotes.tapcraft-kit@1.2.0 && npx tapcraft init   # existing game
```

Check for updates with `/tapcraft:check-updates`, then
`claude plugin update tapcraft@amanotes` or reinstall from Cursor Settings.

## Compatibility

Plugin 1.1.1 · `com.amanotes.tapcraft-kit` 1.2.0 · Cocos Creator 4.0.0-beta.1
(engine profile `8ec328`)

## Development

Edit `src/` or `release-info.json`, never `packages/` (generated). Run
`npm test` to build and validate.

Apache-2.0 · [Privacy](PRIVACY.md)
