# Plan: Grunts and constructs

Requested on 2026-10-13. The user asked to download the constructs and grunts of a character with the character, and to spawn them under the character card when the character spawns.

## Facts

Checked on 2026-10-13 in the mod (`Database`, Red Tray Spawner `trayScript`) and in Jarvis:

- **Constructs.** 2 mod rows have `construct`: Magneto and Phoenix, 2 URLs each (`MAGNETO_CONSTRUCT_1.jpg`, ...). The URLs end in `.jpg`, but the mod loads them as asset bundles (`Custom_Assetbundle`, `assetbundle = url`). So they are 3D models. None is in the TTS cache.
- TTS spawns the constructs with the character (`spawnDefaults`): small, team color, name "Construct", 1.79" to the side of the tray, 1.5" apart. The tray also has a "Spawn Construct" button that spawns one more.
- In the rules, a construct is a terrain feature, not a character. Magneto: "During the Power Phase, if there are fewer than 2 allied Metal Construct terrain features in play, Place 1 allied Metal Construct ... within range 3." He gains 1 Power for each allied Metal Construct in play.
- **Grunts.** 7 mod rows have `grunts`: Elektra, Multiple Man, Nick Fury, Red Skull Master of Hydra, Sandman, Shadowland Daredevil, Ultron Metal Tyrant. 7 grunt rows: Hand Ninjas (Elektra and Shadowland Daredevil), Multiple Man Duplicates, S.H.I.E.L.D. Agents, Hydra Troopers, Sand Construct - Fisty and Sand Constructs - Twisty (Sandman), Ultron Drones. A grunt row has `daddy`, and its own card, model, standee, `cStamH`, `cToken` and immunities.
- TTS spawns each grunt with the host: its card below the tray (6.9" toward the owner, 1.8" to the side), the model on that card, and a Wounds counter. Sandman's 2 grunt cards lie side by side.
- Jarvis: a grunt row has `isGrunt` and no `exportCode`, so a roster never lists it. The host row has `relatedGrunts`. Grunts have no Injured side (`backSide` is null) and cannot have Power (p21).
- Ultimate Encounters (Magneto Mutant Masterworks, Ultron Master of Metal, ...) have their own spawn code in the mod. They are not part of this plan.

## Decisions

1. **Migration.** `migrate-characters` migrates the constructs and grunts of a selected character. A grunt is migrated as a character under its own key. A host selection also selects its grunts. `missing` and `--download` include them.
2. **The field decides the file type, not the URL.** A `construct` URL is an asset bundle, so it goes to `Assetbundles/` and is converted as a model.
3. **Data.** `characters.json` of the host gets `constructs` (the number of construct GLBs) and `grunts` (the keys of its grunt characters).
4. **Spawn.** When a host spawns, its grunts and constructs spawn too. They are under the host card: on the owner's side of the tray, past the Give sources. Library and roster spawn the same way.
5. **A construct** is a model of the host, with no tray, no card and no stats. Base small, team color. It does not count as the host on the mat (Power Phase, Cleanup), and it cannot hold tokens. A destroyed construct goes back with the host's **Remove**, or the player drags it off the mat. No "Spawn Construct" button: Magneto has at most 2.
6. **A grunt** is its own character in the game state, with a link to its host. It has its own card, Damage and tokens. It has no Power and no Flip (no Injured side). Its card lies on the host's tray below the host card(s), so the tray grows toward the owner. Sandman's 2 grunt cards lie side by side, so his tray is wider.
7. **Delete.** Delete on the host card deletes the host with its grunts and constructs, after the same confirm. A grunt and a construct cannot be deleted alone.
8. The Library does not list grunts as their own rows.

## Phase 1: migrate constructs and grunts

Read: this plan, `scripts/README.md` ("TTS character migration", "Download"), `scripts/migrate-characters.mjs`, `scripts/lib/tts.mjs`, `scripts/lib/tts.test.js`.

Work:
1. `lib/tts.mjs`: `cacheTarget` and `downloadToCache` take the kind of the file (model or image) from the caller, so a construct `.jpg` goes to `Assetbundles/` (decision 2). Test.
2. `migrate-characters.mjs`: remove `construct` from `IGNORED_FIELDS`. Add the construct files to `characterFiles` as `characters/<key>/construct-<n>.glb` (optional files, converted as models). Write `constructs` and `grunts` in `characters.json` (decision 3). A host selection adds its grunts (match by `cName`, as `affiliationCharacters` does).
3. README: the construct and grunt rules above.

Checks: `pnpm format`, `pnpm lint`, tests. Real runs with `--download`: `Magneto`, then `Elektra` (gives Hand Ninjas), then `Sandman` (2 grunts). `--list` shows them as migrated. Commit the assets with the step.

## Phase 2: constructs in the app

Read: this plan, `docs/features/character-trays.md`, `src/characters/models.js`, `src/characters/trays.js`, `src/characters/newCharacter.js`, `src/characters/characters.js`, and the code that renders the models.

Work:
1. `characters.js`: `constructs` from `characters.json`.
2. `models.js`: the construct models of a character, after its other models, with their own ids (as `secondModelId`). `characterOnBoard` and the token drop skip them (decision 5).
3. `trays.js`: the table place of each construct: past the Give sources, in a row from the owner's left, after a spare model (Phoenix has both).
4. Remove puts the constructs back to their places too.
5. Feature: `character-trays.md`, a new section "Constructs", and the out-of-scope list.

Checks: format, lint, tests (new tests for the places and the on-mat check), build.

## Phase 3: grunts in the app

Read: this plan, `docs/features/character-trays.md` ("Tray layout", "Second forms", "State"), `src/characters/trays.js`, `src/characters/newCharacter.js`, `src/characters/useCharacterActions.js`, `src/rosters/cards.js`, the tray components and the Library list.

Work:
1. `characters.js`: `grunts` from `characters.json`. The Library hides grunt rows (decision 8).
2. Spawn: a host spawn also adds one character per grunt, with `host: <host id>` (decision 6). P2P sends them as normal characters.
3. `trays.js`: grunt cards on the host tray, below the host card(s), side by side for 2. The tray width for Sandman. The grunt model spawns on its card.
4. Tray controls of a grunt: Damage and tokens, no Power and no Flip.
5. Delete of a host deletes its grunts and constructs (decision 7).
6. `rosters/cards.js`: the host's grunt cards in `variants`, so the roster popup can show them.
7. Feature: `character-trays.md` (grunts section, remove grunts from out of scope, update decisions 14 and 15), `roster.md` (grunt variants).

Checks: format, lint, tests, build.

If the coder finds phase 3 too large, split it after item 3.

## Result

Phase 1 done.

Built:
- `scripts/lib/tts.mjs`: `cacheTarget(url, bytes, kind)` and `downloadToCache(url, kind)` take the kind of the file. Kind `model` ignores the URL extension: `.obj` goes to `Models/`, a file that starts with `UnityFS` goes to `Assetbundles/`, anything else fails. `downloadMissing` takes URLs or `{ url, kind }`. Two new tests in `lib/tts.test.js`.
- `src/characters/files.js`: `characterConstruct(key, n)` gives `characters/<key>/construct-<n>.glb`.
- `migrate-characters.mjs`: `construct` is no longer ignored. The construct files are optional model files with a small base. A host selection adds its grunts right after it (matched by `cName`, a name that does not match one row gets a warning). `characters.json` gets `constructs` and `grunts`.
- README: construct and grunt rules in a new section "Constructs and grunts", the output table, the download rule for kind `model`.

Runs (one file at a time, no failures, no warnings):
- `--download Magneto`: 2 construct bundles downloaded, 2 files converted (`construct-1.glb` 332 KB, `construct-2.glb` 275 KB). No `--force` needed: the manifest skip works per file, so only the new files were converted. `characters.json`: `constructs: 2`.
- `--download Elektra`: 3 files downloaded for Elektra, 3 for Hand Ninjas. Both converted 4 of 4.
- `--download Sandman`: 3 files each for Sandman, Sand Constructs - Twisty and Sand Construct - Fisty. All converted 4 of 4.
- `--list` shows all of them as migrated.
- `pnpm format`, `pnpm lint` (only old warnings), 598 tests pass, `pnpm --filter web build` ok.

Differences from the plan:
- `characters.json` lists `grunts` by the matched rows, not by what is migrated. The host is migrated before its grunts, so a failed grunt would still be listed.
- The `daddy` field of the grunt rows is not used: Hand Ninjas says "Shadowlands Daredevil", the host row is "Shadowland Daredevil". The host `grunts` names match.
- `apps/web/tools/` (AssetRipper) was linked from the main dir for the runs and the link was removed before the commit.

Phase 2 done.

Built:
- `characters.js` gives `constructs` (0 when missing). `newCharacter.js` and `rooms/preload.js` copy it to the character entry.
- `models.js`: construct models with the id `<id>:c<n>`, small base, no card, flag `construct`. New `constructModelId` and `isConstructId`. `modelCharacterId` strips both suffixes. `characterOnBoard` skips constructs.
- `trays.js`: `trayConstructPosition`, a row past the Give sources, from the owner's left, past the spare model when there is one. Scene uses it for spawn and for Remove.
- Token drop: `characterAt` in Scene skips construct models. A token dropped on a construct is a drop on what is under it (table or mat), not on the host.
- Also: no card hover, no spectator badge, and no F flip on a construct.
- Delete of the host removes the poses and the selection of all its models, constructs too. P2P and stored poses need no change: they are keyed by model id, like `:2`.
- Feature: new section "Constructs" in `character-trays.md`, and the Not built yet and Out of scope lists.
- Tests: construct ids, on-mat check, construct places against the rack.

Differences from the plan:
- Phoenix has no construct files yet, so only Magneto shows constructs now.

Phase 3 done.

Built:
- `characters.js`: each host row has `grunts`, the rows of its grunts. Their stats come from the Jarvis grunt row of the same name (the two Sand Constructs match "Sand Construct"). The grunt rows are not in `CHARACTERS`, so the Library does not list them. `characterGiveSources` of a host also lists the tokens of its grunts. `staminaInjured` is 0 for a row with no `backSide`.
- `newCharacter.js`: `host` field, and `newCharacters(ch, team)` gives the host and one character per grunt. The Library, the roster popup and the squad reveal use it. The setup stores the grunt ids with the host, so a restart removes them.
- `trays.js`: a grunt has the tray position of its host and no place in the row. `trayGruntSlot` gives the offset of a grunt card. The plate, the Give sources, the spare model and the constructs take a `grunts` count and move past the grunt block. Sandman's plate is wider toward the owner's right, and `layoutTrays` gives each tray the room of its plate.
- `CharacterTray.jsx`, `Scene.jsx`: the grunt card, its "On" row and its controls are drawn by a second `CharacterTray` at the slot. The grunt model spawns on its card. Held tokens of a grunt lie on its card.
- `TrayControls.jsx`, `TrayPopup.jsx`: no Power, no Flip and no "Show other side" for a grunt.
- `useCharacterActions.js`: Delete on a host removes the host, its grunts and all their models and poses (`removalOf` in `models.js`). Delete on a grunt shows a HUD message. Flip and Power ignore a grunt.
- `cleanup.js`: a Dazed grunt keeps its side and Damage and loses Dazed and special conditions. The rules text does not say more, so this is the simplest choice.
- `rosters/cards.js`: the grunt cards of a host are in `variants`. `rooms/preload.js` loads the grunt models. P2P needed no change: the characters sync as whole objects.
- Feature docs: new section "Grunts" in `character-trays.md`, `roster.md`, `round-phases.md`.
- Tests: tray layout with grunt cards, Sandman width, row centering, new characters with grunts, delete with the host, Cleanup of a grunt.

- Grunt card aspect: the grunt image is portrait (808x1404). It is drawn 2.75" x 4.78" on the table (the width of a crisis card), with its own sizing in the tray popup and the roster popup variants. `trays.js` has grunt functions for the card, the On row, the controls, the model place and held tokens.

Open:
- A host with grunts reaches z 36.1" (plate) and 37.1" (Give sources) from the table center, after the grunt card aspect fix. The tool rack starts at 34.2", so it can overlap the grunt block of a tray near x = 0. The table or the rack is not changed yet.
- A click on a Give source gives the token to the host, also a token that only a grunt has. Players drag it onto the grunt for the grunt.
