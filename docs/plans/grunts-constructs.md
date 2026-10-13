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
