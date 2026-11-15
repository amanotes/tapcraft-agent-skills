# Privacy

The TapCraft agent plugin does not collect telemetry and does not send source
code, prompts, or project files to the plugin authors.

## Version checks

The bundled read-only update check may request:

- the latest release metadata from GitHub for
  `amanotes/tapcraft-agent-skills`;
- public package metadata from the npm registry for
  `com.amanotes.tapcraft-kit`.

It sends ordinary HTTP metadata, caches only timestamps and version strings on
the local machine, and continues without the network. It never uploads project
content or installs an update.

## TapCraft platform MCP

When enabled, the separately operated TapCraft MCP uses OAuth and communicates
with `https://tap-craft-8ezo.web.app/api/mcp`. The client asks the user to sign
in and manages credentials. This repository contains no credentials.

Data sent to MCP tools is limited to the arguments the user or agent approves
for game management and publishing. Uploads use short-lived URLs returned by
the service.

## Contact

Report privacy or security concerns through the issue tracker of the repository
from which this plugin was installed.
