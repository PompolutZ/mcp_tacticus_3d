# Plan: Immunities from Jarvis

Requested on 2026-10-11, for the first real game in production. The user agreed to this proposal on 2026-10-11 and will revisit the source of the character data later.

## Goal

The app takes the immunities of a character from the local Jarvis data, not from the TTS mod. The TTS mod gives only assets: models, card images, token images.

Today `migrate-characters.mjs` copies `cImmune` of the mod row into `characters.json` as `immune`. `characterImmune(slug)` in `src/characters/characters.js` reads it, and `handleCharacterTokenGive` in `App.jsx` refuses a condition that the character is immune to (rulebook p21). Problems found on 2026-10-11:
- Blue Marvel: the mod has "Incinerate, Stun" as one name. No token matches it, so the script dropped it, and the app has no immunity for him.
- Emma Frost: immune only in Diamond form. The mod row has nothing.
- Apocalypse: Bleed, Incinerate and Stun when Healthy, all special conditions when Injured. The mod row has 3 for both sides.
- The other 67 migrated characters have the same immunities in both sources.

## Jarvis data

`src/characters/jarvis-characters.json`, checked on 2026-10-11:
- The immunities are in the superpower names of the stat card, per side: for example `statCard.frontSide.superPowers[4].name` is "Flight, Immunity [Incinerate, Stun]". `frontSide` is Healthy, `backSide` is Injured.
- A character with a second form that has its own card has `secondStatCard` with its own sides (Emma Frost: "Immunity [Bleed, Incinerate, Poison, Stun]" only there).
- 69 of 248 characters have the text. The values are: Bleed, Incinerate, Poison, Stun, Stagger, Hex, Shock, and "Special Conditions" (all of them).
- The tags (`immuneToStun`, …) are the union of all sides and forms. So they cannot give the immunity of one side.

## Decisions

1. **Per side.** The immunities of a character are the ones of the side that faces up (`side` of the character entry: `healthy` or `injured`).
2. **Two forms.** The app does not know which form is in use: players move the model of the form in use by hand (`docs/characters-hud.md`, "Second forms"). So a give is refused only when every form of the character is immune on that side. Emma Frost is then never refused, and players apply her Diamond form immunity by hand. A refused give that the rules allow is worse than a give that players undo.
3. **Special Conditions.** "Special Conditions" means every special condition. The list is a constant in the new module, with the rulebook page. Use the Jarvis rules reference (see the memory notes on the Jarvis JS bundle) or the conditions in `src/tokens/tokens.json`. Report the list and its source in the Result.
4. **Names to token keys.** A name maps to the token key with the same slug ("Incinerate" → `incinerate`). A name with no token is left out and reported by the test of the module, not guessed.
5. **Give tokens stay from TTS.** `tokens` (the Give sources) stays in `characters.json`, because the special tokens of a character (Kill Count, Devil's Deal, …) exist only in the mod. The user may revisit this.
6. **`immune` leaves `characters.json`.** `migrate-characters.mjs` no longer writes it, and the field is removed from the existing entries.

## Phase 1: Immunities from Jarvis

Read: this plan. `src/characters/characters.js`, `src/characters/jarvis-characters.json` (one row, for example Blue Marvel, Apocalypse, Emma Frost), `App.jsx` (`handleCharacterTokenGive`, and every other caller of `characterImmune`), `components/TrayControls.jsx` if it uses immunities, `scripts/migrate-characters.mjs` (`cImmune`), `scripts/README.md` ("TTS character migration": `tokens`/`immune`), `docs/characters-hud.md` (immunity).

Work:
1. `src/characters/immunity.js`, new plain module: the immunities of a Jarvis row per form and side, from the superpower names (decisions 1 to 4). Tests in `immunity.test.js`: Blue Marvel (both sides), Apocalypse (Healthy 3, Injured all), Emma Frost (none on form 1, four on form 2), a character with none, and a check over all rows that every name maps to a token key.
2. `characterImmune(slug, side)`: decision 2. Update every caller.
3. `migrate-characters.mjs`: no `immune` (decision 6). Remove `immune` from `characters.json`.
4. Docs: `scripts/README.md` (the entry fields), `docs/characters-hud.md` (where immunities come from, decisions 1 and 2).

Checks:
- `pnpm --filter web test`, `pnpm --filter web build` pass.
- `pnpm format`, `pnpm lint`: no new errors.

User, after this phase:
1. Blue Marvel on a tray: a Stun or Incinerate token dropped on him is refused with "Blue Marvel is immune to …". Bleed is taken.
2. Apocalypse Healthy: Bleed refused, Poison taken. Flip him to Injured: Poison refused.
3. Emma Frost: Bleed taken.

### Result
