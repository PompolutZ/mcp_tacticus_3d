# Plan: Table sounds

Requested by the user on 2026-10-12, after the test of `game-flow.md`. Status: OK by the user on 2026-10-12, in progress. Branch `table-sounds`, from main at `21ca644`.

Each step makes one commit and writes its **Result** below. Feature docs change in the same step as the code.

Checks of every step: `pnpm format`, `pnpm lint` (no new warnings), `pnpm test`, `pnpm --filter web build`.

## Request

- **Dice.** The dice sound plays once when **Roll** is pressed. The user wants:
  - **Roll**: the sound of 5 dice shaken in a hand, from the user's own recording. Repeated clicks of **Roll** should sound like shaking.
  - Each bump of a die on the tray plays a hit, in both browsers.
- **Models.** A model that lands on the table makes a sound. A different sound on terrain than on the mat.
- **Ping.** Freesound 220212 "Ping Bing" (https://freesound.org/people/GameAudio/sounds/220212/) replaces the current ping sound.
- **Ping clock.** The browser that receives a ping measures its 3 s itself, so a clock difference between two computers cannot hide a ping.
- The token, Activated and notice sounds stay.

The user recorded the real dice and a model with an iPhone, listened to cuts on a local page, and chose the files below. The model on the mat will be recorded again later. Until then the mat uses a Freesound file.

The user also recorded a model on the mat and 1, 3 and 5 dice falling in a dice tray (recordings 5 to 8). The user found their quality not good enough and wants to record again with a better microphone later. So this plan does not use them.

## Facts

### Sound code

- `src/sound.js`: `playSound(group)` plays a random file of a group, with the volume of the settings. One `AudioContext`, made at the first `pointerdown` or `keydown`. The same group plays at most once in 80 ms (`GROUP_GAP_MS`). Groups: `dice`, `token`, `activated`, `ping`, `notice`.
- Callers of the `dice` group: `roll()` in `DiceTray.jsx` (own throw, only when a die was thrown) and `OtherDiceTray.jsx` (a remote die goes to `air`, once per sync, not at mount). `Ping.jsx` plays `ping` when it mounts.
- `docs/features/sounds.md` still says that the ping is not built. It is built.

### Dice

- Own dice (`DiceTray.jsx`): each die is a dynamic Rapier `RigidBody` with a convex hull collider and `ccd`, while it is thrown or settles. A shelf die is kinematic and slides to its slot.
- Physics step: `TIME_STEP = 1 / 120` (`Scene.jsx`). `@react-three/rapier` 1.5 has `useAfterPhysicsStep` and `onContactForce`. The app uses neither today.
- The other player's dice (`OtherDiceTray.jsx`): kinematic bodies. An air die follows its live pose, `liveRef.current.die(key)` → `{ numbers, time }`, `time` in `performance.now()` ms when the pose arrived. A well die jumps to its stored pose.
- Live poses are sent every 33 ms at most (`SEND_MS`, `LiveSync.jsx`), on a channel that drops packets and does not keep the order.
- `scripts/dice-sim.mjs` runs the dice physics without a browser.

### Models

- Own model (`CharacterModel.jsx`): a drag makes the body kinematic. The release makes it dynamic with zero speed, so it falls to the table or terrain. `settle` puts it to sleep when it rests, then `onRest` stores the pose. A drop inside another model jumps back to the last free place (`setTranslation`).
- Other cases that move a model: R lifts and puts down (`lift.current`, with a `landing` state), a Throw or Push slides it (`startSlide`), **Remove** and a reload set the pose.
- The other player's model: remote mode, a kinematic body that follows `getLivePose(key)` (Scene's `getPieceLive`, from `liveRef.current.pose(key)`). `pose(key)` returns the numbers only. The store has the arrival `time` too. When remote mode ends, Scene sets the stored pose: a jump.
- The table top is y = 0. Terrain pieces have their own colliders. `tablePoint` (`src/drag/tablePoint.js`) finds the terrain top under a point.

### Ping

- `src/net/presence.js`: the awareness field `ping: { id, at: [x, y, z], t }`. A ping is new when its id is new.
- `Ping.jsx`: shows nothing and plays nothing when `Date.now() - ping.t >= 3 s`. `t` is the clock of the browser that pinged. So a clock difference of more than 3 s between two computers hides every ping of the other player.

### Files

The new files are already in the worktree, in `apps/web/src/assets/sounds/`, not committed. Step 1 commits them.

| Files | Group | Source |
|---|---|---|
| `shake-1..16.mp3` | `shake` | The user's recording "New Recording 2": 5 dice shaken in a hand |
| `die-hit-1..16.mp3` | `die` | The user's recording "New Recording": one die dropped on the mat |
| `model-terrain-1..11.mp3` | `modelTerrain` | The user's recording "New Recording 4", second part: a model put on a plastic terrain piece. Version "Soft 1". |
| `model-mat-1.mp3` | `modelMat` | Freesound 556387 "Moving piece on a boardgame" by zachrau, CC0, hit 2. Until the user records the mat again. |
| `ping-bing.mp3` | `ping` | Freesound 220212 "Ping Bing" by GameAudio, CC0 |

How the files were made (for `README.md`):

- The user's recordings: iPhone Voice Memos, AAC 48 kHz, on 2026-10-12. The user owns them. The originals stay with the user.
- Every file: mono, `highpass=f=80`, 44.1 kHz, `libmp3lame -q:a 6`.
- Own hits: cut at a sharp rise of loudness, made equally loud (peak -3 dB), 15 ms fade out. "Soft 1" (terrain) also has `lowpass=f=3000` and -6 dB, with a 30 ms fade out.
- Cut times, `start/length` in seconds:
  - `shake-1..16` (New Recording 2): 3.380/0.198, 9.330/0.098, 10.438/0.234, 13.222/0.190, 13.688/0.166, 17.988/0.220, 18.404/0.246, 18.890/0.216, 20.230/0.244, 21.676/0.104, 23.662/0.242, 25.058/0.162, 26.912/0.078, 28.062/0.212, 29.920/0.300, 30.876/0.162.
  - `die-hit-1..16` (New Recording): 7.452/0.140, 10.244/0.202, 13.222/0.116, 16.598/0.212, 19.070/0.300, 21.640/0.148, 24.534/0.210, 27.424/0.118, 31.080/0.194, 31.506/0.114, 33.986/0.140, 36.758/0.198, 39.388/0.184, 43.484/0.166, 48.982/0.156, 51.892/0.160.
  - `model-terrain-1..11` (New Recording 4): 27.464, 28.852, 29.694, 30.318, 30.926, 32.274, 33.054, 33.634, 34.404, 35.192, 38.358, each 0.300 long.
  - `model-mat-1`: the Freesound preview `https://cdn.freesound.org/previews/556/556387_676927-hq.mp3`, `-ss 2.899 -t 0.064`, 20 ms fade out.
  - `ping-bing`: the Freesound preview `https://cdn.freesound.org/previews/220/220212_4100837-hq.mp3`, whole.
- Freesound gives the original file only after a login. The previews (128 kbps mp3) are good enough for these short sounds.

## Decisions

1. **Roll shakes.** The `shake` group plays as a pattern: 4 random files at 0, 260, 430 and 540 ms, with volume 1, 0.55, 0.3 and 0.15 of the setting. The user heard this pattern on the listening page and chose it. It plays where the `dice` sound plays today: an own **Roll** that throws a die, and the start of a remote throw. Every click of **Roll** starts a new pattern, so repeated clicks sound like shaking.
2. **One bump, one hit.** Each bump of a die plays one `die` hit. The files `dice-throw-1..3` and `bong_001` are removed.
3. **Bump finder.** A new plain module `src/bumps.js`. It gets the velocity of a piece over time and returns a bump strength from 0 to 1, or 0 for no bump. A bump is a sharp change of velocity, after the part that gravity adds is taken away. Below a minimum change there is no bump, so a die that rolls, slides or rests is quiet. The minimum and the maximum come from `scripts/dice-sim.mjs` measurements, not from a guess. Tests.
4. **Own pieces.** The velocity comes from the Rapier body after each physics step (`useAfterPhysicsStep`): own dice while they are dynamic, own models while they are dynamic and not asleep. The finder starts fresh when a body becomes dynamic or jumps (`setTranslation`), so a jump is never a bump.
5. **The other player's pieces.** The velocity comes from two live poses in a row: distance / time between their arrivals. The finder starts fresh after a gap of more than 100 ms (lost packets) and on a jump (a speed that no die or model has). So the sound matches what this player sees, within about one packet. A small bump can be missed when a packet is lost. No new network message.
6. **Loudness.** The volume of a hit is the bump strength times the **Sound** setting. A harder bump is louder.
7. **Limits.** One piece plays at most one bump in 60 ms. All bumps together play at most 6 sounds in 100 ms. The 80 ms group gap does not apply to bumps and to the shake pattern, because 5 dice bump at the same time.
8. **Model landing.** The bump finder on a model plays a model sound. A model that comes to rest on terrain plays `modelTerrain`. A model on the table top plays `modelMat`. It covers every case where the model falls by physics: a drag release, and the others that fall (R down, the end of a Throw or Push, if they fall by physics). A pose that is set (reload, **Remove**, back to the card) makes no sound.
9. **Ping.** `ping-bing.mp3` replaces `bong_001`.
10. **Ping clock.** `t` goes away from the ping. The browser that receives a ping shows it when its id is new, and its 3 s start when it arrives. A ping that is already in the first state that this browser gets from that player (a ping from before the join) shows nothing.
11. **Groups.** `sound.js` groups after this plan: `shake`, `die`, `modelMat`, `modelTerrain`, `token`, `activated`, `ping`, `notice`. The user's new mat recording later replaces the files of `modelMat`, with the same group name.

## Step 1: Files, groups, Roll shake, ping sound

Work:

1. Commit the new files (Facts, "Files"). Remove `dice-throw-1..3.mp3` and `bong_001.mp3`. `README.md`: the source, author, license and how each file was made.
2. `src/sound.js`: the groups of decision 11. `playSound(group, { volume, key })`: `volume` 0 to 1 multiplies the setting, `key` is the piece for the 60 ms gap of decision 7, and the 6-in-100-ms cap. A function for the shake pattern (decision 1), its timings as named constants.
3. `DiceTray.jsx` and `OtherDiceTray.jsx`: the shake pattern where `dice` plays today.
4. `Ping.jsx`: plays the new `ping` file (only the file changes in this step).
5. Docs: `sounds.md` (the table, the shake pattern, sources and licenses, the ping is built), `dice-rolling.md`.

Checks: as in "Checks".

User, after this step:
- Press **Roll**: the shake sound, in both browsers. Click it fast many times: it sounds like shaking.
- P: the new ping sound.

### Result

Built.

- The 41 sound files are committed. `dice-throw-1..3` and `bong_001` are removed. `README.md` rewritten with sources, licenses, cut times.
- `src/sound.js`: the 8 groups. `playSound(group, { volume, key })`. With a `key` the 60 ms key gap and the 6-in-100-ms cap apply, and the group gap does not. `shake`, `die`, `modelMat`, `modelTerrain` have no group gap. `playShake()` plays the pattern, with named constants.
- `src/soundGate.js` (new) holds the gap and cap rules as plain code, so `src/soundGate.test.js` runs without an AudioContext.
- `DiceTray.jsx` and `OtherDiceTray.jsx` call `playShake()`. `Ping.jsx` is unchanged: the group `ping` has the new file.
- Docs: `sounds.md`, `dice-rolling.md`.
- Deviation: the gate is in its own file `soundGate.js`, not in `sound.js`, because `sound.js` needs a browser.

## Step 2: Bump finder, own dice

Work:

1. `src/bumps.js` (decision 3), with tests: a fall that stops, a bounce, a roll on the tray, a die at rest, gravity only, a fresh start.
2. Measure with `scripts/dice-sim.mjs`: the velocity change of the first bump, of small bumps and of rolling. Choose the minimum and the maximum. Write the numbers in the Result.
3. `DiceTray.jsx`: `useAfterPhysicsStep` feeds each dynamic die to the finder and plays `die` with the strength as volume and the die as key.
4. Docs: `sounds.md` (the bump rule, loudness, limits), `dice-rolling.md` (a hit on each bump).

Checks: as in "Checks".

User, after this step:
- Roll 5 dice: the shake, then a hit on each bump, loud at first, quieter as they settle. Silence when they rest.
- Reroll one die: only its bumps.

### Result

Built.

- `src/bumps.js`: `createBumpFinder({ gravity, min, max })` gives `feed(velocity, dt)` (strength 0 to 1, or 0) and `reset()`. `dt` is a parameter and the source of the velocity is free, so step 3 feeds live-pose speeds with the same finder. The gap and jump rules of step 3 go in as a check before `feed` or as an option. `DIE_BUMP_MIN`, `DIE_BUMP_MAX`. Tests in `src/bumps.test.js`.
- `DiceTray.jsx`: `useAfterPhysicsStep` feeds each die while it is dynamic and awake, and plays `die` with the strength as volume and key `<tray>:<die id>`. A kinematic or sleeping die resets its finder each step, so a die that becomes dynamic or wakes starts fresh. `throwDie` resets it too: a throw sets the speed and is no bump.
- Docs: `sounds.md`, `dice-rolling.md`.

Measured with a scratch copy of `scripts/dice-sim.mjs` (not committed; 5 dice thrown together, 200 rounds, 1000 die throws, 120 Hz, dice gravity 25), the velocity change per step:

- Gravity alone does not work as the "no bump" reference. A die at rest has velocity 0, and every step the gravity-only guess says -0.208 (25/120), so a rest looked like a bump of 0.208. The finder takes the smaller of two distances: to a free fall and to an unchanged velocity. Rest then measures 0.000 (p99 0.001, max 0.105), and a roll 0.005 median, 0.12 at p99.
- First bump of a throw (peaks above 0.3): p10 4.1, median 18, p90 24, max 31 in/s.
- Later bumps: p10 0.47, median 2.2, p90 7.8, p99 19, max 27. 26% are under 1.
- A bump is one step long: 1.04 steps on average, 4 at most. So no smoothing is needed, and the 60 ms key gap of decision 7 handles the rest.
- With minimum 1: 7.2 bump events per die per throw, the last one at 2.2 s (p50), 2.7 s (p90). With minimum 0.5 it is 8.5, with 2 it is 5.4.

Chosen: minimum 1 in/s (under the soft ticks of a rolling octahedron, above the roll noise by 8 times), maximum 20 in/s (a first bump of a throw at p90 or more is full loudness; later bumps are quieter).

Deviation: the "gravity taken away" of decision 3 became "the smaller distance to free fall and to unchanged velocity", for the reason above.

Not checked in a browser (the user checks).

## Step 3: The other player's dice

Work:

1. `OtherDiceTray.jsx`: for each air die, each new live pose (a new `time`) feeds the finder (decision 5). Plays `die`.
2. `src/bumps.js`: the gap and jump rules of decision 5, with tests.
3. Docs: `sounds.md`.

Checks: as in "Checks".

User, after this step:
- Two browsers. Roll in one: the other browser plays the bumps, at about the same moments that its dice bump.

### Result

(empty)

## Step 4: Model landing

Work:

1. `CharacterModel.jsx`, own model: `useAfterPhysicsStep` feeds the body while it is dynamic and awake (decision 4). Plays `modelTerrain` or `modelMat` (decision 8) with the strength as volume. Find out which of R down, Throw and Push fall by physics, and how to tell terrain from the table top. Write both in the Result.
2. Remote model: `liveRef.current.pose(key)` also gives `time` (or a new accessor), so a model in remote mode feeds each new live pose to the finder (decision 5). The jump when remote mode ends makes no sound.
3. Docs: `sounds.md`.

Checks: as in "Checks".

User, after this step:
- Drag a model and release it on the mat: the mat sound, in both browsers.
- Release a model on terrain: the terrain sound.
- A reload and **Remove**: no sound.

### Result

(empty)

## Step 5: Ping clock

Work:

1. `src/net/presence.js`: the ping is `{ id, at }`. For each other client, remember the ping of the first state this browser got. That ping shows nothing (decision 10). Tests in `presence.test.js`.
2. `Ping.jsx`: the 3 s and the fade start when it mounts. No `Date.now()` compare.
3. Docs: `ping.md`, `peer-to-peer.md` (the awareness field), `sounds.md`.

Checks: as in "Checks".

User, after this step:
- Two browsers: P in one, the other shows it and plays the sound.
- Reload the other browser within 3 s of a ping: it does not show the old ping.

### Result

(empty)

## Open questions

None. The user accepted the decisions on 2026-10-12.
