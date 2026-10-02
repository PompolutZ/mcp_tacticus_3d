# Feature: Dice rolling

Status: implemented (all 6 phases). Not checked in a browser yet; every phase was built and read
back against the code only, per the rules in `docs/plan-dice-rolling.md`.

## Goal

Players roll the Crisis Protocol die in the app, as in TTS. A player chooses how many dice to roll and presses Roll. The dice jump from the player's tray into the air and spin. Then they fall and bounce on the tray, the table, terrain, models and other dice. The result is the face that points up when a die stops. The app does not choose the result with a random number.

When a player presses Roll again, the dice are thrown again from where they are, also while they are in the air. A die that is high in the air is not thrown again, but its spin changes, as in TTS.

## Players apply the rules

The app rolls the dice, shows the results and keeps a history. It does not apply the attack rules. For example, it does not compare Hits with Blocks, and it does not apply Hex, Shock, Incinerate or cover. Players do this themselves, in the same way as for the crisis cards (see `docs/feature-crisis.md`).

The app has the tools that the rules need. The rules come from the [Jarvis rules reference](https://www.jarvis-protocol.com/rules-reference):

| Tool in the app | Rule |
|---|---|
| Reroll one die | In the modify steps, a die can be rerolled any number of times. But one rule that allows rerolls can reroll the same die only once. (p15) |
| Add dice for Crits | Players roll additional dice for Crits once per roll, not for each Crit that is rolled. (p23) |
| Change a die to another face | A defender that has cover can change one defense die to a Block. (p18) |

The rulebook has no rule for a die that rests tilted. The app throws such a die again (see [Tilted dice](#tilted-dice)).

## Terms

| Term | Meaning |
|---|---|
| Well | The large, low part of the tray. Dice lie there before a throw and land there after it. |
| Shelf | The raised part of the tray, on the side toward the center line of the table. Dice that have a result stand there in rows. |
| Throw | The app gives a die a new rotation, an upward speed and a spin. Physics does the rest. |
| Rest | A die rests when it stops moving (see [Settle](#settle)). |
| Top face | The face whose direction is closest to straight up. |
| Tilted | A die that rests with its top face more than 15° from flat. For example, it leans on a wall or on another die. |

## The die

The die has 8 faces with 6 symbols. The face numbers come from the mod's `RotationValues`. They were checked against the TTS D8 template and the TTS D8 mesh. The opposite faces are 1 and 5, 2 and 6, 3 and 7, 4 and 8 (measured from `RotationValues` and from the TTS D8 mesh on 2026-09-30).

| Face | Symbol | Name in the app | Name in the mod | Opposite face |
|---|---|---|---|---|
| 1 | skull | Skull | Failure | 5 |
| 2 | shield with a burst | Block | Block | 6 |
| 3 | starburst | Hit | Hit | 7 |
| 4 | none | Blank | Blank | 8 |
| 5 | burst with "!" | Crit | Critical | 1 |
| 6 | starburst | Hit | Hit | 2 |
| 7 | spiral | Wild | Wild | 3 |
| 8 | none | Blank | Blank | 4 |

So one roll gives a Hit with a chance of 1/4, a Blank with 1/4, and each other face with 1/8.

### Model

- In TTS, the die is the built-in D8 shape of TTS (`Custom_Dice`, type 2) with one image. The mod has no mesh for it. The image is a 2048 × 2048 texture in the layout of the TTS D8 template. It is in the TTS cache.
- The app builds its own die. It is a regular octahedron: 6 corners, 8 faces. Each face gets the UV triangle of the same face number in the TTS D8 template, so the cached texture fits without changes.
- The TTS D8 mesh is in the TTS game files, not in the mod. It has bevelled edges and is about 3% longer from tip to tip. The app does not use it, for two reasons: its license is unknown, and a regular octahedron gives every face the same chance.
- Size: the tray script scales each die by the tray scale, 0.8. At that scale, the TTS die is 0.94" from tip to tip and 0.56" between opposite faces. The app die is 0.94" from tip to tip. A regular octahedron of that size is 0.54" between opposite faces, and each edge is 0.66".
- The collider is the convex hull of the same 6 corners. So the center of mass is the center of the die.
- Both players use the same dice. TTS does the same.

## Tray

Each player has a tray on their half of the table, next to the mat, on the +x side. The model is the TTS Dice Tray (an OBJ file and a texture, both in the TTS cache). The tray has the TTS color of its side: Red `{0.86, 0.10, 0.09}`, Blue `{0.12, 0.53, 1}`.

Sizes at the TTS tray scale 0.8, measured from the mesh:

| Part | Size | Floor above the table |
|---|---|---|
| Whole tray | 13.5" (x) × 16.8" (z) × 1.67" | — |
| Well | 12.8" × 8.6". The walls are 1.37" high. | about 0.3" |
| Shelf | 12.8" × 2.9" | about 1.1" |
| Counter strip and button lip | TTS puts its buttons and counters here. In the app they have no function, because the HUD panel replaces them. | — |

The tray is a fixed body. Its collider is a trimesh of the tray mesh, because the mesh is not convex. TTS also uses the tray mesh as the collider.

### Position

TTS puts both trays at x = 36. That is the edge of the app table, which is 72" wide (x from -36 to 36). So the trays would hang over the edge. The app moves them inward:

- Blue tray center at (27, 0, 10.1). Red tray center at (27, 0, -10.1).
- Each tray covers x from 20.25 to 33.75. The mat ends at x = 18. The tray covers z from 1.7 to 18.5 on its side, the same range as in TTS.
- Each tray turns so that its shelf faces the center line (z = 0), as in TTS.
- In TTS, the Red tray is at -z. The app puts TTS z at app -z, so without a change the Red tray would be on the Blue side. The app puts each tray on the side of its own color.
- The TTS Tool Trays are at x = 23.5, so they would overlap the dice trays. The app has no tool trays.
- The planned scoring board is at x = -23.1, on the other side of the mat (see `docs/feature-crisis.md`).

## Controls: HUD panel

Each tray has its own HTML panel. The Blue panel is at the bottom right of the screen, and the Red panel is at the top right. In the default camera view, Blue is at the bottom.

A panel has:

- An inset view of the tray (see [Inset view](#inset-view)).
- `−  N  +`: N is the number of dice that are not on the shelf.
- Roll and Clear.
- 6 face icons with the number of dice on the shelf that show each face. The TTS icons are in the cache (`DCRIT_UI.png`, `DWILD_UI.png`, `DHIT_UI.png`, `DBLOCK_UI.png`, `DBLANK_UI.png`, `DFAIL_UI.png`).
- `+N Crits`.
- The history of the tray.

A click on a face count opens a menu:

- **Reroll one**: one die with this face moves from the shelf back into the well.
- **Change one to**: the 5 other faces.

The panel works even when the tray is off screen, because the panel has its own view of the tray.

## Roll flow

The flow follows the TTS tray script, with three changes (see the list after the steps).

1. `+` adds one die. The die appears above the well at a random point, 4.8" above the floor, with a random rotation, and falls into the well. `−` removes the last added die that is not on the shelf. A tray holds at most 42 dice. This is the TTS limit, and the shelf has 42 places.
2. Roll throws every die that is not on the shelf, from where it is (see [Throw](#throw)). Dice on the shelf do not move.
3. When the player presses Roll while those dice move, they are thrown again from where they are, also in the air. TTS does the same, because its script does not block a second press. A die that is more than 5.6" above its rest height on the well floor is not thrown again (`ROLL_HEIGHT_LIMIT` in `src/dice/tray.js`). It only gets a new random spin (step 4 of [Throw](#throw)), so it is harder to see which face will be up. In TTS, when a player presses Roll many times, each die is thrown again only when it falls back to one height, as if it bounced on an invisible floor above the tray. Each press also changes the spin of the dice above that height. So the dice do not go higher with each press. A new die that falls into the well was not thrown yet, so Roll throws it at any height. 5.6" is the TTS height (see [Measurements](#measurements)).
4. When every thrown die rests, the app reads the top face of each die, in the well or outside it. A tilted die is thrown again (see [Tilted dice](#tilted-dice)).
5. Then each die turns flat on its top face and moves to the shelf. The dice on the shelf are sorted by face: Crit, Wild, Hit, Block, Blank, Skull. The counts and the history update.
6. **Reroll one** moves one die from the shelf back into the well. The player presses Roll to throw it.
7. `+N Crits` adds one die for each Crit on the shelf. It works once per roll (p23), until the next Clear. For any other case, `+` still adds dice.
8. **Change one to** turns one die to the chosen face and moves it to that group on the shelf. The history records the change.
9. Clear removes all dice from the tray. The history stays.

Changes from TTS:

- TTS puts the dice on the shelf in the order they were added. The app sorts them by face, so the counts are easier to read.
- TTS reads the nearest face, even when a die is tilted. The app throws a tilted die again.
- TTS has buttons and counters on the tray model. The app has the HUD panel instead.

The dice on the shelf are kinematic bodies. As a result, thrown dice bounce off them, but they cannot move them or change their face. The app stores the result of each die, so it does not read the dice on the shelf again.

In TTS, a player can pick up a die from the shelf. In the first version of the app, players cannot drag dice.

### History

Each tray has its own history, newest entry first. The history lasts until the page reloads, because the app does not store anything.

An entry says where the thrown dice came from. It shows the result of each thrown die and the totals on the shelf after the throw. Examples:

- `Roll: 2 Hit, 1 Crit, 1 Blank, 1 Skull`
- `Crits: 1 Wild. Shelf: 2 Hit, 1 Crit, 1 Wild, 1 Blank, 1 Skull`
- `Reroll: Blank → Hit. Shelf: 3 Hit, 1 Crit, 1 Wild, 1 Skull`
- `Changed: Skull → Block`
- `Cleared`

TTS prints similar lines in the chat, for example `Initial Results: Hits - 2  Crits - 1  Wilds - 0 …`.

## Physics

### What TTS does

- The tray script only calls TTS's own `roll()` on each die in the well. The script sets no speed and no force.
- A TTS developer describes `roll()` like this: "a programatic random seed to snap to a rotation and additional random seeds to impart angular velocity" ([Steam, 2025-05-15](https://steamcommunity.com/app/286160/discussions/0/591770958120935244/)). Players also describe a random upward speed. TTS does not publish the numbers, so `scripts/tts-dice-measure.lua` measured them (see [Measurements](#measurements)). The upward speed is 11–19.5 in/s. In the first frames after `roll()`, the spin from `getAngularVelocity()` is only 7.7–11 rad/s. But TTS dice look like they spin much faster, so this number does not explain how TTS dice move. The next run of the script measures the spin during the whole roll.
- TTS physics runs at 90 Hz with 14 solver iterations. The maximum angular speed is 50 rad/s.
- The gravity is -25 in/s² (measured).
- The die has mass 0.95, drag 0.1, angular drag 0.1 and friction 0.6 (measured). The combine rule is probably Average, the Unity default. The tray script also sets `bounciness = 0.8` on each die. Other objects have bounciness 0.

### Throw

For each die, the app does the same steps as TTS `roll()`:

1. Set a random rotation with a uniform distribution (Shoemake's method). Three random Euler angles do not give a uniform distribution, so the app does not use them.
2. Set a random upward speed of 11–19.5 in/s (`THROW_UP_MIN`, `THROW_UP_MAX`), the TTS range. The die goes up 2.4–7.6".
3. Set a small sideways speed toward a random point in the well, at least half a die from the walls. The app computes this speed from the flight time, so most dice land in the well. Walls and other dice then change their path.
4. Set a spin around a random axis, with a random speed of 0–50 rad/s (`THROW_SPIN_MIN`, `THROW_SPIN_MAX`). 50 is the TTS upper limit. The range is chosen by look, because TTS dice spin fast in the air. On 2026-10-02 the app used 7.7–11 rad/s, the TTS reading after `roll()`. Then the dice only tilted in the air, and the app did not look like TTS. Faster spin makes more dice bounce out of the well (see [Headless](#headless)).

The new speeds replace the old ones. So a die that falls goes up again, and a die in the air changes direction from where it is.

Step 1 can be seen as a jump in rotation when a die lies still. TTS has the same jump. The jump is needed for fairness: when a throw is low, a die lands more often on the face that was down at the start ([Kapitaniak et al. 2012](http://kapitaniak.kdm.p.lodz.pl/papers/2012/Kapitaniak_Strzalko_Grabski_Kapitaniak.pdf)).

The random numbers come from `crypto.getRandomValues`.

The upward speed was measured in TTS on 2026-10-01 (see [Measurements](#measurements)). The spin is not measured yet in a way that matches the look of TTS.

### Values

"Start value" means the first value to test. The measurements decide the final value.

| Property | TTS | App | Reason |
|---|---|---|---|
| Size | 0.94" tip to tip | 0.94" tip to tip | Same die. |
| Mass | 0.95 | 1, from the density and the volume | Mass matters only between dice, and all dice have the same mass. The app sets speeds directly, and models are dominant (see [Collisions](#collisions)). |
| Friction | Die 0.6. The tray's friction was not measured. | Die 0.6 with combine rule Min: 0.6 on the table, tray and terrain | Table, tray and terrain have friction 1 (`FRICTION` in `src/physics.js`). With Average, the die would get 0.8. |
| Restitution (bounce) | Die 0.8, others 0, Average: 0.4 | Die 0.8, Average: 0.4 | Table, tray and terrain have restitution 0 in the app too. So the result is the same as in TTS. |
| Damping | Drag 0.1, angular drag 0.1 | Start value: linear 0.1, angular 0.1 | Unity drag and Rapier damping use similar formulas, but not the same one. |
| Gravity | -25 in/s² (`Physics.getGravity()`; a free fall gave 24.3, and drag explains the difference) | World: -30 in/s². Dice: `gravityScale` 25/30, so -25 (`DIE_GRAVITY` in `src/dice/throw.js`) | Models use -30 (`WORLD_GRAVITY` in `src/physics.js`). |
| Step | 90 Hz, 14 solver iterations | 120 Hz, 4 solver iterations (the whole world) | If dice shake when they touch each other, raise `numSolverIterations`, and measure the cost. |
| CCD | Not known | On | The tray walls are a thin trimesh, and a fast die can pass through a thin wall. CCD (continuous collision detection) checks the path between two steps. |

### Collisions

| A die hits | Result |
|---|---|
| Table, tray, terrain | The die bounces. |
| Table edge | The die bounces off an invisible wall. The walls are one kinematic body, so pointer and ground casts (only fixed bodies) pass through them. A dragged model is kinematic too and passes through them. A model that falls or tips at the edge stops at them. |
| Another die | Both dice bounce and push each other. |
| A die on the shelf | The thrown die bounces. The die on the shelf is kinematic, so it does not move. |
| A model base | The die bounces. The model does not move. |
| A figure | The die passes through. Only the base of a model has a collider (README, "Collider view"). |
| A tool | The die passes through. Tools are sensors. |
| A model that a player drags | The model is kinematic while it is dragged, so it pushes the die. |

Models get `dominanceGroup={1}`, and dice keep the default 0. In a contact between two groups, Rapier moves only the body with the lower group. Fixed and kinematic bodies are always dominant. So this change affects only contacts between models and dice. Contacts between two models, or between a model and the table, do not change.

The app has no collision groups today. The dice do not need any, because the dominance groups are enough.

`castDown` in `src/physics.js` casts against fixed bodies. The tray is a fixed body, so a model or a tool that a player moves over the tray stands on the tray. The dice are dynamic, so the casts ignore them.

### Settle

Rapier 0.14 does not let the app set the thresholds for sleep, and Rapier can take seconds to put a body to sleep. So the app uses its own rule, like the settle rule of the models in `CharacterModel.jsx`. A die rests when its linear speed and its angular speed stay below a limit for a short time. The headless test decides the limits.

A die that still moves after 8 s counts as tilted.

### Tilted dice

- To find the top face, the app turns each face direction by the rotation of the die. The top face is the face whose direction is closest to up (the largest dot product with up).
- A die that lies flat on a face gives a dot product of 1. A die balanced on an edge gives 0.82.
- A die is tilted when the dot product is below 0.966 (15°). The app throws a tilted die again.
- A die that rests flat outside the well counts, and moves to the shelf with the other dice. Outside the well means on the shelf, on the rim, on the table, on terrain or on a model base. TTS does the same: the tray script reads every die wherever it rests.
- The table has invisible walls at its edge (`src/table.js`), so a die cannot fall off the table. In TTS, a die can also leave the tray but not the table.
- If a die still gets below y = -10, or its position is not a number after a physics error, it moves to a free point above the well, as a new die does (4.8" above the floor, at least one die size from the other dice). Then it is thrown again from there. The point is not on the well floor, because a die placed there starts inside the tray or inside a die that rests there.

The rulebook has no rule for these cases. The app throws the die again so that every result is clear.

## Inset view

- Each panel has a box. The app draws the tray in that box, with a fixed camera above the tray at an angle. The main camera does not move.
- The box is visible while the tray has dice.
- drei `View` does not fit this case. It draws only its own children in its own scene, not the main scene.
- So a component inside `<Canvas>` takes over the rendering, with `useFrame` and priority 1. In each frame, it first renders the main camera to the whole canvas. Then, for each visible box, it reads the box position with `getBoundingClientRect()`, sets the viewport and the scissor to that rectangle, and renders the same scene with the tray camera.
- The box has no background, so the canvas under it can be seen.
- Cost: the scene renders one more time for each visible box. The shadow maps only need to render once per frame, so the component turns off `gl.shadowMap.autoUpdate` for the inset renders.

## Fairness

The result comes only from physics. It is fair when three things are true:

- Each throw starts from a rotation with a uniform random distribution.
- The collider has the same shape at every face.
- The random numbers do not repeat from one page load to the next (`crypto.getRandomValues`).

The headless test checks this with 8000 throws of one die in the tray world. Each face should come up about 1000 times. The chi-squared value, with 7 degrees of freedom, must be below 14.07 (α = 0.05). The test also runs with 10 dice at once, and with throws of a die that rests.

Owlbear Rodeo tested its dice in the same way: 2000 d20 rolls in each of 4 browsers. All passed ([blog](https://blog.owlbear.rodeo/are-owlbear-rodeos-dice-fair/)).

## Measurements

### In TTS

TTS does not publish the numbers of `roll()`. `scripts/tts-dice-measure.lua` measures them. It spawns its own dice over the Blue tray's well in the same way as the tray script, and measures:

- The TTS gravity (`Physics.getGravity()`), the physics step, and the die's mass, drag, friction and bounciness.
- For 30 rolls of one die: the upward speed and the spin in the first frames after `roll()`, the highest point above the rest height, and the time until the die is `resting`.
- For 5 rounds of 10 dice rolled at once: the time until all dice are `resting`.
- How many dice rest off the well floor.
- For `roll()` on every frame, like a player who presses Roll very fast: the height of the die just before each new throw. This is the height of the "invisible floor", and it sets `ROLL_HEIGHT_LIMIT`. It also counts how often the spin changes without a new throw.
- The gravity again, from the speed of a die that falls freely.

The tray script checks `resting` only every 1.5 s (`rollDelay`). So in TTS, the result appears up to 1.5 s after the dice rest.

To run it: `npm run tts-dice-measure` writes the TTS Saved Object "Dice measure", a red block with the script. In TTS, load the mod and spawn it from Objects → Saved Objects. The script runs at once, so the Workshop mod is fine. The script's header has the steps. Do not paste the script into an object and press Save & Play: on 2026-10-01 the game reloaded without the block, so the script never ran.

**Results (2026-10-01):**

| What | TTS |
|---|---|
| Physics step | 90 Hz |
| Gravity | `Physics.getGravity()` -25. Free fall 24.3 in/s²; drag 0.1 slows the die a little. |
| Die | Mass 0.95, drag 0.1, angular drag 0.1, bounciness 0.8, static and dynamic friction 0.6 |
| Upward speed after `roll()`, 30 rolls | 11.1–19.3 in/s, average 15.1, spread evenly |
| Spin in the first 5 frames after `roll()`, `getAngularVelocity()` | 7.7–11.1 rad/s, average 8.5. 13 of 30 rolls had exactly 7.67. TTS dice look like they spin much faster, so the app does not use this number. |
| Highest point above the rest height | 2.3–7.2", average 4.5 |
| Lift in the first frame | About 0.15", the normal rise of one frame. One roll of 30 lifted 1.12". |
| Time until one die rests | 1.7–3.2 s, average 2.2 |
| Time until 10 dice rest, 5 rounds | 2.55–3.1 s, average 2.8 |
| Dice that rest off the well floor | 0 of 30 single rolls, 0 of 50 dice in rounds |
| Rapid rolls: height of the next throw | Rises at first, then stays at 5.57–5.70" above the rest height |
| Rapid rolls: spin changes | About 85 per second at 90 `roll()` calls per second, so almost every call changes the spin |

The app takes the gravity, the upward speed, the friction and `ROLL_HEIGHT_LIMIT` (5.6") from these results. The spin stays 0–50 rad/s (see [Throw](#throw)).

The script now also measures the spin during the whole roll, in the flight and in the bounces. It reads the spin in two ways: from `getAngularVelocity()`, and from the change of the die's rotation between two frames. If `roll()` turns the die without physics, only the second way sees it. The script also reports the tray's friction and bounciness. These numbers come from the next run.

### Headless

The model physics was tuned on 2026-09-27 with a Node script that builds the Rapier world without a browser. The dice need the same kind of script, with one difference. The earlier script built its colliders by hand, so it missed a bug in the way the app built them. The dice script uses the app's own code to throw, to read the face and to build the colliders from the GLB files. It is committed as `scripts/dice-sim.mjs`, so that the fairness test can run again after a change.

The script measures:

- Fairness (see [Fairness](#fairness)).
- How often a die rests tilted.
- How often a die leaves the well.
- The time until all dice rest.
- The cost per frame with 42 dice.

**Results (2026-09-30, `npm run dice-sim`, seeds 1-3, spin up to 50 rad/s):** fairness passes for both the single-die test (8000 throws) and the 10-dice-at-once test (2000 throws), on every seed tried. A die rests tilted 0.4-0.7% of the time. A single die leaves the well 0-0.1% of the time. With 10 dice at once, 2.0-2.5% of the dice leave the well, because the dice hit each other. This is a little above the first target (under 2%). It is accepted, because such a die counts where it lands, as in TTS, and the walls keep it on the table. 10 dice at once settle in 2.7 s on average, 4.1 s at the worst seen (target: about 3 s or less). 42 dice cost about 0.3 ms per physics step, cheap next to the app's 1/120 s step.

Spin and dice that leave the well (10 dice at once, 3 seeds, 3000 dice for each value): 10 rad/s 0.3%, 20 rad/s 0.7%, 30 rad/s 0.9%, 40 rad/s 1.5%, 50 rad/s 2.9%. The tilted rate and the settle time do not change with the spin.

Tuning found a real bug, not just numbers to adjust: two dice that collide can occasionally get a huge, sometimes non-finite (`NaN`), velocity from a single unstable contact. The die is a sharp shape (an octahedron, tip to tip) spun up to the TTS maximum of 50 rad/s, which is about 24° of turn in one 1/120 s physics step — enough for a tip to pass most of the way through another die's face between two steps, which the solver then corrects with a large, sometimes unstable, push. Cutting the spin cap to 10 rad/s (`THROW_SPIN_MAX` in `throw.js`) and giving each die 8 extra solver iterations of its own (`DIE_SOLVER_ITERATIONS`, applied per body with `additionalSolverIterations`, not on the whole `<Physics>` world) cut this from double digits of throws in a hundred (at the TTS spin and the world's default 4 iterations) down to the tilted rate above. It still happens occasionally, more so as more dice are thrown together (roughly 1-7% tilted at 42 dice in testing) — see the Phase 3 Result in `docs/plan-dice-rolling.md` for the full tuning story and what Phase 4 should do about the cases it does not remove.

**Update, 2026-09-30:** with the current code, the explosions do not happen again. A test of 10 and 42 dice at 50 rad/s gave no die faster than 60 in/s and no `NaN`, also without `DIE_SOLVER_ITERATIONS`, and also with the old sim bug put back (a die outside the well restarted at the well floor). The cause of the Phase 3 explosions is not known. So the spin is back at 50 rad/s. `DIE_SOLVER_ITERATIONS` stays, because it is cheap. The app still moves a die with a `NaN` position back above the well.

**Update, 2026-10-02 (TTS values):** the throw used the TTS measurements: gravity -25 for dice, upward speed 11–19.5 in/s, spin 7.7–11 rad/s, friction 0.6. With seeds 1–7:

- Fairness passes on every test except one: seed 3, one die, 8000 throws (17.34). The same seed passes with 32000 throws (7.38). A fair die fails 1 test in 20 by chance.
- A die leaves the well 0.2–0.3% of the time alone, and 0.3–0.9% with 10 dice at once (before: 2.0–2.5%).
- A die rests tilted 1.2–1.8% of the time alone, and 0.7–2.3% with 10 dice (before: 0.4–0.7%). The app throws such a die again.
- 10 dice at once settle in 3.1 s on average, 4.3 s at the worst seen. TTS gives 2.8 s on average.
- 42 dice cost about 0.2 ms per physics step.

The friction causes most of the extra tilted dice. A test with one change undone at a time (seed 5): friction 0.4 gave 0.8% tilted alone and 0.4% with 10 dice; spin 0–50 rad/s gave 1.4% and 1.6%; gravity -30 with speed 15–20 gave 1.4% and 0.9%. In the app, the die's friction on the tray is 0.6, because the tray has 1 and the rule is Min. In TTS, Unity probably takes the average of the die and the tray, and the tray's friction was not measured. `scripts/tts-dice-measure.lua` now reports it.

Then the spin went back to 0–50 rad/s, because with 7.7–11 the dice did not look like TTS (see [Throw](#throw)). The other values stay. With spin 0–50 rad/s (seed 5, 3000 throws of one die, 1000 dice in throws of 10): fairness passes, a die rests tilted 1.4% of the time alone and 1.6% with 10 dice, and it leaves the well 0.5% of the time alone and 2.5% with 10 dice. 10 dice settle in 3.2 s on average, 4.6 s at the worst seen.

## Implementation sketch

- `scripts/migrate-dice.mjs` builds `src/assets/dice/d8.glb` and the die texture `d8.webp`. It converts the TTS tray OBJ and texture to `src/assets/dice/tray.glb` and `tray.webp`, and the 6 result icons to WebP. It uses `scripts/lib/convert.mjs` and `scripts/lib/tts.mjs`, like the other migrations.
- `src/dice/faces.js`: the 8 faces, each with its name and its direction on the die.
- `src/dice/throw.js`: functions without side effects: random rotation, throw speeds, top face, tilted check. The app and `scripts/dice-sim.mjs` both use them.
- `src/components/DiceTray.jsx`: the tray body, the dice bodies and the roll flow of one tray. It is inside `<Physics>` in `Scene.jsx`.
- `src/components/DicePanel.jsx`: the HUD panel. It is outside `<Canvas>` in `App.jsx`, next to `Toolbar`.
- `src/components/TrayInsets.jsx`: the inset render, inside `<Canvas>`.
- `CharacterModel.jsx`: add `dominanceGroup={1}`.
- State: the panel is outside the canvas, and the tray is inside it. Each tray puts its actions (add, remove, roll, clear, reroll, change) in a ref map in `App.jsx`, in the same way as `charBodies` in `Scene.jsx`. The tray sends its counts and history to state in `App.jsx`, and `App.jsx` passes them to the panel.

## Pitfalls to check

- **Sleeping bodies.** @react-three/rapier does not copy the pose of a sleeping body to its mesh. So the app calls `wakeUp()` before it moves a die, as it does for models. Done: `DiceTray.jsx` calls `wakeUp()` on a die before every teleport, throw and shelf move (see the Phase 4 Result in `docs/plan-dice-rolling.md`).
- **New dice inside each other.** When two new dice overlap, Rapier pushes them apart at high speed. So each new die needs a free spot, at least one die size from the others. TTS uses 49 fixed spots 1" apart, and its dice can overlap. Done: `freeDropPoint` (`src/dice/tray.js`) keeps every new point at least one die size from the others, including dice added in the same React commit (Phase 4b's `wellOccupiedPoints`).
- **Trimesh edges.** A die can bump on the inside edges between the triangles of the tray mesh. Rapier's `TriMeshFlags.FIX_INTERNAL_EDGES` reduces this. The @react-three/rapier 1.5 types do not list the flag, but the library passes extra arguments to `ColliderDesc.trimesh`. Confirmed by reading the library's own code (Phase 4a Result): the flag does reach Rapier's `ColliderDesc.trimesh`. Not checked with a real collision (no browser).
- **Shadows.** The shadow camera covers ±20 (`Scene.jsx`). The trays reach x = 34 and z = ±18.5, so they get no shadows. The shadow camera can be larger, or a second light can cast shadows over the trays. A larger shadow camera gives less shadow detail on the mat. Done: the shadow camera is now `left -26, right 38, top 25, bottom -34` with `shadow-mapSize` 3072 (Phase 4 Result), covering both trays at close to the old per-pixel detail.
- **Inset rectangle.** WebGL counts the scissor y from the bottom of the canvas, and `getBoundingClientRect()` counts from the top. The tray camera aspect must match the box. Done: `TrayInsets.jsx` flips the box's top-based rect to a bottom-based one before calling `gl.setViewport`/`gl.setScissor`, and sets each tray camera's `aspect` from the box's own width/height every frame. Checked in three's own code: `gl.setViewport`/`setScissor` take CSS pixels, not device pixels — three multiplies by the pixel ratio itself.
- **Remounts.** Terrain mounts again when the mat turns. The trays are not in the mat group, so they stay. A new map loads new assets. Check that the dice keep their state when the map changes. Done: confirmed by reading `Scene.jsx` (Phase 4a Result) — `DiceTray` is keyed only by `trayKey`, outside the group that Terrain/the mat remount into, so a map change or a mat turn never remounts it.
- **Rapier version.** @react-three/rapier 1.5 uses Rapier JS 0.14, which is built with enhanced determinism. From Rapier JS 0.15, the default package is built without it. This matters only if rolls are replayed or synced later. Still open — out of scope (see "Out of scope": no multiplayer sync).

## Other dice libraries

No library can throw dice in an existing Rapier world. So the app builds its own roller.

- **dice-box** (used in `wuclub_monorepo/apps/frontend_v2`) has its own canvas. It uses BabylonJS for drawing and ammo.js for physics, both in web workers. For this app, it has three problems:
  - The dice cannot hit the tray, terrain or models in this scene.
  - It cannot throw dice that are already on the table. Its reroll removes dice and adds new ones.
  - It sets the mass of a resting die to 0, so other dice cannot move it.
- **Owlbear Rodeo dice** uses the same libraries as this app (R3F and Rapier). But it has its own canvas and creates a new physics world for each roll. Its license is GPL-3.0, so the app does not copy its code.

The app uses these ideas from other projects:

| Idea | From |
|---|---|
| Settle limits plus a timeout | dice-box, Owlbear Rodeo |
| Uniform random rotation | Owlbear Rodeo, vork/dicer |
| Tilted check with a new throw | vork/dicer |
| Fairness test | Owlbear Rodeo |

## Out of scope

- Multiplayer sync.
- Sounds.
- Affiliation skins for the tray. The TTS cache has 4.
- Picking up and dragging dice.
- TTS messages when a player picks up or changes a die, for example "Jarvis: … picked up a Hit die". The app history records changes instead.

## Open questions

- Keyboard shortcuts? In TTS, keys 1–9 over the tray clear it and add that number of dice.
- Where exactly do the panels go, and how big is the inset box?
- `ASSETS.md` has three errors about the die:
  - The mesh `868485988860654056` belongs to the retired "Click Roller Universal". It is not the die.
  - The die texture is 2048 × 2048, not 1024.
  - Some symbol names are wrong. For example, the skull is Failure, not Critical.
