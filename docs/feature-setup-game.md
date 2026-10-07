# Feature: Setup game

Status: notes only. Not designed yet. This feature comes after `docs/feature-roster.md`.

## Goal

Players go from two loaded rosters to the start of round 1. Each player chooses a squad from their roster. The app then knows which affiliation each squad uses and shows it on the VP marker.

## Notes from the user

From 2026-10-07:

- Players choose their squad from the loaded roster. The roster cards show until then.
- The toolbar has no VP marker picker. Load roster removes it, and the VP markers show the Unaffiliated token until this feature. The app then finds the token of each VP marker from the squad: from the leaders in it and the characters with the same affiliation.
- Most rosters have one possible affiliation. Many have 2, and a few have 3.

## Rules

From the Jarvis rules reference (rulebook 1.3.0 and 1.4.0):

- A squad uses an affiliation when more than half of its characters have that affiliation. A squad has only one affiliation. (p11)
- A roster does not include an affiliation. Players decide when they build the squad. (p11)
- A Leadership ability is active only when the squad uses the affiliation that the ability requires. (p7)
- When several characters have a Leadership ability that the squad can use, the player chooses one. Players declare their choices at the same time, after both squads are deployed. (p7, p11)
- Players can choose Team Tactic cards that require the affiliation of their squad. (p11)
- Crisis cards: see `docs/feature-crisis.md`, "Out of scope" (p9).

## Facts found

On 2026-10-07:

- Jarvis lists the affiliations of each character (`affiliations[]` in `src/characters/jarvis-characters.json`): `slug`, `name`, `isLeader`, `isLeaderWithTeamTactics`, `timelines`.
- 21 characters can get a Leadership ability through a Team Tactic card (`isLeaderWithTeamTactics`), for example Adam Warlock and Doctor Strange. 11 Team Tactic cards have the Jarvis tag `leadership`. So a leader can come from a Team Tactic card.
- 2 characters have the Jarvis tag `rogueAgent`: Taskmaster and Winter Soldier. Jarvis explains it as "Counts as an affiliated character during squad building".
- Jarvis has 31 affiliations. The app has 34 affiliation tokens (`src/scoreboard/affiliations.json`). The keys are the same except `uncanny-x-men` (Jarvis) and `uncanny-xmen` (app). The app also has `unaffiliated`, `captain-america-shield` and `vibranium-heist`.
