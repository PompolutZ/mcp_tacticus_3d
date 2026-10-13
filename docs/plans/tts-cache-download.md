# Plan: Download missing TTS files in the migrate scripts

Requested on 2026-10-13. The user asked for a way to migrate the character models, crisis cards and Team Tactic cards that the app does not have yet. Their files are not in the TTS cache. The user chose a direct download over a TTS script. To keep the load on the mod CDN low, the download goes one file at a time, and the characters go one at a time: download the files of one character, migrate it, then the next.

## Facts

Checked on 2026-10-13:
- The migrate scripts read files only from the TTS cache (`cachedFile` in `scripts/lib/tts.mjs`). TTS downloads a file only when an object uses it.
- Missing in the cache: 1,021 of 1,560 character URLs (models, cards, standees, portraits). About 180 of 274 characters have no file. 325 of 402 tactic cards and 19 of 47 crisis cards miss at least one image.
- Host of the missing character URLs: 1,013 on `d37ev18qvj5a3m.cloudfront.net` (the mod CDN), 8 on `steamusercontent-a.akamaihd.net`.
- A cache file has the same bytes as the download. Checked with MD5 for `STORM_MODEL.unity3d` and `STORM_healthy.jpg`.
- Cache folders: `Assetbundles/` (`.unity3d`), `Models/` (`.obj`), `Images/` (`.png`, `.jpg`, `.webp`). The file name is the URL without the characters that are not letters or digits, plus an extension. A Steam image URL has no extension. TTS gives it the extension of the image type. `cachedFile` ignores the extension.

## Decisions

1. **A `--download` option** in `migrate-characters`, `migrate-tactics` and `migrate-crisis`. No new script. Without the option, the scripts work as today.
2. **Only the files the script uses.** The download takes the file list that the script already builds (`characterFiles(row)` and the face and back lists of the tactic and crisis scripts), and only the files that `cachedFile` does not find.
3. **One item at a time.** For each character or card: download its missing files, then convert it, then go to the next. So a stopped run keeps every finished item.
4. **One file at a time.** No parallel downloads.
5. **A failed download** is a warning when the file is optional, as a missing cache file is today. When a required file fails, the item fails with the URL and the reason, and the script goes on with the next item.
6. **`missing` selection** in `migrate-characters`: every character that has a model or a standee in the mod and has no entry in `character-manifest.json`. Example: `migrate-characters --download missing`.
7. **Cache folder and extension.** The URL extension `.unity3d` goes to `Assetbundles/`, `.obj` to `Models/`, any other to `Images/`. An image gets the extension of its type, from the first bytes (PNG, JPEG, WebP). A file of an unknown type is not written and counts as a failed download.
8. **Safe writes.** Write to a temp file in the same folder, then rename. A stopped run leaves no half file that `cachedFile` would find.

## Phase 1: `--download` in the migrate scripts

Read: this plan, `scripts/lib/tts.mjs`, `scripts/lib/cli.mjs`, `scripts/migrate-characters.mjs`, `scripts/migrate-tactics.mjs`, `scripts/migrate-crisis.mjs`, `scripts/README.md` (the start, "TTS character migration", "TTS crisis cards", "TTS tactic cards").

Work:
1. `scripts/lib/tts.mjs`: export `downloadToCache(url)` (decisions 7 and 8). It reuses the name rule of `cachedFile`. It adds the new file to the `cache` map, so `cachedFile` finds it in the same run. The folder and extension choice is a small pure function with a unit test, in the style of `lib/*.test.js`.
2. `scripts/lib/cli.mjs`: a `--download` option for the three scripts. The other migrate scripts do not accept it.
3. `migrate-characters.mjs`: decisions 2 to 6. Download inside the loop of `migrate`, before `migrateCharacter`. Print each file as it downloads.
4. `migrate-tactics.mjs` and `migrate-crisis.mjs`: decisions 2 to 5, per card. The crisis token images and the backs are in the cache already, so download only the files the script reads.
5. Usage text of the three scripts, and `scripts/README.md`: the option, the `missing` selection, the facts above. In the requirements of the three sections, name `--download` as the other way to fill the cache.

Checks: `pnpm format`, `pnpm lint`, the tests of `apps/web`. One real run: `migrate-crisis --download` (19 small images), then `migrate-crisis --list` shows them as migrated. One real run of `migrate-characters --download` with one character that has no file in the cache (one that `--list` does not show). Do not run `missing` or the full tactics download: the user runs them. Commit the crisis and the one character assets with the step.

## Result

Phase 1 done.

Built:
- `lib/tts.mjs`: `cacheTarget(url, bytes)` (pure, tested in `lib/tts.test.js`), `downloadToCache(url)` (temp file + rename, adds to the `cache` map), and `downloadMissing(urls)` (sequential, one line per file, returns failures). `cachedFile` now uses a shared `cacheMap()`.
- `lib/cli.mjs`: `--download` only with `parseMigrateArgs(usage, isValid, { download: true })`. The other scripts reject it.
- The three scripts: download per item inside the loop, before converting. A failed required file gives `failed: download <url> (<reason>)` and exit code 1. Characters: optional file failures are warnings. `migrate-characters` also takes `missing`.
- README: usage, new "Download" subsection in "TTS character migration" (facts and rules), pointers in the crisis and tactics sections.

Runs:
- `migrate-crisis --download`: 19 face images downloaded, 0 failures, 12 token files converted. `--list` shows every card as migrated (45 of 45; the 47 in the Facts include 2 test cards the script skips).
- `migrate-characters --download "Beta Ray Bill"`: 3 files downloaded (2 cards, model; no portrait in the mod row), converted 4 of 4 files, 0 failures.
- `pnpm format`, `pnpm lint` (only old warnings), 596 tests pass, `pnpm --filter web build` ok. `missing` and the tactics download were not run.

Differences from the plan: none in behavior. `apps/web/tools/` (AssetRipper) is not in a new worktree, so it was linked from the main dir for the character run and the link was removed.
