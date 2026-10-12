# Feature: Sounds

Status: partly built. The Roll shake, token, Activated, ping and notice sounds and the volume are built. The hit of each bump of an own die and of the other player's dice is built. The model sounds are in the files and play when they are built.

## Goal

A short sound for the events that a player can miss: a dice throw, a token put on a character, a ping and the drop notice. A hit for each bump of a die, in both browsers. Later: a sound when a model lands.

## Files

`src/assets/sounds/`. Each is a mono `.mp3`, a few KB. `README.md` there has the sources, authors, licenses and how each file was made. Mp3 is used because Safari decodes it.

- Own recordings of the user (dice, die hit, model on terrain): `shake`, `die`, `modelTerrain`.
- Freesound, CC0: `modelMat` (556387 by zachrau, until the user records the mat again), `ping` (220212 "Ping Bing" by GameAudio).
- Kenney (kenney.nl), CC0: `token`, `activated`, `notice`.

## Which sound plays when

| Group | Files | Plays |
|---|---|---|
| `shake` | `shake-1..16` | **Roll** starts: the shake pattern below. Own throw: **Roll**. The other player's throw: when their dice go to the air. |
| `die` | `die-hit-1..16` | One bump of a die, in both browsers. The volume is the bump strength. |
| `modelMat` | `model-mat-1` | A model lands on the table top. Not built yet. |
| `modelTerrain` | `model-terrain-1..11` | A model lands on terrain. Not built yet. |
| `token` | `chip-lay-1..3` | A token is put on a character, or an objective token is held, by any player |
| `activated` | `chips-stack-1..3` | The Activated token is put on a character, so the other player knows it was activated |
| `ping` | `ping-bing` | A ping starts |
| `notice` | `question_001` | A dropped token waits for a side that this browser plays: once for each drop, only for the player that places. Not for the other player. Tokens that wait when the table opens play nothing. |

- A group has a random file for each play. `token`, `activated`, `ping` and `notice` play at most once in 80 ms for the same group.
- The shake: 4 random files of `shake` at 0, 260, 430 and 540 ms, with volume 1, 0.55, 0.3 and 0.15 of the setting. Every **Roll** starts a new pattern, so fast clicks sound like shaking. Many dice are one pattern.
- Bumps (`die`, `modelMat`, `modelTerrain`): `playSound` takes a volume (0 to 1, times the setting) and a key, the piece that bumps. One piece plays at most one bump in 60 ms, and all bumps together at most 6 in 100 ms. The 80 ms group gap does not apply to bumps and to the shake.
- The bump finder (`src/bumps.js`): it takes the velocity of a piece over time. No bump is a free fall (gravity adds to the velocity) or an unchanged velocity (a support holds the piece). A bump is a velocity far from both: the change is the smaller of the two distances. Under the minimum there is no bump, so a die that rolls, slides or rests is quiet. At the maximum and above the strength is 1, between them it grows in a line. A die: minimum 1 in/s, maximum 20 in/s (measured with `scripts/dice-sim.mjs`: the first bump of a throw is 4 to 24, later bumps 0.5 to 8, a roll or rest under 0.2).
- Own dice: the finder gets the velocity of each die after each physics step, while the die is dynamic and awake. It starts fresh when the die becomes dynamic, wakes, or is thrown or moved by code, so a throw or a jump is never a bump. The hit is `die` with the strength as volume: a hard bump is loud, a soft one quiet.
- The other player's dice: the finder gets the speed from two live poses in a row, the distance over the time between their arrivals (about 33 ms, so a bump is a smaller change over a longer time). The same rules, with a minimum of 1 in/s and a maximum of 12 in/s (measured with the dice-sim throws sampled every 33 ms: a bump has about 0.6 of its 120 Hz change, so the first bump of a throw is still about full). A pose that is not newer than the last one is skipped. A gap of more than 100 ms between two arrivals (lost packets) starts fresh, and so does a speed above 40 in/s (no die moves so fast, about 1.7 times the sim maximum): a jump is never a bump. So the sound matches what this player sees, within about one packet. A small bump can be missed when a packet is lost. The 60 ms gap has its own key for each remote die. No network message is sent for it.
- The token sounds come from the Log (`game-log.md`): each browser plays a sound for each new `token` or `held` entry that is put on (`on`). Entries that exist when the table opens, and entries older than 5 s, play nothing. One source, so both players hear the same sound. If the batch has Activated, that sound plays.
- The ping (`ping.md`): `ping-bing` plays when a ping starts, in the browser that pings and in the other one. A ping that is older than 3 s when it arrives makes no sound.
- A token taken off, damage and Power make no sound.

## Volume

**Sound** slider in the Settings menu (`table-tools.md`), 0 to 100, default 60. 0 is off. Stored in this browser (localStorage, `mcp-assist-3d/settings`).

## First click

A browser blocks sound until the player clicks or presses a key. The app makes its audio context at the first `pointerdown` or `keydown`. A sound before that is skipped.

## Code

`src/sound.js` (`playSound(group, { volume, key })`, `playShake`, `setVolume`), `src/bumps.js` (the bump finders), `src/components/OtherDiceTray.jsx` (the other player's dice), `src/soundGate.js` (the bump limits), `src/components/Ping.jsx` (the ping sound), `src/log/useLogSounds.js`, `soundOf` in `src/log/log.js`.

## Not built

- The model sounds.
- Other files. The player listens and asks for others if needed.
