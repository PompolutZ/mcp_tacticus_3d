# Step 9: Moving objects

Detailed plan of step 9 in `docs/plans/implement-backend.md`. Peer-to-peer phase 3. The design is in `docs/feature-peer-to-peer.md` ("Data channels", "State", "Yjs document", "Moving objects (physics)", "What each player controls", "Debug flags", "Traffic per game"). Decisions 1, 2, 5, 6, 13 and 14 change parts of the design. The user agreed on 2026-10-09.

## Goal

When one player moves a piece, the other player sees it move, live. A piece is a model, a tool, a crisis token, a character token on the table, a pile, a tactic card or a score marker. Each piece rests at the same place on both screens, and the room stores that place. Each player uses only their own tools.

After step 8:
- A model that one player moves shows at its new place on the other screen only after the room opens again.
- Both browsers write the rest pose of a body that falls asleep (step 8, decision 18).
- The tools are React state. The other player does not see them, and a room does not save them.
- Tokens, cards and markers jump to their new place on the other screen when they are dropped.

The step comes after step 8, because it uses the connection of step 8. Dice (step 10) use the live channel and the claims of this step.

## Scope

In the step:
- Models pass through other models. This is the known bug in `README.md` (decision 1).
- One drag code for every piece (decision 3).
- The tools in the document, per side. The other player's tools show on the table and cannot be used.
- Claims in Yjs awareness, for every piece that a player moves. One browser writes each rest pose. A rest pose from the other browser moves the body.
- The live channel: live moves of every piece, and the cursor.
- The `?drop` and `?delay` flags.
- The bytes of each connection, in the browser console.
- Docs.

Left for later:
- Dice: step 10. Until then, each browser has its own dice, and the number keys add dice to the Blue tray in both browsers.
- A new token that a player drags from a Give source, a supply pile, a pile or the Library. It has no id before the drop, so it shows on the other screen at the drop. The cursor shows the drag.
- The other player's selection.
- A dropped network, "Reconnecting": step 11.

## Rules for every phase

- Read `CLAUDE.md`, `docs/plans/implement-backend.md` ("Rules for every step", "Step 9"), this plan, and the design sections named above.
- Do not open the app in a browser. Do not start the dev server. The user checks the app.
- Do not run `aws`, `cdk deploy` or `put-secrets`. `apps/api` and `infra/` do not change in this step.
- Do not commit and do not push. The main model commits each finished phase.
- Temporary files go in the session's scratchpad directory.
- Keep tool output small (`head`, `grep`, `tail`, summaries).
- Code: plain JavaScript in `apps/web`. Plain, short comments that say why. Match the style of the code around you.
- Web tests run with `node --test`. A module under test must not import modules that read `import.meta.env` or load three.js scenes. Put the rules in plain modules and pass the timers, the awareness, the event targets and the channels in as arguments.
- Never log an SDP, a token or a live packet.
- After a code change: `pnpm format` and `pnpm lint`.
- Docs: short sentences, common words, one fact per sentence. Never the word "comprehensive".
- If a check fails and the fix is not in this plan, stop and report. Do not change the plan's decisions on your own.

## Names

| Thing | Value |
|---|---|
| Persistence channel | `sync`, id 0, reliable and ordered (step 8). The Yjs document, and Yjs awareness (decision 13) |
| Live channel | `live`, id 1, `negotiated: true`, `ordered: false`, `maxRetransmits: 0`. Poses of moving pieces, the cursor, and dice in flight from step 10 |
| Piece key | `character:<model id>`, `token:<id>` (crisis token), `loose:<id>` (character token on the table), `pile:<id>`, `tactic:<id>`, `marker:<blue, red or round>`. A tool is `tool:<kind>` and is never claimed |
| Model collision group | Model colliders are in group 1, and their filter leaves out group 1 (`interactionGroups` of `@react-three/rapier`). Other colliders keep the default groups |
| Overlap mark | Outline mode `overlap`, the red of `outOfRange`. It wins over `selected` and `hovered`. A red tint of the figure, picked by look |
| Drag code | `drag/pointerDrag.js` (`startPointerDrag`, `DRAG_THRESHOLD` 4 px) and `drag/tablePoint.js` (`tablePoint`) |
| `tools` in the document | Record, depth 1: `tools.<side>.<kind>`. `side` is `blue` or `red`. `kind` is `range`, `move` or `angle` |
| Tool entry | `{ which, spawn, pose?, turn?, snap?, mode? }`. `which`: the range number (1 to 5), the movement type (`short`, `medium`, `long`), or `true` for `angle`. `spawn`: a random id, new at each spawn. `pose`: `{ x, y, z, yaw }`. `turn`: `{ right, left }`, the bend. `snap`: `{ kind, id, side, across }` or `null`. `mode`: `away` or `toward` |
| Own tool side | The own seat in a multiplayer room. `blue` in a single player room and the Sandbox |
| Awareness state | `{ owns: [piece key, …] }` |
| Live packet | JSON: `{ s, p?, c? }`. `s`: a sequence number. `p`: piece key → numbers. A model: `[x, y, z, qx, qy, qz, qw]`. A tool: `[x, y, z, yaw, right, left]`. A crisis token: `[x, z, yaw]`. A loose token, a pile, a tactic card, a marker: `[x, z]`. `c`: `[x, y, z]`, or `null` when the pointer left the table. Only the parts that changed |
| Packet rounding | Positions to 3 decimals (0.001"). Rotations, yaw and bend to 4 decimals |
| Times | A packet every 33 ms at most (about 30 per second). The cursor every 100 ms at most. Follow time 0.05 s. Tool rest 0.3 s. A model claim lasts at least 0.2 s. Traffic read every 60 s, logged every 10 min |
| Footprint slots | `MAX_FOOTPRINTS` 6 → 10 |
| Flags | `?drop=<percent>` and `?delay=<ms>`, dev builds only, on the receiving browser |

Ownership (`net/ownership.js`), the same API with and without a connection. `key` is a piece key:

| Function | Does |
|---|---|
| `claim(key)` | Adds `key` to the own `owns`. Returns `false` and changes nothing when the other player owns it |
| `release(key)` | Removes `key` from the own `owns` |
| `owner(key)` | `'me'`, `'other'` or `null` (decision 7 for a tie) |
| `writes(key)` | True when this browser writes the rest pose of the model `key` (decision 6) |
| `otherPresent()` | True when the other player's awareness state is here |
| `mine()` | The keys that this browser claims |
| `onLost(fn)` | `fn(key)` when this browser loses a tie for `key` (decision 7) |
| `subscribe(fn)`, `otherOwned()` | For React: the set of keys that the other player owns. The set object changes only when its content changes |

Files:

```
apps/web/src/
  physics.js                    + MODEL_GROUPS
  drag/pointerDrag.js           startPointerDrag: the gesture of every drag (decision 3)
  drag/tablePoint.js            tablePoint: the table, board or terrain point under a screen point
  characters/overlap.js         overlapMarks: which models show the overlap mark (decision 1)
  components/storedTool.js      the tool entry: rounding, equality, free spawn per side (decisions 10, 12)
  net/doc.js                    + tools
  net/syncChannel.js            + awareness messages (type 1)
  net/ownership.js              claims, owner, writer (decisions 5 to 7)
  net/peer.js                   + the live channel, traffic()
  net/live.js                   the live hub: packets, sequence, rounding, ?drop, ?delay (decisions 14, 16)
  net/traffic.js                bytes of the selected candidate pair from getStats (decision 17)
  net/debugFlags.js             + dropFlag, delayFlag
  rooms/table.js                + tools in startTable
  Table.jsx                     awareness, ownership, live hub, traffic log
  App.jsx                       tools from the document, poses and ownership to Scene, the token drag
  components/Scene.jsx          claims, rest writes, rest poses from the other browser, LiveSync, the other player's tools
  components/CharacterModel.jsx collision group, overlap mark, claim before an action, remote mode
  components/RulerTool.jsx      stored tools, rest writes, OtherTool, claims for Place and Throw
  components/CrisisToken.jsx, TacticCard.jsx, ScoreBoard.jsx, LooseToken.jsx, TokenPile.jsx, TokenDragPreview.jsx
                                the drag code, claims, the other player's live pose
  components/RemoteCursor.jsx   the other player's cursor
  components/SelectionOutlines.jsx  + overlap mode
  components/footprintProjection.js  MAX_FOOTPRINTS 10
```

## Decisions that fill gaps in the design

1. **Models pass through models.** The user decided the wanted behavior on 2026-10-09 (`README.md`, "Known bugs"):
   - A dragged model passes through other models. It can be dropped inside another model. After the drop, both models stay where they are.
   - It does not pass through terrain, and it can overlap tokens, as today.
   - While two models overlap, the one that moved last shows the overlap mark. Each model keeps a number that grows with each move: a drag, a Throw or Push, Place, Place 1, and from Phase 4 a claim of the other player. Of two models that overlap, the one with the higher number gets the mark. Two models overlap when their base circles overlap by more than 0.01" and their bases are at about the same height.
   - Changed by the user on 2026-10-10 (Phase 1b): a dragged model shows the mark as soon as it enters another model. A drag that ends inside another model puts the model back at the last place of this drag where it overlapped nothing. If the drag had no such place, the model goes back to where the drag started. From there it drops as after any drag. Only a drag does this. Place, Place 1 and Throw or Push can still end inside a model, and then the mark shows.
   - So rule 6 of the design goes away. No body pushes a resting model any more: models pass through models, tools are sensors, and dice do not move models (dominance groups). So there are no pushed bodies to claim, and no contact events.
2. **Every piece that a player drags is live.** The design streams models, tokens and tools. This step adds tactic cards, piles and score markers, because they move the same way. A new token from a Give source, a supply pile, a pile or the Library is the exception (see "Scope").
3. **One drag code.** Today the same gesture code is copied in six places: `CharacterModel.jsx`, `useDragTool` in `RulerTool.jsx`, `CrisisToken.jsx` (the token and its turn handle), `TacticCard.jsx`, `ScoreBoard.jsx`, and the token drag of `App.jsx`. `DRAG_THRESHOLD` is defined five times, and the screen-to-table point is copied five times (`TokenDragPreview.jsx` too).
   - `startPointerDrag(event, options)` does the shared part: the left button only, the 4 px threshold, a click or a drag, the window listeners for this pointer id, the camera controls off during the press, the release of pointer capture, and `cancel()`.
   - `tablePoint` gives the table, board or terrain point under a screen point: the first fixed collider that is not a sensor, else the table plane. An option gives `null` off the table (`TacticCard.jsx` needs it).
   - Each piece keeps what is its own: what moves (a physics body or a plain 3D object), the limits during the drag (the deploy line, Place, Throw), and what a drop does (a hold on a character, a tray slot, a marker spot, a tool snap).
   - The shared code is also the one place where a drag claims its piece (Phase 4), is cancelled after a lost tie (decision 7), and reports the pose of a piece without a body (Phase 6).
4. **Two ways a piece moves.**
   - A player action in one browser: a drag of any piece, the turn handle of a crisis token, and for models R, Q / E, Throw or Push, Place and Place 1. This browser claims the piece.
   - A change of the document that both browsers apply: a new character, a tray that moves when a character is added or removed, a removed terrain piece, a new map, a mat turn. This moves only models. Nobody claims them. Both browsers simulate the same move from the same document.
5. **Claims.** Every action of the first kind calls `claim(key)` first. When the other player owns the piece, the action does nothing. A drag claims its piece when it starts, after the threshold.
   - A piece without a body (token, card, marker, pile): the claim ends after the drop wrote the document, or when the drag is cancelled. So the release comes after the new place.
   - A model: the claim ends when the body is asleep and dynamic. Scene checks its own model claims on every frame. For each one that ended, it writes the rest pose, then calls `release`. Both go over the persistence channel, in this order, so the other browser gets the pose first.
   - A model claim lasts at least 0.2 s. So an action that wakes the body in the next frame (Q / E, Place) keeps its claim.
   - A piece that is gone ends its claim.
   - Why a check on every frame for models, and not the sleep event: a lifted model (R) is kinematic and can fall asleep in the air. And a lift that ends puts a sleeping model back to sleep in the same frame, so there is no new sleep event.
6. **One writer per rest pose of a model.** This replaces step 8, decision 18.
   - Claimed by this browser: this browser writes.
   - Claimed by the other player: this browser never writes.
   - Not claimed (the second kind of decision 4): the host writes while the other player is present. Without the other player, this browser writes, as in a single player room.
   - The reason: both browsers simulate the second kind from the same document, so their results are almost equal. One writer is enough, and both browsers know who the host is. The guest's body takes the host's pose when it arrives (decision 8).
   - A piece without a body has no rest pose. Its drop writes its place, as today. Only the owner of the claim drops it.
7. **Two claims at the same moment.** The player with the lower Yjs client id keeps the piece (design, rule 7). The other browser removes its own claim when it sees the tie (`onLost`). Its drag of that piece is cancelled through the drag code: no drop and no write. A lift or a slide of that model stops moving the body. The piece then follows the other player (decision 9).
8. **Rest poses of models from the other browser.**
   - A model that nobody claims: when its pose in `poses` changes and the body stands somewhere else, the body gets the exact pose, becomes dynamic and goes to sleep. A pose that this browser wrote equals the body, so nothing happens.
   - A model that this browser claims: a change of its pose in the document does nothing.
   - A model that the other player claims: a change waits. When the claim ends, the body gets the pose of the document, becomes dynamic, gets its contact forces back and goes to sleep (design, rule 5).
   - The other player is gone (the channel closed, or awareness timed out): the bodies of their claims become dynamic where they are, get their contact forces back, and stay awake. This browser simulates them and writes their rest poses (design, rule 8, and decision 6).
9. **A piece that the other player claims.**
   - A model is a kinematic body with no contact forces (solver groups 0), so it pushes nothing in this browser (design, "Bodies moved by the other browser"). R, Q / E, Place, Throw and a drag do nothing to it. A click still selects it.
   - Any other piece: a drag does not start.
   - Until its live pose comes (Phase 5 for models, Phase 6 for the others), it stays where it is.
   - A live pose of a piece counts only while the other player claims it. The design starts with the first pose or claim, whichever comes first. The claim is sent first, and models now pass through models, so a few lost first poses change nothing on the table.
   - When the claim ends, the piece shows its place in the document (for a model, see decision 8).
10. **Tools in the document, per side.**
    - The own side's entries replace `activeRange`, `activeMove`, `angleOn` and `toolSpawns` in `App.jsx`. Only the owner writes a side, so the two players never write the same entry. `angleSpawn` stays React state: only the owner's browser uses it, once, at the spawn.
    - A spawn (a key over a piece, a toolbar button, key 6) writes an entry with a new `spawn` and no `pose`. The tool key has `which` and `spawn`, so the tool mounts again in both browsers.
    - At mount, a tool with a `pose` starts there, with its `turn`, `snap` and `mode`. So a reload keeps the tool. Without a `pose`, the spawn rules of today apply.
    - The owner writes `pose`, `turn`, `snap` and `mode` when none of them changed for 0.3 s and they differ from the entry. The values are rounded the same way as `poseOf`.
    - `snap` is stored as `{ kind, id, side, across }`. At mount it is found in the models. A piece that is gone gives a free tool.
    - Not stored: Place, Throw, the Bend button and the selection. They are off after a reload.
    - Escape and key 0 delete the own entries.
    - No new `SCHEMA`: an old document has no tools, which is a valid state.
11. **The other player's tools.** `OtherTool` draws an entry that has a `pose`, in the other side's color, with its footprint. It has no buttons, no hover, no outline and no range mark. The pointer does not hit it, so a click goes to the piece below. Its footprint has no target, so it shows the plain footprint color. It is a kinematic sensor body, the same as an own tool. A table can now have 3 own tools, 3 other tools, the deploy tool and zone arcs, so `MAX_FOOTPRINTS` goes from 6 to 10.
12. **Red's tools spawn on Red's side.** A free spawn of a Red tool is the Blue spawn place turned 180° around the mat center, with yaw π. So Red's tools start in front of the Red camera, and their buttons read from Red's side. A spawn snapped to a piece keeps the rules of today.
13. **Two channels, both before the offer.**
    - The persistence channel (`sync`, the name of step 8) carries the Yjs document. The host saves the document on the server (step 8, decision 11).
    - It also carries Yjs awareness, with the claims. Claims are not saved. They still go on this channel, because a lost release would lock a piece, and the release must come after the rest pose or the drop. Only a reliable, ordered channel does both.
    - The live channel (`live`) carries what is not saved and can be lost: poses of moving pieces, the cursor, and dice in flight from step 10. The next packet replaces a lost one.
    - `peer.js` creates both in each attempt, both negotiated. The design adds the second channel after the connection. Creating both before the offer is the same code path as `sync` and needs no new rule. `onChannel(channel)` becomes `onChannels({ sync, live })`, called when `sync` opens.
14. **Live packets and the follow.**
    - JSON with rounded numbers: about 70 bytes per model pose, not the 170 of the design.
    - The channel is unordered. So each piece and the cursor keep the sequence number of their last pose, and an older pose is dropped.
    - A piece that the other player moves does `1 − e^(−dt / 0.05)` of the way to its latest pose on each frame. A model's rotation uses slerp. The design has a delay of 100 ms and interpolation. The follow needs no clock and hides lost packets and jumps. If the motion looks bad, the design's delay comes in a later change.
    - An other player's tool goes to its latest pose from the live channel or from the document, whichever came last. The document write comes after the last packet of a move.
15. **The cursor.** LiveSync sends the table or terrain point under the own pointer (`tablePoint`), at most every 100 ms, and only when it moved. It sends `null` when the pointer leaves the canvas. `RemoteCursor` shows a flat ring in the other player's side color at that point. It hides after `null`, and when the other player is gone.
16. **`?drop` and `?delay` on the receiving browser.** So the browser with the flag shows the effect. Dev builds only (`net/debugFlags.js`).
17. **Traffic.**
    - `net/traffic.js` reads `bytesSent` and `bytesReceived` of the selected candidate pair from a `getStats()` report. Chrome and Safari give the pair through the transport stats (`selectedCandidatePairId`). Firefox marks it with `selected`. It also says if the pair is relayed (a `relay` candidate on either end).
    - `peer.js` gets `traffic()`, for the open connection.
    - `Table.jsx` reads it every 60 s while connected. It logs one `console.info` line every 10 min, when a connection ends, and on **← Lobby**: sent, received, minutes, direct or relayed, for the connection and for all connections of the open table. The last two use the last read value, because a closing page cannot wait for `getStats()`.

## Phase 1: Models pass through models

Read: decision 1. `README.md` ("Known bugs", and the parts about dragging a model). `docs/feature-dice-rolling.md` ("Collisions"). `src/physics.js`, `components/CharacterModel.jsx`, `components/Scene.jsx` (models, `toolModels`), `components/SelectionOutlines.jsx`, `components/RulerTool.jsx` (`moveBase`, `handleThrow`, only to see where a model moves).

Work:
1. `physics.js`: `MODEL_GROUPS`. `CharacterModel.jsx`: the base collider gets it as `collisionGroups`.
2. `characters/overlap.js`: `overlapMarks(models)` returns the set of model ids with the mark. A model is `{ id, x, y, z, radius, moved }`. The rules of decision 1.
3. `Scene.jsx`: the `moved` number of each model, set at a drag start, a slide start, Place and Place 1. `CharacterModel` reports the drag and the slide. The entries of `toolModels` get `moved()`, which `moveBase` calls. Every 100 ms Scene reads the body positions, runs `overlapMarks`, and sets its state only when the set changed.
4. `CharacterModel.jsx`: an `overlap` prop. The outline mode `overlap` wins over the other modes. A red tint on the figure meshes while it is on.
5. `SelectionOutlines.jsx`: the `overlap` mode.
6. `characters/overlap.test.js`: no mark without an overlap. Touching bases have no mark. Of two overlapping models, only the one moved last has the mark. A lifted model (other height) has no mark. Three models in a row.
7. `README.md`: the known bug is fixed, with the date. The text about dragging a model says that it passes through models and shows the mark. `docs/feature-dice-rolling.md` ("Collisions"): models are in their own collision group.

Checks:
- `pnpm --filter web test`, `pnpm --filter web build` pass.
- `pnpm format`, `pnpm lint`: no new errors.

User, after this phase, in a single player room: checks 1 to 3.

### Result

- `physics.js`: `MODEL_GROUPS` = `interactionGroups([1], [0, 2..15])`. `CharacterModel.jsx`: the base collider uses it. Dominance, sensors and other colliders unchanged.
- `characters/overlap.js` and `overlap.test.js`: `overlapMarks`, 6 tests.
  - Overlap: more than 0.01" (`OVERLAP_MIN`). Height: bases less than 0.25" apart (`HEIGHT_TOLERANCE`, my pick; the 6" lift is far above it).
  - Equal `moved` (neither moved) gives no mark. So models that spawn overlapping show nothing.
  - A model gets the mark if it has the higher number in any overlapping pair.
- `Scene.jsx`: `moved` is a ref Map (id to a counter that only grows), set by `markMoved`. Called at drag start, slide start (`onSlideStart` of `CharacterModel`, set in `startSlide`) and by `toolModels[].moved()`. `RulerTool.jsx` `moveBase` calls `model.moved?.()`, so Place, Place 1 count. Throw / Push count through the slide start.
- `Scene.jsx`: every 100 ms (`OVERLAP_INTERVAL`) it reads the body positions, runs `overlapMarks`, and sets `overlapIds` only when the set changed.
- `CharacterModel.jsx`: `overlap` prop. Red tint = emissive `0xaa1111` on a copy of each mesh material. The copy is needed because GLB materials are shared between models of one file. The copy is disposed and the original put back when the mark goes.
- `SelectionOutlines.jsx`: mode `overlap` (same red as `outOfRange`, layer 14). `outlineMode` has a 4th argument `overlap`, which wins.
- `README.md`: new section "Overlapping models", known bug marked fixed (2026-10-10). `docs/feature-dice-rolling.md` "Collisions": models have their own group.
- Checks: `pnpm --filter web test` 119 pass. `pnpm --filter web build` ok. `pnpm format` ok. `pnpm lint`: 44 warnings, the same as before, none new.
- Not checked in a browser. Left for the user: that terrain and tokens still collide with models, and dice still do not move models (checks 1 to 3).

## Phase 1b: The mark during a drag, and no drop inside a model

The user asked for this on 2026-10-10, after Phase 1 (decision 1).

Why the mark did not show during a drag: a dragged base hovers `DRAG_HOVER` (0.3") above the table or terrain. `HEIGHT_TOLERANCE` was 0.25". So the dragged model was at "another height" until the drop.

Read: decision 1. `characters/overlap.js` (+ test), `components/CharacterModel.jsx` (the drag: `useFrame`, `onPointerDown`, `DRAG_HOVER`), `components/Scene.jsx` (`charBodies`, the overlap interval, the `CharacterModel` props).

Work:
1. `overlap.js`: `HEIGHT_TOLERANCE` 0.25 → 1. The comment says why: the dragged base hovers 0.3", and a lifted model is 6" up. A shared `overlaps(a, b)` (the distance and height rules, no `moved`). `overlapMarks` uses it. New `overlapsAny(model, others)`: true when `model` overlaps one of `others`.
2. `Scene.jsx`: each `CharacterModel` gets `overlapsAt(x, y, z)`. It builds the other models from `charBodies` (the same fields as the interval, without this model) and calls `overlapsAny`.
3. `CharacterModel.jsx`, during a drag:
   - At the drag start, the last free place is the body position.
   - On each drag frame, after the new position is known (with `constrainDrag`): when `overlapsAt` is false for it, it becomes the last free place.
   - A `dragOverlap` state, set only when the result changes. The model shows the mark while `overlap || dragOverlap`. So the mark shows in the frame the base enters the other model, not up to 100 ms later.
   - At the release: when `overlapsAt` is true for the body position, the body moves to the last free place (`setTranslation`) before it becomes dynamic. The rotation stays. `dragOverlap` goes off at the end of the drag.
4. `overlap.test.js`: `overlapsAny` with no other model, with a touching base, with an overlap, with a base 0.3" higher (counts), with a base 6" higher (does not count).
5. `README.md` ("Overlapping models"): the mark shows during the drag. A drop inside another model puts the model back at its last free place of the drag, or at its start. Place, Place 1, Throw or Push can still end inside a model, with the mark.

Checks:
- `pnpm --filter web test`, `pnpm --filter web build` pass.
- `pnpm format`, `pnpm lint`: no new errors.

User, after this phase, in a single player room: checks 1 to 3 (new text below).

### Result

- `overlap.js`: `HEIGHT_TOLERANCE` is 1. New `overlaps(a, b)` and `overlapsAny(model, others)`. `overlapMarks` uses `overlaps`.
- `Scene.jsx`: `modelBases(skip)` reads the body positions. The 100 ms interval and the new `overlapsAt(x, y, z)` prop of each model both use it.
- `CharacterModel.jsx`: `freePlace` ref, `dragOverlap` state.
  - At drag start, `freePlace` is the body position.
  - Each drag frame: if the new place overlaps nothing, it becomes `freePlace`. `dragOverlap` is set (React skips equal values).
  - Mark shows while `overlap || dragOverlap`: outline and tint.
  - At release: if the body overlaps, `setTranslation(freePlace)` before the body turns dynamic. Rotation stays. `dragOverlap` goes off.
- Only a drag returns. Place, Place 1, Throw and Push are as before.
- `overlap.test.js`: 3 new tests for `overlapsAny`. `README.md`: "Overlapping models" updated.
- Checks: `pnpm --filter web test` 122 pass. Build ok. Format ok. Lint: no new errors.
- Not checked in a browser. Left for the user: checks 1 to 3.

## Phase 2: One drag code

Read: decision 3. The drag code of `components/CharacterModel.jsx`, `components/RulerTool.jsx` (`useDragTool`), `components/CrisisToken.jsx` (`onPointerDown`, `onHandleDown`, `pointerPoint`), `components/TacticCard.jsx`, `components/ScoreBoard.jsx`, `components/TokenDragPreview.jsx`, and the token drag of `App.jsx` (`handleTokenDragStart` and the window listeners after it, `cancelTokenDrag`).

Work:
1. `drag/pointerDrag.js`: `startPointerDrag(event, options)` and `DRAG_THRESHOLD`. The window, the canvas and the controls come in as options, so a test can pass fakes.
2. `drag/tablePoint.js`: `tablePoint`.
3. Use both in the six places and in `TokenDragPreview.jsx`. Remove the copies of `DRAG_THRESHOLD` and of the screen-to-table point.
4. No change of behavior. Where one copy does something that the others do not (for example a drag that needs a selected piece, or a press that is a drag at once), keep it as an option. List these options in the **Result**.
5. `drag/pointerDrag.test.js`, with `EventTarget` fakes: a move below the threshold and a release is a click. A move past the threshold starts the drag once. Another pointer id and another button are ignored. The controls are off during the press and on after it. `cancel()` ends the drag with no drop. The listeners are removed after the release and after `cancel()`.

Checks:
- `pnpm --filter web test`, `pnpm --filter web build` pass.
- `pnpm format`, `pnpm lint`: no new errors.
- `grep -rn "DRAG_THRESHOLD =" apps/web/src` finds one line.
- `grep -rln "addEventListener('pointermove'" apps/web/src` finds only `drag/pointerDrag.js`, and the files that the **Result** names with the reason.

User, after this phase: check 4.

### Result

## Phase 3: Tools in the document

Read: decisions 10 to 12. `App.jsx` (tool state, `handleRangeClick`, `handleMoveClick`, `handleAngleClick`, `handleAngleKey`, `handleToolKey`, `handleEscape`, `clearTools`, the Scene and Toolbar props). `components/Scene.jsx` (the tools, `PLAYER_TEAM`, `turnProps`). `components/RulerTool.jsx` (`Tool`, its spawn effect, `snapTo`, `turnAroundCenter`, `handleMirror`, `ToolFootprint`). `components/Toolbar.jsx` (the tool buttons). `components/footprintProjection.js`. `net/doc.js`, `net/collections.js`, `net/useY.js`, `rooms/table.js`.

Work:
1. `net/doc.js`: `tools`, a record of depth 1. `fillTable` writes `state.tools ?? {}`. `rooms/table.js`: `startTable` has `tools: {}`.
2. `components/storedTool.js`: the rounded stored fields of a tool, their equality, and the free spawn place and yaw of a tool kind for a side (decision 12).
3. `App.jsx`: `useYRecord(table.tools)`. The own side's entries give the toolbar state and the Scene props. The handlers write the own entries. A respawn writes a new `spawn`. Escape and key 0 delete the own entries. `toolSpawns`, `activeRange`, `activeMove` and `angleOn` go away.
4. `Scene.jsx`: the own tools from the own entries, keyed by `which` and `spawn`, in the own side's color, with the entry and a write function. `OtherTool` for each entry of the other side that has a `pose`. `PLAYER_TEAM` stays only for the dice (step 10), with a comment.
5. `RulerTool.jsx`: `Tool` starts from a stored entry (decision 10) and writes on rest. `OtherTool` (decision 11).
6. `footprintProjection.js`: `MAX_FOOTPRINTS` 10.
7. Tests: `net/doc.test.js` (a new table has `tools`, an entry of one side does not change the other side). `components/storedTool.test.js` (rounding, equality, Red spawn is the Blue one turned).

Checks:
- `pnpm --filter web test`, `pnpm --filter web build` pass.
- `pnpm format`, `pnpm lint`: no new errors.

User, after this phase: checks 5 to 7.

### Result

## Phase 4: Claims and one writer

Read: decisions 4 to 9. The y-protocols sources: `awareness.js`. `net/syncChannel.js` (+ test), `Table.jsx`, `App.jsx` (the Scene props, `startPose`, `onModelRest`, the token drag), `drag/pointerDrag.js`, `components/Scene.jsx` (`restPose`, `onRest`, `turnPiece`, `applyTurn`, `liftPiece`, `toolModels`, the tray move effect), `components/CharacterModel.jsx`, `components/RulerTool.jsx` (`moveBase`, `handleThrow`, `handlePlaceOne`), and the drags of `CrisisToken.jsx`, `TacticCard.jsx`, `ScoreBoard.jsx`.

Work:
1. `net/syncChannel.js`: `syncOverChannel(doc, channel, awareness)`. When the channel opens, it sends the own awareness state. It sends each awareness change whose origin is not the channel, as type 1. It applies type 1 with the channel as origin. `stop()` removes the awareness states that came from the channel. Without `awareness`, it works as today.
2. `net/ownership.js`: `createOwnership({ awareness, role })`, and the same API without awareness for a single player room and the Sandbox (always the writer, never an other owner). The API of "Names". The tie of decision 7.
3. `Table.jsx`: a multiplayer room makes an `Awareness` for the document, with the state `{ owns: [] }`. `syncOverChannel` gets it. `close()` destroys it. The ownership goes to App.
4. `App.jsx`: `useYRecord(table.poses)` goes to Scene, with the ownership. The token drag of a loose token or a pile claims it, and releases it after the drop or the cancel.
5. Drags (decision 5): the drag code gets the piece key and the ownership. It claims when the drag starts, and gives up the drag when the claim is refused. A drag of a piece without a body releases after its drop or its cancel. `onLost` cancels the drag of that key.
6. `Scene.jsx`:
   - `claim` before R, Q / E, a slide, Place and Place 1 of a model (decision 5).
   - The model claim check on every frame (decision 5).
   - `onRest` writes only when `writes(key)` (decision 6).
   - The rest poses from the other browser (decision 8).
   - `otherOwned()` gives each piece its `remote` state (decision 9). A claim of the other player sets the `moved` number of Phase 1.
7. `CharacterModel.jsx`: the remote mode (decision 9). A drag, a lift and a slide ask for the claim first and do nothing when it is refused. A pointer up during the remote mode does nothing to the body.
8. Tests:
   - `syncChannel.test.js`: awareness states cross two linked fake channels, both ways. A state that came from the channel is removed by `stop()`. A state applied from the channel is not sent back.
   - `ownership.test.js`, with two awareness objects linked like the channel: claim, release, a refused claim, the tie and `onLost`, `writes` for host and guest, with and without the other player, the local version.
   - `pointerDrag.test.js`: a refused claim starts no drag. A drop releases after the drop callback. A cancel releases with no drop.

Checks:
- `pnpm --filter web test`, `pnpm --filter web build` pass.
- `pnpm format`, `pnpm lint`: no new errors.

User, after this phase: checks 8 to 14.

### Result

## Phase 5: The live channel: models, tools and the cursor

Read: decisions 9 and 13 to 16. `net/peer.js` (+ test), `Table.jsx`, `components/Scene.jsx`, `components/CharacterModel.jsx` (the remote mode), `components/RulerTool.jsx` (`OtherTool`, `Tool`), `drag/tablePoint.js`, `net/debugFlags.js`. MDN for unordered data channels.

Work:
1. `net/peer.js`: the `live` channel, and `onChannels({ sync, live })` (decision 13). `peer.test.js` follows.
2. `net/live.js`: `createLiveHub({ timers, random, drop, delay })`: `attach(channel)`, `detach(channel)`, `send(packet)`, `subscribe(fn)`. It sets `s`, rounds the numbers, sends JSON only on an open channel, and ignores a bad packet. On the receiving side it applies `drop` and `delay`. A pure `newer(seqs, key, s)` keeps the last sequence number per key.
3. `net/debugFlags.js`: `dropFlag()` and `delayFlag()`.
4. `Table.jsx`: one hub per table. `onChannels` attaches `live`, and its close detaches it. The hub goes to App and Scene.
5. `Scene.jsx`: `LiveSync`. It sends the own claimed models that moved, the own tools that moved or bent, and the cursor (decision 15). It keeps the latest received pose per piece key and of the cursor. `CharacterModel` in the remote mode and `OtherTool` follow them (decision 14). `components/RemoteCursor.jsx`.
6. Tests: `live.test.js` (sequence per key, rounding, no send on a closed channel, a bad packet, `drop`, `delay` with `mock.timers`, attach and detach). `peer.test.js`: both channels in each attempt, `onChannels` once per open.

Checks:
- `pnpm --filter web test`, `pnpm --filter web build` pass.
- `pnpm format`, `pnpm lint`: no new errors.

User, after this phase: checks 15 to 20.

### Result

## Phase 6: Live drags of tokens, cards and markers

Read: decisions 2, 3, 9 and 14. `drag/pointerDrag.js`, `components/Scene.jsx` (`LiveSync`), `components/CrisisToken.jsx`, `components/TacticCard.jsx`, `components/ScoreBoard.jsx`, `components/LooseToken.jsx`, `components/TokenPile.jsx`, `components/TokenDragPreview.jsx`, and the token drag of `App.jsx`.

Work:
1. A dragged piece without a body gives its live pose to `LiveSync` through one function, in the form of the live packet ("Names"). The crisis token also gives its yaw during a turn with its handle. A loose token and a pile give the point of `TokenDragPreview`.
2. `LiveSync` sends these poses with the others.
3. `CrisisToken.jsx`, `TacticCard.jsx`, the markers of `ScoreBoard.jsx`, `LooseToken.jsx` and `TokenPile.jsx`: while the other player claims the piece, it follows the live pose (decision 14). When the claim ends, it shows its place in the document.
4. Tests: the pure part that turns a dragged pose into packet numbers and back, for each kind.

Checks:
- `pnpm --filter web test`, `pnpm --filter web build` pass.
- `pnpm format`, `pnpm lint`: no new errors.

User, after this phase: checks 21 and 22.

### Result

## Phase 7: Traffic and docs

Read: decision 17. `net/peer.js`, `Table.jsx`. MDN for `RTCStatsReport`, `RTCTransportStats`, `RTCIceCandidatePairStats`.

Work:
1. `net/traffic.js`: `trafficOf(report)` returns `{ sent, received, relayed }` or `null`.
2. `net/peer.js`: `traffic()`.
3. `Table.jsx`: the reads and the log lines of decision 17.
4. `traffic.test.js`: a report in the form of Chrome and Safari, one in the form of Firefox, one with a relayed pair, one with no selected pair.
5. `docs/feature-peer-to-peer.md`:
   - Status line.
   - "Data channels": the persistence channel and the live channel (decision 13), both before the offer.
   - "State" and "Yjs document": the tools, with the layout of "Names". Category 4 has every piece that a player drags.
   - "Moving objects (physics)": decisions 1 and 4 to 9, and 14. Rule 6 goes away, with one sentence about why.
   - "Pose message", "Cursor message": the live packet of "Names".
   - "Debug flags": `?drop` and `?delay` are built.
   - "Code layout", "Phases" (3).
6. `README.md`: the tools are saved with the room. The other player's tools, live moves and cursor. `?drop` and `?delay`. The traffic lines in the console.
7. `docs/feature-rooms.md` ("Storage"): the tools are in the document.
8. `docs/plans/implement-backend.md`: a short **Result** under step 9. Step 10: dice are player bodies on the live channel, and `PLAYER_TEAM` in `Scene.jsx` becomes the own side.

Checks:
- `pnpm test` at the root passes.
- `pnpm format`, `pnpm lint`: no new errors.

User, after this phase: check 23.

### Result

## User

After Phase 1b, in a single player room:
1. Select a model and drag it through another model. It passes through. It turns red, with a red outline, as soon as its base enters the other base. The red goes away when it leaves.
2. Drag a model into another model and drop it there. It goes back to the last place of the drag where it overlapped nothing, and drops there. The other model does not move. Use Place to put a model inside another one: it stays there, red.
3. A dragged model still goes over terrain, not through it. Throw or Push still stops at a base. A die that hits a model does not move the model.

After Phase 2, in a single player room:
4. Every drag works as before: a model, with the deploy line on and off. A tool: a move, a turn around a base, a bend, a snap to a model. A crisis token, and its turn handle. A token dropped on a character. A tactic card into a tray slot. A score marker onto a spot. A token from a Give source, from a supply pile and from the Library. A pile: a take, and a move with Shift. Escape during a token drag. A click still selects a piece or opens a card.

After Phase 3, with `pnpm --filter api turn:up` and `pnpm dev`. Checks 6 and 7 in one browser pair. Alice is on Blue, Bob on Red.
5. Single player room: put out range 3, the long movement tool bent, and the Toward / Away tool snapped to a model. **← Lobby**, then open the room. The tools are where they were, with the bend. A drag on the snapped tool still turns it around the base.
6. Alice and Bob each put out a range tool and a movement tool. Each player sees their own tools in their own color, and the other player's tools in the other color. The other player's tool shows at its new place when it stops (no live move yet). Bob cannot select, drag or turn Alice's tools: a click goes to the piece below. Bob's free tools spawn on his side, and their buttons read from his side.
7. Escape and key 0 remove only the own tools, also on the other screen.

After Phase 4, in one browser pair:
8. Alice drags a model. On Bob's screen it stays still during the drag (no live move yet), then shows at its rest place. It does not move back later.
9. While Alice drags a model, Bob cannot drag it, turn it with Q / E or lift it with R.
10. While Alice drags a crisis token, Bob cannot drag it. After the drop, it shows at its new place on both screens.
11. Alice turns a model with Q / E, uses Throw or Push, Place and Place 1. Each model rests at the same place on both screens.
12. Bob adds a character. The trays move on both screens, and the models on the trays stand at the same places on both screens.
13. Unlock a terrain piece with a model on it, and delete it. The model falls on both screens, to the same place.
14. Alice lifts a model with R and closes her tab. Within a few seconds, Bob can drag that model.

After Phase 5. Checks 15 to 18 in each pair. Checks 19 and 20 once, in one pair:
15. Alice drags a model, turns it with Q / E, lifts it with R, and uses Throw or Push. Bob sees each move live, and the model rests at the same place on both screens. Then the same from Bob to Alice.
16. Alice drags a tool, bends the movement tool, and turns a snapped tool around a base. Bob sees each move live.
17. Bob sees Alice's cursor as a blue ring on the table. It goes away when her pointer leaves the table.
18. The room table goes to the server as in step 8: the host writes, and the guest writes only on **← Lobby** or a hidden tab.
19. Bob opens the room with `?drop=30&delay=150`. Alice's drags look rougher, and still end at the same place on both screens.
20. Alice and Bob try to drag the same model at the same moment. One of them moves it. On both screens, the model ends at the same place.

After Phase 6, in each pair:
21. Alice drags a crisis token and turns it with its handle, drags a tactic card, a score marker, a character token on the table, and a pile with Shift. Bob sees each move live, and each piece ends at the same place on both screens.
22. Alice starts to drag a character token on the table and presses Escape. On Bob's screen the token goes back to its place.

After Phase 7:
23. Play a short game in one pair, with drags of models and tools for a few minutes. Open the console of each browser: the traffic lines show the bytes. Put the numbers in the **Result** of Phase 7.

### User check results

- 2026-10-10: checks 1 to 3 pass (after Phase 1b).

## Done when

- `pnpm test`, `pnpm typecheck`, `pnpm --filter web build` pass. `pnpm lint` has no new errors.
- The user checks pass, in the three browser pairs where the check says so.
- The **Result** of each phase is filled in. The **Result** of Phase 7 has the bytes of a local game.

## Risks and open questions

1. **Phase 2 changes every drag.** A small difference between the copies can change how one drag feels. Check 4 lists every drag, and the **Result** of Phase 2 lists the options that keep the differences.
2. **The follow** (decision 14). If the motion of a moving piece looks bad on the other screen, add the design's delay of about 100 ms and interpolate between poses.
3. **The overlap of a model that tipped over.** `overlapMarks` uses the base circle around the body position. A model that lies on its side can show a wrong mark.
4. **Small differences in the second kind of move** (decision 6). When the host's result equals the stored pose, the host writes nothing, and the guest keeps its own result, which can differ by a fraction of an inch. The next open of the room fixes it.
5. **Hidden tabs.** A browser does not draw frames in a hidden tab, so its physics and its claim checks stop. A player who drops a model and at once hides the tab keeps the claim until the tab shows again. A hidden host writes the second kind of move only when its tab shows again.
6. **Awareness timeout.** A browser that stops without closing the channel (a sleeping laptop) keeps its claims on the other screen for up to 30 s. Step 11 handles a dropped network.
7. **A snapped spawn for Red** (decision 12). A tool that spawns snapped to a piece keeps the yaw rules of today. Its buttons can read upside down from Red's side.
