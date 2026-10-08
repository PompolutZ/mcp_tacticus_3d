# mcp_assist_3d

## TTS assets

To migrate a map (mat and terrain) from the TTS mod, read `apps/web/scripts/README.md` first. It describes `apps/web/scripts/migrate-terrain.mjs`, the AssetRipper steps, and the TTS rules that were measured. `ASSETS.md` lists what the TTS cache has.

## Verifying changes

Do not open the app in a browser (playwright-cli, dev server, screenshots) to check a change unless I ask for it in that message. `pnpm --filter web build` to catch errors is fine. I check the result in the browser myself.

## Paths in docs

In `docs/`, the paths `src/`, `public/`, `scripts/` and `tools/` are under `apps/web/`.
