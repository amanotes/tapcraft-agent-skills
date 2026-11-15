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
- release/changelog links when an update is available.

This command is read-only. Do not install, update, or edit project files.
