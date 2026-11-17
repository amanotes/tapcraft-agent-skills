---
name: tapcraft-check-updates
description: Check the installed TapCraft plugin and tapcraft-kit against their latest stable releases without changing the project.
---

# Check TapCraft updates

Load the `tapcraft` skill, then run its bundled
`scripts/check-updates.mjs` with `--force`.

Report:

- installed, minimum, and latest plugin versions;
- installed, minimum, verified, and latest `com.amanotes.tapcraft-kit`
  versions;
- whether each component is unsupported, behind, current, or unknown;
- release/changelog links when an update is available;
- for a kit below 2.0.0: that kit 1.x games are hidden by the 2.0 app and need the kit 2 port (`references/kit-2-migration.md` of the `tapcraft` skill).

This command is read-only. Do not install, update, or edit project files.
