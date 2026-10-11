# Plan: Squad breakdown

Requested by the user on 2026-10-11. Plan 3 of `docs/plans/playtest-1.md`. Status: plan written, parts 1 to 4 not started.

The user asked for the plan and the coder work in one go, on the branch `squad-breakdown`, in the worktree `../mcp_assist_3d-squad-breakdown`. The user checks the branch after all parts are done.

One coder step and one commit for each part. Each part writes its **Result** below when it is done.

The feature: `docs/features/squad-breakdown.md`. It is the authority for the behavior. This plan has the facts, the order of the work and the results.

## Request

From the answers in `docs/plans/playtest-1.md`, "Plan 3: Squad breakdown":

- A **Breakdown** tab in the roster popup during the setup, similar to the Breakdown tab of Jarvis.
- One combination: the total threat is at most the threat value, no other character of the roster still fits, and no two characters share an alter ego.
- The threat values: only the values that are still possible in this game. At the start, the threat values of the crisis cards of both rosters. The list gets shorter as the cards are drawn and chosen. After the player without Priority chooses the Maximum Threat, only that value is left.
- The combinations use the same character portraits as the rest of the app.
- Filters, as in Jarvis: must have, must not have, affiliation, at least 2 affiliations, leader, min and max squad size. Jarvis "Pinned" and "Played" are left out.
- In the squad step, a click on a combination fills your squad choice. Team Tactic cards are still chosen by hand.
- A player can also open the breakdown of the other roster, because rosters are public.

## Facts

### Jarvis

From the Jarvis JS bundle `application.f8084247041bc5051259.js`, read on 2026-10-11. The names are minified, so they change with each Jarvis build.

- `iO` builds the sets: a recursive walk over the roster's characters in roster order. A set is kept when it has at most one character with the tag `peerless`, no two characters with the same `alterEgo` (slugs that start with `sentinel-mk4` or `prime-sentinel` are left out of this check), and no `sentinel-mk4-2` / `prime-sentinel-2` without `sentinel-mk4` / `prime-sentinel-1` (`rO`, `aO`).
- `hO` (the tab) groups the sets by their exact total threat (`X`: Threat Levels plus attached gems), shows chips 14 to 20 (11 to 34 when open) with the count of each, and lists the sets of the selected value. With more than 14 characters it shows only a message.
- `NR` finds the affiliations of a set: `floor(n / 2) + 1` characters, with the special cases listed in the feature.
- `nO` finds a leader: `isLeader`, or `isLeaderWithTeamTactics` equal to the `cardFamily` of a Team Tactic card of the roster.
- `combinationCompliesToFilters` (in the hook of `hO`) applies the filters: must have (all), must not have (none), affiliation (`*` = any, or a slug), dual affiliation (2 or more), leader enforced, min and max size.

### Rules

From the Jarvis rules reference:

- p11: "each player chooses characters from their Roster that have a combined Threat Value equal to or lower than the Maximum Threat Value". "Characters in a player's Squad may not share the same Alter Ego."
- p21, Peerless: "This character cannot be part of the same Squad as another character with the Peerless innate superpower." 17 characters have the Jarvis tag `peerless`, for example Hulk, Thanos, Magneto, Phoenix.

### Data

- `src/characters/jarvis-characters.json`, per character: `alterEgo` (null for 6 grunts and Multiple Man), `tags`, `affiliations[]` with `slug`, `isLeader`, `isLeaderWithTeamTactics`.
- `isLeaderWithTeamTactics` is null or a Team Tactic slug. All 10 values are slugs in `src/tactics/jarvis-tactics-cards.json`, for example `the-bar-with-no-doors` (`00670204`). `first-of-the-black-order` has two rows with the code `00810202`.
- `CHARACTERS` (`src/characters/characters.js`) has `threat` and `affiliations` (slugs), but no alter ego, Peerless or leader.
- Sentinel MK4: Jarvis has one row (`00510101`). The app adds a row for `00510102` with the same name and stats (`extraRows`). Prime Sentinel 1 and 2 (`20230101`, `20230102`) are two Jarvis rows, both named "Prime Sentinel", alter ego "Prime Sentinel". Sentinel Prime MK4 (`01600101`) has another alter ego.
- `squadThreat(parsed, places)` in `src/rosters/cards.js` adds the attached gems. `squadAffiliationKeys(parsed, places)` gives the affiliation token keys (more than half), the same rule as the Affiliation step.
- The current crisis cards have the threat values 15 to 20.
- Portraits: `characterPortrait(key)` in `src/characters/files.js`, `portrait.webp`, 300 × 300, round. 71 characters have one: the migrated characters, which are the ones with a model. Only the Library uses them (`portraitUrl` in `Library.jsx`, 28 px, a grey square for the rest).

### Roster popup and setup

- `RosterPopup.jsx` gets `team, code, tab, index` and the tab handlers. `ROSTER_TABS` and `rosterTabs(parsed)` (`rosters/cards.js`) list the card tabs. A tab without cards is disabled.
- `App.jsx` keeps `openRoster: { team, tab, index }`. The left and right arrows call `handleRosterCardStep`, which counts the cards of `rosterTabs(…)[tab]`. A Breakdown tab has no cards there.
- `RoomRosterPopup.jsx` uses `RosterPopup` in the lobby. There is no setup there.
- CSS: `.roster-popup *` has `pointer-events: none`. Only buttons, links and cards take them. A scrolling list, a select and check boxes need them too.
- `handleRosterClick` in `App.jsx` has the rules for a squad change: own side in a multiplayer room (`hiddenSquads`, `mySide`), step `squads`, not Ready, not placed, a character needs a model. A multiplayer room keeps the own squad in `localStorage` (`storedSquad`, `saveSquad`). Other rooms keep it in `setup.squads`.
- `toggleSquadCard` in `setup/setup.js` changes one place of a squad.
- The tests: `pnpm --filter web test` runs `node --test "src/**/*.test.js"`. 333 tests passed on this branch at the start.

### Other plans

- Plan 2 (`setup-round-2.md`, not written yet) renames the side keys `blue` / `red` to `host` / `guest`. This branch keeps `blue` / `red`. The merge of the two branches has to rename the new uses too.
- Plan 2 also adds "Add to squad" / "Remove from squad" on a card of the popup. This plan does not.

## Decisions

The lasting decisions are in the feature. Decisions for this plan only:

1. **Peerless and Sentinel copies.** The user named the threat, "no other character still fits" and the alter ego. The plan also uses Peerless (a rulebook rule, p21) and the copy rule of Jarvis. The user can say no after the check. Then rule 3 and rule 5 of the feature go away.
2. **Order.** Pure logic with tests first, then the tab, then the filters, then the click. Each part leaves the app working.
3. **No browser checks by coder.** The checks are build, format, lint and the web tests. The user checks the app in the browser after part 4.

## Part 1: Combinations and threat values (no UI)

Work:
1. `src/characters/characters.js`, `rosterEntry`: add `alterEgo` (Jarvis `alterEgo`, or null), `peerless` (tag `peerless`) and `leads`: `[{ affiliation, tactic }]`, one entry for each Jarvis affiliation with `isLeader` (tactic null) or `isLeaderWithTeamTactics` (tactic = that slug). The comment of each field says what it is for, as for the other fields.
2. New `src/rosters/breakdown.js`, no imports:
   - `squadCombinations(units, maxThreat)`. `units`: `[{ place, name, threat, alterEgo, peerless }]` in roster order. Returns `[{ places, threat }]`, places sorted, by the 5 rules in the feature, "Combinations". Sorted by threat (high first), then by places. A recursive walk with a cut when the threat is too high is enough: a roster has at most 14 characters here.
   - `SHARED_ALTER_EGOS = ['Sentinel MK4', 'Prime Sentinel']`: the alter egos that rule 2 skips.
   - Copies (rule 5): units with the same `name`. The first one in roster order is the earlier copy.
   - `matchesFilters(combination, filters)`. `combination`: `{ places, threat, affiliations: [{ key, leader }] }`. `filters`: `{ must: [place], mustNot: [place], affiliation: null | '*' | key, dual, leader, minSize: number | null, maxSize: number | null }`. `mustNot` is not checked here, because the caller removes those units first. See the feature, "Filters".
   - `NO_FILTERS` and `MAX_BREAKDOWN_CHARACTERS = 14`.
3. `src/rosters/cards.js`:
   - `breakdownUnits(parsed)`: the units of the roster's characters. `threat` is the Threat Level plus the attached gems, the same as `squadThreat`.
   - `rosterBreakdown(parsed, threat, filters)`: the combinations without the `mustNot` units, each with `affiliations: [{ key, leader }]` (`squadAffiliationKeys`, and the `leads` of its characters with the Team Tactic slugs of the roster), filtered with `matchesFilters`. Returns null when the roster has more than 14 characters.
   - `CRISIS_THREATS`: the threat values of all current crisis cards, sorted, each once.
   - The roster's Team Tactic slugs: from the Jarvis tactic rows by code. Keep every slug of a code, so that both rows of `00810202` count.
4. `src/setup/setup.js`: `possibleThreats(setup, parsed, threatOf)`. `parsed`: `{ blue, red }` → the parsed roster or null. `threatOf(code)`: the threat of a crisis card. Returns the values of the feature table "Threat values", sorted, each once. An empty list when no card is known. No import, the same as the rest of the module.
5. Tests:
   - New `src/rosters/breakdown.test.js`: threat limit, rule 4 (a set that still has room for a character is left out; a squad under the value shows when nothing fits), alter ego, the Sentinel exception, a null alter ego, Peerless, copies, the sort, every filter.
   - `src/setup/setup.test.js`: `possibleThreats` in each step, with a missing roster, and after the Maximum Threat.
6. Docs: no behavior change yet. If a name in the feature table "Code" changes, change it there.

Checks: `pnpm format`, `pnpm lint`, `pnpm --filter web build`, `pnpm --filter web test`.

Commit: `squad breakdown part 1: combinations and threat values`.

**Result:** not started.

## Part 2: Breakdown tab, read only

Work:
1. New `src/components/CharacterPortrait.jsx`: the portrait image of a character, or a grey circle when it has none. The Library uses it instead of `portraitUrl`, with the same look as now (28 px, rounded square). The Breakdown tab uses it round.
2. New `src/components/BreakdownTab.jsx`: the threat chips with counts, the line with the number of squads, the list of rows. See the feature, "Breakdown tab". Above 14 characters, the message from the feature.
3. `RosterPopup.jsx`: an optional prop `breakdown` (null or missing in the lobby). With it, the tab **Breakdown** after **Crisis cards**. It shows `BreakdownTab` instead of the carousel. Disabled when the roster has no characters.
4. `App.jsx`:
   - Pass `breakdown` while the squad of `openRoster.team` is not placed (`placedSides(setup)`).
   - The threat values: `possibleThreats(setup, parsedRosters, threatOf)`, or `CRISIS_THREATS` when it is empty.
   - The selected value per roster: state `{ blue, red } → { code, threat, filters } | null`, not saved. See the feature, "Threat values" and "State". This part uses only `code` and `threat`. Part 3 adds the filters.
   - `handleRosterCardStep` does nothing in the Breakdown tab.
5. `index.css`: the tab area about as wide as the carousel, at most the screen width minus 16 px on each side. The list scrolls inside. The area takes pointer events, so the list scrolls and a click in it does not close the popup.
6. Docs: `docs/features/squad-breakdown.md`, status "partly built". "Not built yet" lists the filters and the click.

Checks: `pnpm format`, `pnpm lint`, `pnpm --filter web build`, `pnpm --filter web test`.

Commit: `squad breakdown part 2: breakdown tab`.

**Result:** not started.

## Part 3: Filters

Work:
1. `BreakdownTab.jsx`: **Filters** (with the count of filters that are on) opens the filter block. The block has the rows of the feature table "Filters" and **Clear filters**.
2. The affiliation list: **No filter**, **Any affiliation**, then each affiliation that a combination of the roster has at any of the shown threat values, sorted by name (`affiliationName`).
3. The counts on the threat chips use the filters.
4. `App.jsx`: the filters go into the per-roster state of part 2. A new roster code starts with `NO_FILTERS`.
5. `index.css`: the filter block, the small character chips, the selected state.
6. Docs: the feature, "Not built yet" lists only the click.

Checks: `pnpm format`, `pnpm lint`, `pnpm --filter web build`, `pnpm --filter web test`.

Commit: `squad breakdown part 3: filters`.

**Result:** not started.

## Part 4: Choose a squad from the breakdown

Work:
1. `src/setup/setup.js`: `setSquadCharacters(setup, team, places)`: the squad of `team` gets these character places. Its Team Tactic places stay. A test in `setup.test.js`.
2. `App.jsx`: `handleBreakdownChoose(team, places)`, with the same checks as `handleRosterClick`: own side in a multiplayer room, step `squads`, not Ready, not placed. Characters without a model are left out, and the HUD message names them. It writes the squad the same way as `handleRosterClick` (document, or `storedSquad` and `saveSquad` in a multiplayer room). Then **Select squad** turns on for that team, and the popup closes.
3. Pass to the tab: whether a click works now, the reason when it does not, and the current squad characters of that team (the own squad in a multiplayer room, as the roster cards show it).
4. `BreakdownTab.jsx`: rows take clicks only when a click works (pointer cursor, hover). The row of the current squad has the yellow squad frame. The line over the list says what the player can do. See the feature, "Choose a squad".
5. Docs: `docs/features/squad-breakdown.md`, status "built", "Not built yet" removed. `docs/features/setup-game.md`, "Code": add `setSquadCharacters`.

Checks: `pnpm format`, `pnpm lint`, `pnpm --filter web build`, `pnpm --filter web test`.

Commit: `squad breakdown part 4: choose a squad from the breakdown`.

**Result:** not started.

## User checks

After part 4, in the browser. Write the results here.

Sandbox, two rosters loaded:
1. Click a roster card. The popup has a fourth tab, **Breakdown**. The other tabs work as before. The left and right arrows do nothing in the Breakdown tab.
2. Deck step: the threat chips show the values of all crisis cards of both rosters, each with a count. A click on a chip shows its list.
3. Each row: total threat, portraits with names, affiliations, ★ for a leader. No row has two characters with the same alter ego or two Peerless characters. Adding any other character of the roster to a row would break a rule.
4. Choose a deck, then the cards, then the threat. The chips get fewer at each step. After the Maximum Threat, one chip is left.
5. Filters: must have, must not have, affiliation, at least 2 affiliations, leader, min and max size. The list and the chip counts change. **Clear filters** clears all of them. Close and open the popup: the filters stay.
6. Squad step: click a row. The popup closes, the characters of the row have the yellow frame on the table, **Select squad** is on. The Team Tactic cards of the squad did not change. Open the Breakdown tab again: that row has the yellow frame.
7. A row with a character without a model: the click adds the others, and the HUD names the missing one.
8. Click **Ready**: the rows do not take clicks. After both Ready, the squads are on the table and the Breakdown tab is gone.

Multiplayer room, two browsers:
9. Each player opens the Breakdown tab of both rosters. Only the own rows take clicks in the squad step.
10. A click on the own row does not show the squad to the other player.

Lobby:
11. **Roster** on a room tile: the popup has no Breakdown tab.

Rules:
12. Peerless and the Sentinel copy rule (plan decision 1): keep them or remove them.
