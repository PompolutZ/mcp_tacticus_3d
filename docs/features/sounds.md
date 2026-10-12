# Feature: Sounds

Status: partly built. The Roll shake, token, Activated, ping and notice sounds, the volume, the hit of each bump of a die, the landing sound of a model and the sound of a token put down on the table are built, in both browsers.

## Goal

A short sound for the events that a player can miss: a dice throw, a token put on a character or down on the table, a ping and the drop notice. A hit for each bump of a die, and a sound when a model lands, in both browsers.

## Files

`src/assets/sounds/`. Each is a mono `.mp3`, a few KB. `README.md` there has the sources, authors, licenses and how each file was made. Mp3 is used because Safari decodes it.

- Own recordings of the user (dice, die hit, model on terrain): `shake`, `die`, `modelTerrain`.
- Freesound, CC0: `modelMat` (556387 by zachrau, until the user records the mat again), `ping` (220212 "Ping Bing" by GameAudio).
- Kenney (kenney.nl), CC0: `token`, `tokenPlace`, `activated`, `notice`.

## Which sound plays when

| Group | Files | Plays |
|---|---|---|
| `shake` | `shake-1..16` | **Roll** starts: the shake pattern below. Own throw: **Roll**. The other player's throw: when their dice go to the air. |
| `die` | `die-hit-1..16` | One bump of a die, in both browsers. The volume is the bump strength. |
| `modelMat` | `model-mat-1` | A model lands on the table top. The volume is the bump strength. |
| `modelTerrain` | `model-terrain-1..11` | A model lands on terrain. The volume is the bump strength. |
| `token` | `chip-lay-1..3` | A token is put on a character, or an objective token is held, by any player |
| `tokenPlace` | `chip-lay-1` | A token is put down on the table: an objective token (crisis token), a character token that lies on the table, a token pile. In both browsers. Tactic cards make no sound. |
| `activated` | `chips-stack-1..3` | The Activated token is put on a character, so the other player knows it was activated |
| `ping` | `ping-bing` | A ping starts |
| `notice` | `question_001` | A dropped token waits for a side that this browser plays: once for each drop, only for the player that places. Not for the other player. Tokens that wait when the table opens play nothing. |

- A group has a random file for each play. `token`, `tokenPlace`, `activated`, `ping` and `notice` play at most once in 80 ms for the same group.
- The shake: 4 random files of `shake` at 0, 260, 430 and 540 ms, with volume 1, 0.55, 0.3 and 0.15 of the setting. Every **Roll** starts a new pattern, so fast clicks sound like shaking. Many dice are one pattern.
- Bumps (`die`, `modelMat`, `modelTerrain`): `playSound` takes a volume (0 to 1, times the setting) and a key, the piece that bumps. One piece plays at most one bump in 60 ms, and all bumps together at most 6 in 100 ms. The 80 ms group gap does not apply to bumps and to the shake.
- The bump finder (`src/bumps.js`): it takes the velocity of a piece over time. No bump is a free fall (gravity adds to the velocity) or an unchanged velocity (a support holds the piece). A bump is a velocity far from both: the change is the smaller of the two distances. Under the minimum there is no bump, so a die that rolls, slides or rests is quiet. At the maximum and above the strength is 1, between them it grows in a line. A die: minimum 1 in/s, maximum 20 in/s (measured with `scripts/dice-sim.mjs`: the first bump of a throw is 4 to 24, later bumps 0.5 to 8, a roll or rest under 0.2).
- Own dice: the finder gets the velocity of each die after each physics step, while the die is dynamic and awake. It starts fresh when the die becomes dynamic, wakes, or is thrown or moved by code, so a throw or a jump is never a bump. The hit is `die` with the strength as volume: a hard bump is loud, a soft one quiet.
- The other player's dice: the finder gets the speed from two live poses in a row, the distance over the time between their arrivals (about 33 ms, so a bump is a smaller change over a longer time). The same rules, with a minimum of 1 in/s and a maximum of 12 in/s (measured with the dice-sim throws sampled every 33 ms: a bump has about 0.6 of its 120 Hz change, so the first bump of a throw is still about full). A pose that is not newer than the last one is skipped. A gap of more than 100 ms between two arrivals (lost packets) starts fresh, and so does a speed above 40 in/s (no die moves so fast, about 1.7 times the sim maximum): a jump is never a bump. So the sound matches what this player sees, within about one packet. A small bump can be missed when a packet is lost. The 60 ms gap has its own key for each remote die. No network message is sent for it.
- Own models: the finder gets the vertical velocity of the body after each physics step, while the body is dynamic and awake. A drag, a lift, a Throw or Push (kinematic), a sleeping body and the other player's model start fresh when they move by physics again. So a drop, a lift, a jump and a pose that is set (reload, **Remove**, back to the card) make no sound. A model stops at once when it lands, so a landing is one change of the vertical velocity, as big as the speed of the fall: about 4 in/s from the drag height (0.3"), 8 from 1", 17 from 5". Minimum 1.5 in/s, maximum 6 in/s (measured with a headless Rapier world with the body of the app): a normal release is a clear sound, and a drop from 1" or more is full. Settling and rocking after a landing are under 1 in/s, so they are quiet. A model that falls off an edge of terrain on the table lands again, and that is a second sound.
- Terrain or table top: when a model bumps, a cast of its base shape starts just above the base bottom and goes down. A support top higher than 0.05" is terrain (`modelTerrain`), else the table top (`modelMat`). A terrain piece above the model (an arch) does not count.
- What falls by physics: a drag release (the common case), a model that tips or slides off an edge of terrain, and a model whose terrain piece is removed. R down and the end of a Throw or Push do not fall: the code puts the model at the ground height with zero speed (a model that leaves a roof in a slide is set onto what is under it), so they make no sound.
- The other player's models: while the model is in remote mode, each new live pose goes to the pose finder with its arrival time. A model is heavy, so the finder is tuned for it: only the vertical velocity counts; a bump starts only after a free fall (a lift, a lower, a drag and a slide do not fall by gravity, so they make no sound); the changes of the two samples around a stop are added (a stop falls in two samples), and the sound plays about 90 ms after the first one; a piece at rest sends no pose, so after 60 ms with no pose the last position counts as a velocity of zero (the stop). Minimum 1.5 in/s, maximum 5 in/s (the poses show about 0.85 of the change of the body). A pose of a model that the other player drags, and the jump when remote mode ends, make no sound. A pose does not carry its send time, so the jitter of the network moves the velocities: more than a few ms of jitter makes extra small bumps at a high speed of a fall.
- The token sounds come from the Log (`game-log.md`): each browser plays a sound for each new `token` or `held` entry that is put on (`on`). Entries that exist when the table opens, and entries older than 5 s, play nothing. One source, so both players hear the same sound. If the batch has Activated, that sound plays.
- The ping (`ping.md`): `ping-bing` plays when a ping starts, in the browser that pings and in the other one. A ping that the other player made before the join makes no sound.
- A token put down on the table (`tokenPlace`): the browser that drags plays it at the end of the drag, when the drop is on the table: a crisis token or a held token dragged off its card, a new or moved loose token, pile or supply token. A drop on a character plays nothing new, because the Log sound above plays there. A drop that lands off the table, and a cancel (Escape), play nothing. The other browser plays it when the other player's claim on the token key ends (`net/ownership.js`) and the piece in the document is new, moved and not held. A cancel, a hold, a removed piece and a lost claim change nothing, so they are quiet. The app's own moves have no claim (setup, a crisis card change, held tokens that drop, **Remove**, **Done** of a waiting token), so they make no sound. One drop is one sound in each browser.
- A token taken off, damage and Power make no sound.

## Volume

**Sound** slider in the Settings menu (`table-tools.md`), 0 to 100, default 10. 0 is off. Stored in this browser (localStorage, `mcp-assist-3d/settings`).

## First click

A browser blocks sound until the player clicks or presses a key. The app makes its audio context at the first `pointerdown` or `keydown`. A sound before that is skipped.

## Code

`src/sound.js` (`playSound(group, { volume, key })`, `playShake`, `setVolume`), `src/bumps.js` (the bump finders), `src/components/OtherDiceTray.jsx` (the other player's dice), `src/components/CharacterModel.jsx` (the landing of a model, own and remote), `LiveSync.jsx` (`poseTime`), `src/soundGate.js` (the bump limits), `src/components/Ping.jsx` (the ping sound), `src/log/useLogSounds.js`, `src/tokens/useRemoteDropSounds.js` and `tableDrop.js` (the other player's token drop), `soundOf` in `src/log/log.js`.

## Not built

- Other files. The player listens and asks for others if needed.
