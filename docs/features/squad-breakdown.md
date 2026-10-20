# Feature: Squad breakdown

Status: built.

## Goal

During the setup, a player sees which squads their roster can build for the threat values that this game can still have. This is the same as the Breakdown tab of a roster on Jarvis. In the squad step, a click on one of these squads chooses its characters.

## Terms

| Term | Meaning |
|---|---|
| Combination | One squad of characters that the breakdown lists, see [Combinations](#combinations) |
| Threat value | A Maximum Threat value that the mission can use (p9). Each crisis card has one |
| Copy | A character that is in the roster more than once, under the same name. For example the two Sentinel MK4 (`00510101` and `00510102`) or Prime Sentinel 1 and 2 |

## How Jarvis does it

These facts come from the Jarvis JS bundle (`application.<hash>.js`, the Breakdown tab of a roster page), checked on 2026-10-11.

- Jarvis lists every set of the roster's characters. It groups the sets by their exact total threat, from 11 to 20, and to 34 when the list is open. A character's threat is its Threat Level plus the threat of its attached Infinity Gems.
- A set is left out when:
  - it has more than one character with the Jarvis tag `peerless`;
  - two characters share an `alterEgo`. Characters whose slug starts with `sentinel-mk4` or `prime-sentinel` do not count for this check;
  - it has the second Sentinel MK4 or Prime Sentinel, but not the first.
- An affiliation of a set: more than half of its characters have it. Jarvis also has special cases: Legion of the Lost with the card Devil's Reckoning, Thralls of Dracula, Dark Dimension, Onslaught's Grip, and the Rogue Agents (Taskmaster, Winter Soldier). For each affiliation of the set, Jarvis counts one more character when the set has a Rogue Agent without that affiliation. Two Rogue Agents still add only one.
- A leader of an affiliation: a character that has the affiliation with `isLeader`, or with `isLeaderWithTeamTactics` when the roster has that Team Tactic card.
- The options (cog button): must have, must not have, an affiliation (any, or one), at least 2 affiliations, a leader, the min and the max squad size. **Pinned** and **Played** use the games that Jarvis tracks.
- Each set shows the character portraits and its affiliations. A menu has pin, notes, share and the Tactica previewer.
- With more than 14 characters in the roster, Jarvis shows no breakdown, because the list is too slow.

## Combinations

A combination is a set of roster characters with these rules:

1. The total threat is exactly the threat value, the same as on Jarvis. A character's threat is its Threat Level plus its attached Infinity Gems, the same as the squad threat of the setup (`squadThreat`).
2. No two characters share an alter ego (p11). The copies of Sentinel MK4 and of Prime Sentinel do not count for this rule, the same as on Jarvis. A character without an alter ego in Jarvis (Multiple Man) shares it with nobody.
3. At most one character has the Peerless keyword (p21, Jarvis tag `peerless`).
4. A set with a later copy of a character must also have the earlier copy. So each squad shows only once.

- A squad with a lower threat is also legal (p11). The breakdown does not list it under this value. It shows under its own value when the game can still have that value.
- The list is sorted by the roster order of the characters.
- The app finds the combinations of the roster's characters, also of characters without a 3D model. Such a character cannot join the squad (see [Choose a squad](#choose-a-squad)).
- A roster with more than 14 characters gets no breakdown, the same as on Jarvis. The tab says so.

### Affiliations and leaders

- The affiliations of a combination use the rule of the Affiliation step of the setup: more than half of the characters have it (`squadAffiliations`, see `docs/features/setup-game.md`, "Affiliation").
- Rogue Agent (Jarvis tag `rogueAgent`, Taskmaster and Winter Soldier): "One character with Rogue Agent counts as an affiliated character during Squad building." So for each affiliation, the app counts one more character when the combination has a Rogue Agent without that affiliation. Two Rogue Agents add only one. This is the same as on Jarvis and in the Affiliation step.
- The other Jarvis special cases are left out, the same as in the Affiliation step. Players apply them.
- A combination has a leader for an affiliation when one of its characters has that affiliation with `isLeader` in Jarvis, or with `isLeaderWithTeamTactics` and the roster has that Team Tactic card. The value of `isLeaderWithTeamTactics` is the Jarvis slug of the card. The app checks all Team Tactic cards of the roster, not only the chosen ones, the same as Jarvis.

## Threat values

The tab shows only the values that this game can still have. The values come from the crisis cards in the setup:

| Setup step | Possible crisis cards | Values |
|---|---|---|
| Deck | All Secure and Extract cards of both rosters | Their threat values |
| First card | The 2 drawn cards of the first deck, and every card of the other player's deck of the other type | Their threat values |
| Second card | The chosen first card, and the 2 drawn cards of the other deck | Their threat values |
| Maximum Threat | The 2 chosen cards | 1 or 2 values |
| After the Maximum Threat | — | Only the Maximum Threat |

- Each value shows once, sorted from low to high. A value with no combination shows the count 0.
- When the rosters have no crisis cards, the tab shows every threat value of the current crisis cards in the Jarvis data (15 to 20).
- One value is selected. Before the Maximum Threat is chosen, the first value is selected until the player clicks another one. When the selected value leaves the list, the first value is selected. After the Maximum Threat is chosen, it is the only value.

## Breakdown tab

The roster popup (`docs/features/roster.md`, "Roster popup") gets a fourth tab: **Breakdown**.

- The tab shows on the table while the squad of that roster is not on the table. After the squad is placed, the tab is gone. The roster popup of the lobby has no Breakdown tab, because a room has no setup there.
- In a multiplayer room, the tab shows only on the own roster. On the other roster the tab is absent, because the breakdown shows the opponent's options, which the game does not show. A popup left on the tab for the other roster shows the first tab with cards. In the Sandbox and a solo room one person plays both sides, so both rosters have the tab.
- The tab is disabled when the roster has no characters, the same as a tab without cards.
- The arrow keys do nothing in this tab.

Look: the comic look of the roster popup (`docs/features/lobby-redesign.md`, "The look"). A paper panel lies on the rays stage, with a border and a hard shadow. The panel scrolls inside.

Layout, from top to bottom:

```
Squad breakdown                      [15 | 8] [17 | 12] [18 | 14]    threat buttons: value and count
PICK A THREAT LEVEL
┌─ filter box ─────────────────────────────────────────────┐
│ MUST HAVE   (o) Hulk  (o) Thor  (o) Loki  (o) Wasp       │  always shown
│ - - - - - - - - - - - - - - - - - - - - - - - - - - - -  │  only when open
│ MUST NOT HAVE, AFFILIATION, 2 check boxes, MIN / MAX SIZE│
│ [More filters (2) v]  Reset filters                      │  the button says Fewer filters when open
└──────────────────────────────────────────────────────────┘
12 squads                            hint line, or "No squad has threat 17 with these filters."
┌──────────────────────────────────────────────────────────┐
│ 17  (o) (o) (o) (o)                  [AVENGERS *] [CABAL]│  a row: total threat, portraits, affiliations
│     Hulk Thor Loki Wasp                                  │
└──────────────────────────────────────────────────────────┘
…
```

- The panel is about as wide as the carousel of the other tabs, and never wider than the screen. The filter box shows in full. The whole panel scrolls.
- Head: **Squad breakdown** and "Pick a threat level". On the right, one button per threat value: the value big, and a black chip with the number of combinations. The selected one is yellow and turned; the others are white. The screen reader reads "Threat 17, 12 squads". A click on the selected value does nothing.
- Each row shows the total threat (big, red, outlined), the characters in roster order and the affiliations of the combination.
- A character shows as a round portrait with its name under it. The portrait is the same as in the Library (`characters/<key>/portrait.webp`). A character without a portrait (no files in the app) shows a grey circle.
- An affiliation shows as a black tag with its name. A yellow star after the name, read as "leader", says that the combination has a leader for it.
- A line next to the count says what the player can do: choose a squad with a click (see below), or only look.
- When a click chooses, a row is a button, and the row of the current squad is pressed. When it does not, a row is a plain block.
- On a narrow screen the label of a filter row goes above its chips, the rows wrap, and nothing scrolls sideways.

## Filters

The filter box is always shown. Its first row, **Must have**, is always visible. **More filters** opens the rest, and then reads **Fewer filters**. While a filter behind it is on, the button shows how many differ from the start state, for example "More filters (2)". Must have is not counted. At the start, **With a leader** is on and the button shows "More filters" with no count. **Reset filters** shows only while the rest is open, and goes back to the start state.

| Filter | Input | Result |
|---|---|---|
| Must have | A row of the roster's characters (small round portrait and name). A click turns one on or off. On: yellow | Only combinations with all of these characters |
| Must not have | The same row. On: red, the name struck out | These characters are left out before the app finds the combinations. So the list shows squads that fill the threat without them |
| Affiliation | A chip row with the affiliation icons (yellow when on): **Any affiliation**, then each affiliation that a combination of the roster has at one of the shown threat values, by name. One chip at a time; a click on the chosen chip clears the filter | Any affiliation: combinations with at least one. An affiliation: combinations that have it |
| At least 2 affiliations | Check box | Combinations with 2 or more affiliations |
| With a leader | Check box | Only affiliations with a leader count for the two filters above. With no affiliation chosen, a combination needs at least one affiliation with a leader |
| Min size | **Any**, 3, 4, 5, 6, 7 | Combinations with at least that many characters |
| Max size | 3, 4, 5, 6, 7, **Any** | Combinations with at most that many characters |

- A character is in at most one of the two character rows. A click in one row takes it out of the other row.
- A min size above the max size moves the max size up, and the other way round, the same as Jarvis.
- The counts on the threat buttons use the filters too.
- Must have follows the squad on the table. Each time the squad characters of a roster change (a + / ✓ on a roster card, **Add to squad**, a click on a row), Must have becomes exactly the squad's characters, and those characters leave Must not have. The other filters stay. The player can still turn chips on or off afterwards; the next squad change sets Must have again. It also works while the popup is closed. An empty squad empties Must have, but a new roster with no squad keeps the start state. Only the squad this browser may see counts: in a multiplayer room, the other roster's hidden squad gives nothing.
- The selected threat value and the filters of each roster stay while the app is open, also when the popup closes. A new roster for that side starts with the start filters (With a leader on). They are not saved.

## Choose a squad

In the squad step, a click on a combination chooses its characters for the squad.

- The click works on a roster that this browser plays, while its player has not pressed Squad ready and its squad is not on the table. In a multiplayer room, that is only the own roster, the only one with the tab.
- The click replaces the characters of the squad with the characters of the combination. The Team Tactic cards of the squad stay. Players choose them by hand.
- A character without a 3D model cannot join, the same as with a click on its roster card. The other characters join, and the HUD message names the missing ones: "No model for <name> (<code>), so it cannot join the squad".
- After the click, the popup closes. The player sees the squad frames on the table and can change the squad or add Team Tactic cards with the **+** / **✓** buttons on the roster cards.
- The row whose characters are the current squad has the yellow frame of a squad card. In a multiplayer room, only the own squad shows, because the other squad is hidden.
- Before the squad step, and after **Squad ready**, the rows do not take clicks. The line over the list says why.

## State

- The breakdown is computed from the roster and the setup. Nothing of it is in the shared document.
- The hook `useBreakdownChoice` (`src/rosters/useBreakdownChoice.js`) keeps it. `App` calls it once, so every place that shows the Breakdown tab shares one state, and the choice stays when the popup closes. It keeps the selected threat value and the filters of each roster: `{ host, guest } → { code, threat, filters } | null`. `code` is the roster code that the filters belong to. A different code means a new roster, so the defaults apply. An effect syncs Must have with the visible squad, and remembers per team the last squad it synced. Not saved, the same as `squadSelect`.
- `breakdownFor(team)` of the hook gives the props of the Breakdown tab, or null while the tab is not shown for that team. `RosterPopupHost` (`src/rosters/RosterPopupHost.jsx`) gets it as a prop.
- Filters store roster places, not codes, the same as a squad (`docs/features/setup-game.md`, "State").

## Code

| File | Content |
|---|---|
| `src/rosters/breakdown.js` | `squadCombinations(units, maxThreat)` and `matchesFilters(combination, filters)`. No imports, so a Node test can check it |
| `src/rosters/cards.js` | The units of a roster (threat with gems, alter ego, Peerless, copies), the affiliations and leaders of each combination, the threat values of all crisis cards |
| `src/characters/characters.js` | `alterEgo`, `peerless`, `rogue` and `leads` of each character, from Jarvis |
| `src/setup/setup.js` | `possibleThreats(setup, parsed, threatOf)`: the threat values of the current step. `setSquadCharacters(setup, team, places)`: the squad characters of a click |
| `src/setup/useGameSetup.js` | `handleBreakdownChoose`: the checks, the write and the close of the popup, shared with `handleRosterClick` (`writeSquad`) |
| `src/rosters/useBreakdownChoice.js` | The Breakdown state of both rosters and `breakdownFor(team)`, the props of the tab |
| `src/rosters/BreakdownTab.jsx` | The Breakdown tab: threat buttons, filters, the list |
| `src/characters/CharacterPortrait.jsx` | The portrait of a character, shared with the Library |

## Out of scope

- **Pinned** and **Played** of Jarvis. The app has no game history.
- Notes, names and sharing of a squad.
- The Jarvis special cases of affiliations other than Rogue Agent (Legion of the Lost, Thralls of Dracula, Dark Dimension, Onslaught's Grip) and the Horsemen of Servants of the Apocalypse.
- A choice of Team Tactic cards from the breakdown.

## Decisions

1. The tab is in the roster popup on the table, during the setup, for both rosters in the Sandbox and a solo room, and for the own roster in a multiplayer room.
2. A combination follows the 4 rules in [Combinations](#combinations). The total threat is exactly the value, the same as on Jarvis. Peerless (p21) and the Sentinel copies also follow Jarvis.
3. Only the threat values that this game can still have show. With no crisis cards, all values of the Jarvis data show.
4. Affiliations use the same rule as the Affiliation step of the setup, with Rogue Agent. The other Jarvis special cases are left out.
5. Must not have removes characters before the combinations are found. The other filters work on the list.
6. A click in the squad step replaces the characters of the squad. The Team Tactic cards stay. The popup closes.
7. A roster with more than 14 characters gets no breakdown, the same as on Jarvis.
