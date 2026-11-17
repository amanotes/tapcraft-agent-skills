# Publishing through the TapCraft MCP

The MCP is authoritative for current tool schemas and workflows. Authenticate once through the client's MCP UI, then start with `whoami`.

Use prompts:

- `first_release`
- `new_build`
- `update_store_page`
- `rollback`

Read resources:

- `tapcraft://guide/workflows`
- `tapcraft://guide/store-media`

## Model

- **Game:** permanent slug matching `game.json.id`.
- **Build:** immutable pack zip for one platform, with an increasing build number. `tapcraft pack` writes `tapcraft.json` `{ kit, protocol, sdk }` at the zip root; the API records `protocol` per build (missing file = 1) and writes it into the catalog.
- **Game files:** `remote/`, `data/`, and `assets/` of the game, uploaded through the MCP.
- **Version:** version string, iOS/Android build numbers, and store listing.

## Protocol gating and republishing

The 2.0 app speaks protocol 2 only and hides catalog entries whose protocol it does not speak. A game built with kit 1.x stays hidden until it is rebuilt with kit 2 and republished as a **new build and new version** (builds of a published version never change). Kit 1.x saves are not migrated: players start with empty saves, so confirm that is acceptable before publishing a kit 2 build. Do not publish a pack that `tapcraft pack` did not produce.

## Release order

1. For a first release, confirm the permanent `game.json.id`, then use the
   `first_release` prompt and `create_game`.
2. Run `npx tapcraft build all` (fails when `assets/tapcraft/` is out of sync: `npx tapcraft sync`).
3. Run `npx tapcraft check`; fix errors and review warnings.
4. Test both platforms through `npx tapcraft serve`.
5. Call `upload_files { game, prefix: "remote/" }`. Run the returned
   `uploadFolder` command with `LOCAL_FOLDER=build/ios-hub/data/remote`, then
   again with `LOCAL_FOLDER=build/android-hub/data/remote`.
6. When present, upload `files/data` with prefix `data/`, and `files/assets`
   with prefix `assets/`. `Tapcraft.content.url('assets/...')` does not work until the
   matching assets upload exists.
7. Run `npx tapcraft pack all`. It writes `tapcraft.json` into the zip and must confirm every remote file exists with
   the expected hash.
8. Per platform, call `create_build` and execute its returned `upload.curl`
   with `build/tapcraft-<platform>.zip`.
9. Wait until both builds are `ready`; a failed/invalid build is replaced by a
   new build.
10. Create or update a version, request media uploads, run each returned
    `upload.curl`, and assign both builds.
11. Fetch and show the final version state. The API re-reads each build's
    `settings*.json` and refuses `publish_version` when a listed remote
    bundle manifest (`remote/<bundle>/cc.config.<ver>.json`) is missing.
12. Ask for explicit confirmation before `publish_version`.

## Game files

Remote bundle files are create-only and immutable. Data is replaceable with a short cache. Do not delete remote files used by any published version or rollback target. Where files live on the CDN is the platform's concern: use the prefixes and commands the MCP returns.

## Safety

- Use upload commands returned by MCP; signed URLs expire.
- Never type or persist signed upload URLs.
- Only the MCP writes platform/CDN storage.
- `upload_files` takes a prefix relative to the game's files (`remote/`,
  `data/`, `assets/`); never upload to a bucket path.
- Ask before publish, unpublish, delete, move, or membership/role changes.
- Roll back by publishing an older valid version through the supported workflow.
