# Plan: Infinity Gems on the character tray

Requested by the user on 2026-10-11, for the first real game in production (`docs/plans/implement-backend/12-release.md`). The friend's roster has two characters with an Infinity Gem: Doctor Strange with Infinity Gem: Soul (`00230101-00250104`), and Moondragon with Infinity Gem: Mind (`01910102-00250101`).

Design notes that this plan follows: `docs/characters-hud.md` ("Out of scope": cards attached to a character), `docs/feature-setup-game.md` ("Not built yet": Infinity Gem cards next to the character), `docs/feature-roster.md` ("MCT code", "On the table").

## Goal

A character that has an Infinity Gem in the roster gets the gem card on its tray, when the squad goes on the table. Both players see the gem, and can open the gem card to read it.

Today:
- The roster parser keeps the gems of each character (`gems` in `rosters/mct.js`). The roster card on the table shows a text line "+ Soul Gem". The roster popup shows the same line.
- When the squad goes on the table (`revealSquad` in `App.jsx`), the character entry has no gems. So the tray shows nothing.
- The app has no gem card images. `migrate-tactics.mjs` takes only the rows with `type = tTac`. The gems are rows with `type = tInf`.

## How TTS does it

Found on 2026-10-11 in the mod scripts ("Blue Roster Tray", "Blue Tray Spawner"):
- The roster tray spawns each gem card next to its character card (`spawnGem`, scale 0.5).
- A player drops the gem card on the character tray. The tray takes it only when the character can have that gem (`cGem` of the character row). Then it attaches the card at a fixed place on the tray (`gem1Position = {-1.82, 0.2, 1.5}`), with a **Remove Card** button. Thanos and Adam Warlock can have a second gem (`gem2Position`).
- The tray counts the gems for the power gain of the Power Phase (`powerGain + gem`, the Power gem counts twice). The app does not count it: players apply the rules (`docs/characters-hud.md`, "Players apply the rules").
- The gem cards are 720 × 1039, the same size as Team Tactic cards. The TTS cache has the Soul and Mind cards (`tts/infinity-gems/gems/INFINITY_GEM_<NAME>_{face,back}.png`).

## Scope

In the plan:
- Gem card images from the TTS cache (decision 1).
- The attached cards of a character in the document (decision 2).
- The gem on the tray and in the tray popup (decisions 3 and 4).
- Docs.

Left for later:
- Horsemen cards (Apocalypse) and Reserve members. Decision 2 keeps room for them.
- Attach or remove a gem by hand. Today the gems come only from the roster.
- A gem for a character that a player adds from the Library. It has no roster entry, so it has no gem.
- The other gem cards. They migrate when TTS has them in its cache.

## Rules for every phase

- Read `CLAUDE.md`, this plan, and the design sections named above.
- Do not open the app in a browser. Do not start the dev server. The user checks the app.
- Do not commit and do not push. The main model commits each finished phase.
- Temporary files go in the session's scratchpad directory.
- Keep tool output small.
- Code: plain JavaScript in `apps/web`. Plain, short comments that say why. Match the style of the code around you.
- Web tests run with `node --test`. A module under test must not import modules that read `import.meta.env` or load three.js scenes.
- After a code change: `pnpm format` and `pnpm lint`.
- Docs: short sentences, common words, one fact per sentence. Never the word "comprehensive".
- Production data is real from step 12 on. A new field must work with old documents that do not have it.
- If a check fails and the fix is not in this plan, stop and report.

## Names

| Thing | Value |
|---|---|
| `attached` | New field of a character entry in the document: a list of MCT codes of the cards attached to the character. Infinity Gems now. Missing in old documents, which means none |
| Gem card files | `src/assets/tactics/<key>-face.webp`, `<key>-back.webp`, the same folder and names as Team Tactic cards. `<key>` is the slug of the mod name, for example `infinity-gem-soul` |
| Gem chip | The gem on the tray: a small button in the tray's controls strip, with the gem name, for example "Soul Gem" |

## Decisions that fill gaps in the design

1. **Gem images with the tactic cards.** `migrate-tactics.mjs` also takes the released rows with `type = tInf`. They go to `src/assets/tactics/` and `src/tactics/cards.json`, with `id` and `name`, the same as a Team Tactic card. Reasons:
   - The gems are Team Tactic codes in Jarvis (`isInfinityGem`), and the roster parser already finds them there.
   - The card size and the file layout are the same.
   - Where the app lists Team Tactic cards (the Library, the tactic tray, the squad choice), it must leave out the gems. Phase 1 checks each place that reads `src/tactics/cards.json`.
2. **`attached` on the character.** When the squad goes on the table, each new character gets `attached`: the gem codes of its roster entry. A character with no gem gets no field. The name is general, so Horsemen cards and Reserve members can use the same field later. No new `SCHEMA`: an old document has no `attached`, which is a valid state.
3. **The gem chip on the tray.** A tray has no free space at its sides: the trays are 0.3" apart. TTS lays the gem card over a part of the tray. In the app it would cover the stat card. So:
   - The controls strip of the tray (`TrayControls.jsx`) gets one chip per attached card, with its name: "Soul Gem", "Mind Gem". The name comes from the card name ("Infinity Gem: Soul" → "Soul Gem"), the same text as on the roster card.
   - A click on the chip opens the gem card face in the card popup (`CardPopup.jsx`), the same popup as a crisis card.
   - A gem without an image in the app shows the chip too. A click shows the HUD message "No card image for <name> (<code>)", the same as a roster plate.
   - Both players see the chip. The other player's tray is also clickable, because reading a card changes nothing.
4. **The tray popup.** `TrayPopup.jsx` shows the attached cards next to the stat card, at a readable size, face up. A click on one opens the card popup. So a player who opens the tray reads the gem with the character.

## Phase 1: Gem images and data

Read: decisions 1 and 2. `scripts/migrate-tactics.mjs`, `scripts/README.md` ("TTS tactic cards"), `src/tactics/cards.json`, `src/tactics/cards.js`, `src/tactics/files.js`, `src/rosters/cards.js`, `src/rosters/mct.js`, `App.jsx` (`newCharacter`, `revealSquad`), every other reader of `src/tactics/cards.json`.

Work:
1. `migrate-tactics.mjs`: also the released `tInf` rows (decision 1). `--list` shows them. Run it: the Soul and Mind cards migrate. Report other new cards, if any.
2. Each reader of `src/tactics/cards.json` that lists Team Tactic cards leaves out the gems (decision 1). Use the Jarvis flag `isInfinityGem` (`src/tactics/jarvis-tactics-cards.json`), not the name.
3. `App.jsx`: `revealSquad` sets `attached` on each new character from `parsed.characters[place].gems` (decision 2). `newCharacter` takes it as an option. A test for the rule, if it lives in a plain module.
4. `scripts/README.md`: "TTS tactic cards": the gem rows.

Checks:
- `pnpm --filter web test`, `pnpm --filter web build` pass.
- `pnpm format`, `pnpm lint`: no new errors.

### Result

Done on 2026-10-11. Not committed.

- `migrate-tactics.mjs` (`loadTacticCards` in `scripts/lib/tts.mjs`) also takes the released rows with `type = tInf` (the constant is "Infinity Gem"). `--list` shows them. 7 gem rows are released. Only Soul and Mind have files in the TTS cache, and only they migrated (`infinity-gem-soul`, `infinity-gem-mind`). No other new card. Total: 75 of 400 cards.
- Readers of `src/tactics/cards.json`: `src/tactics/cards.js` (`TACTICS`, used by the Library) and `src/rosters/cards.js`. The tactic tray, the squad choice and the roster tabs read the roster's `parsed.tactics`, not `cards.json`.
  - `TACTICS` leaves out the codes with `isInfinityGem` in Jarvis.
  - `rosters/cards.js`: each tactic entry has `gem` (`isInfinityGem`). `cardKind` gives `'gem'` for a gem, so the parser keeps a gem behind a character only, and a gem alone in the roster is an unknown code, not a Team Tactic card. The entry's own `kind` stays `'tactic'`.
  - `mct.js` takes `'gem'` for the codes behind a character. `src/rosters/mct.test.js` is new.
- `App.jsx`: `newCharacter(ch, teamColor, { attached })` sets `attached` only when the list is not empty. `revealSquad` passes `parsed.characters[place].gems`. `newCharacter` lives in `App.jsx`, so it has no test.
- `scripts/README.md` has the gem rows.
- Checks: `pnpm --filter web test` (284 pass), `pnpm --filter web build`, `pnpm format`. `pnpm lint` has 41 warnings, the same as before.

For Phase 2:
- Name of a gem: `rosterCard(code).name` (`rosters/cards.js`), for example "Infinity Gem: Soul". `RosterCards.jsx` already shows the line "+ Soul Gem" from it. Take the chip text from the same place.
- Image URL: `rosterCard(code).image` is the face file name, `.back` the back (`tacticCardFace(key)` / `tacticCardBack(key)` from `tactics/files.js`). Both are null when the app has no image (gems other than Soul and Mind). `.key` is the key in `tactics/cards.json`.
- `attached`: the field of a character entry, a list of MCT codes. Set in `newCharacter` (`App.jsx`) from `revealSquad`. Missing when there is no gem and in old documents.
- A gem entry has `gem: true` in `rosterCard(code)`.
- Comment in `RosterCards.jsx` above `GemLine` says "The app has no gem images". It is out of date. Fix it in Phase 2.

## Phase 2: Gem on the tray, docs

Read: decisions 3 and 4. The **Result** of Phase 1. `components/TrayControls.jsx`, `components/CharacterTray.jsx`, `components/TrayPopup.jsx`, `components/CardPopup.jsx`, `App.jsx` (`openCard`, the HUD message), `components/RosterCards.jsx` (the gem line text), `index.css` (the tray styles).

Work:
1. `TrayControls.jsx`: the gem chips (decision 3). The 3D tray and the tray popup use the same component, so both get them.
2. `TrayPopup.jsx`: the attached cards next to the stat card (decision 4).
3. `index.css`: the styles.
4. Docs: `docs/characters-hud.md` ("Out of scope": gems are built, Horsemen and Reserve are not; a short "Attached cards" section). `docs/feature-setup-game.md` ("Not built yet": the gem cards are built). `docs/feature-roster.md` ("On the table": the gem line stays on the roster card; the tray shows the gem after the setup).

Checks:
- `pnpm --filter web test`, `pnpm --filter web build` pass.
- `pnpm format`, `pnpm lint`: no new errors.

### Result

Done on 2026-10-11. Not committed.

- `rosters/cards.js`: new `attachedCards(character)` gives `{ code, name, label, image }` per code in `attached`. `label` is the chip text ("Infinity Gem: Soul" gives "Soul Gem"). Old characters without `attached` give an empty list.
- `TrayControls.jsx`: one `.chip` per attached card, in its own row above Flip and Remove. The click calls `stopPropagation()` and `onAttachedOpen(code)`. The 3D tray and the tray popup share the component. No owner check, so both players' trays work.
- `CharacterTray.jsx`, `Scene.jsx`: pass `onAttachedOpen` down.
- `App.jsx`: `handleAttachedOpen(code)` opens `{ src, alt }` in `CardPopup`. No image: HUD message "No card image for <name> (<code>)". It also closes the tray popup, so one popup is open (the Escape rule stays).
- `TrayPopup.jsx`: the gem cards face up under the stat card, as buttons. A card without an image has no picture there, only its chip. `index.css`: width `min(40vw, 260px, 36vh)`, so a small screen still scrolls inside the existing `max-height: 96vh`.
- `RosterCards.jsx`: `GemLine` comment fixed.
- Docs: `characters-hud.md` (new "Attached cards", Out of scope, Decisions 5), `feature-setup-game.md`, `feature-roster.md`.
- Found: the roster card line and the roster popup show the full name, "+ Infinity Gem: Soul", not "+ Soul Gem". The plan said they match. I left them as they are. Docs now say the true text. Only the chip says "Soul Gem". Decide if the roster should use the short text too.
- Not checked in a browser (rule). The `stopPropagation` and the drei `<Html transform>` use follow the Flip button, which works the same way.
- Checks: `pnpm --filter web test` (284 pass), `pnpm --filter web build`, `pnpm format`. `pnpm lint`: 41 warnings, same as before, no errors.

## Phase 3: Small attached cards in the tray popup

The user asked for this on 2026-10-11, after the checks. Checks 1 to 7 passed. In the tray popup, the gem card under the stat card is large. It pushes the controls down, so they are hard to reach.

The new rule, for every attached card (gems now; Horsemen or other cards later; Adam Warlock and Thanos can have two):
- The tray popup shows the attached cards small: thumbnails in a column at the side of the stat card, about 90 px wide. So the popup has the same height as for a character without attached cards, and the controls stay where they are.
- A click on a thumbnail shows that card large, over the stat card, centered on it. The large card is about as high as the popup allows (for example `min(70vh, 520px)`), so its text can be read.
- A click on the large card, or on its thumbnail again, makes it small again. A click on another thumbnail shows that card instead. Only one card is large at a time.
- The thumbnail of the large card is marked (an outline), so the player sees which one is open.
- In the popup, the controls show no gem chips, because the thumbnails do the same job. The 3D tray keeps its chips, and a chip there opens the card popup, as before.
- Escape closes the popup, as before. A Flip or **Show other side** keeps the large card open.

Work:
1. `TrayPopup.jsx`: the thumbnails, the large card, the open state (the code of the large card, or null). It goes back to null when the popup closes.
2. `TrayControls.jsx`: a prop that hides the chips; the popup sets it.
3. `index.css`: the thumbnail column, the large card over the stat card. Check a small screen: the stat card width already follows the viewport height (`.tray-popup-card`). The thumbnail column must not make the popup wider than the screen. On a narrow screen, the thumbnails can go in a row under the stat card, small.
4. Docs: `docs/characters-hud.md` ("Attached cards", "Tray popup").

Checks:
- `pnpm --filter web test`, `pnpm --filter web build` pass.
- `pnpm format`, `pnpm lint`: no new errors.

User, after this phase: checks 8 to 10.

### Result

## User

After Phase 2, in a single player room, with the friend's roster as Blue:

```
00230101-00250104,00300102,01290101,00370101,01580102,01910102-00250101,01860102,01680101,00490101,01690103,00570202,00010215,00690204,00230201,00050203,00470203,00490201,01580202,01070202,01430207,00010301,20230302,20230309,20130310,00600301,20230307,20130305,20230306,20230304,00010304
```

1. The roster loads with no warning. All 10 characters and 10 Team Tactic cards have images.
2. Choose a squad with Doctor Strange and Moondragon, and Ready. Doctor Strange's tray shows "Soul Gem", Moondragon's tray shows "Mind Gem". The other trays show no chip.
3. A click on "Soul Gem" opens the Soul gem card. Escape closes it.
4. Open Doctor Strange's tray popup: the Soul gem card shows next to the stat card.
5. The Library and the squad choice list no gem as a Team Tactic card.
6. A multiplayer room (browser pair): the other player sees the gem chips on these trays and can open the cards.
7. A room made before this change still opens. Its trays show no chips.

After Phase 3:
8. Doctor Strange's tray popup: the Soul gem is a small card at the side of the stat card. The controls are as easy to reach as on a tray without a gem.
9. A click on the small Soul gem shows it large over the stat card. A click on the large card makes it small again. The same with a click on the small card.
10. A character with two attached cards: load the Red roster `01910101-00250104-00250101` (Adam Warlock with the Soul and Mind gems, the two gem cards that the app has), choose him and Ready. A click on the second thumbnail shows the second card instead of the first.

### User check results

2026-10-11: the user checked 1 to 7 (and the 3 checks of `docs/plan-jarvis-immunities.md`): "all is good". The gem card in the tray popup is too large, and the controls are hard to reach. Phase 3 changes it.

## Risks and open questions

1. **Gem name.** The chip text "Soul Gem" comes from the card name. The bonded soul gem of Adam Warlock (`01910104`, "Infinity Gem: Bonded Soul") gives "Bonded Soul Gem". Check the text if that card comes up.
2. **Two gems.** Thanos and Adam Warlock can have two gems. The strip has room for two chips. More than two would need a second row.
