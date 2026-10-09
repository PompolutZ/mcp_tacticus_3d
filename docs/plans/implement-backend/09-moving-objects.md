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
| Tool entry | `{ which, spawn, at?, pose?, turn?, snap?, mode? }`. `which`: the range number (1 to 5), the movement type (`short`, `medium`, `long`), or `true` for `angle`. `spawn`: a random id, new at each spawn. `at`: `{ x, z }`, the point of a free spawn (decision 19). `pose`: `{ x, y, z, yaw }`. `turn`: `{ right, left }`, the bend. `snap`: `{ kind, id, side, across }` or `null`. `mode`: `away` or `toward` |
| Own tool side | The own seat in a multiplayer room. `blue` in a single player room and the Sandbox |
| Awareness state | `{ owns: [piece key, …] }` |
| Live packet | JSON: `{ s, p?, c? }`. `s`: a sequence number. `p`: piece key → numbers. A model: `[x, y, z, qx, qy, qz, qw]`. A tool: `[x, y, z, yaw, right, left]`. A crisis token: `[x, z, yaw]`. A loose token, a pile, a tactic card, a marker: `[x, z]`. `c`: `[x, y, z]`, or `null` when the pointer left the table. Only the parts that changed |
| Packet rounding | Positions to 3 decimals (0.001"). Rotations, yaw and bend to 4 decimals |
| Times | A packet every 33 ms at most (about 30 per second). The cursor every 100 ms at most. Follow time 0.05 s. Tool rest 0.3 s. A model claim lasts at least 0.2 s. Traffic read every 60 s, logged every 10 min |
| Footprint slots | `MAX_FOOTPRINTS` 6 → 7 (Phase 2b) → 12 (Phase 3) |
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
  components/footprintProjection.js  MAX_FOOTPRINTS 12, setCircle, the footprint colors
  components/DragFootprint.jsx  the footprint of a dragged piece (decision 18)
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
    - A spawn (a key, a toolbar button) writes an entry with a new `spawn` and no `pose`. A free spawn also writes `at` (decision 19). The tool key has `which` and `spawn`, so the tool mounts again in both browsers.
    - At mount, a tool with a `pose` starts there, with its `turn`, `snap` and `mode`. So a reload keeps the tool. Without a `pose`, the spawn rules of decision 19 apply, with `at` for a free spawn.
    - The owner writes `pose`, `turn`, `snap` and `mode` when none of them changed for 0.3 s and they differ from the entry. The values are rounded the same way as `poseOf`.
    - `snap` is stored as `{ kind, id, side, across }`. At mount it is found in the models. A piece that is gone gives a free tool.
    - Not stored: Place, Throw, the Bend button and the selection. They are off after a reload.
    - Escape and key 0 delete the own entries.
    - No new `SCHEMA`: an old document has no tools, which is a valid state.
11. **The other player's tools.** `OtherTool` draws an entry that has a `pose`, in the other side's color, with its footprint. It has no buttons, no hover, no outline and no range mark. The pointer does not hit it, so a click goes to the piece below. Its footprint has no target, so it shows the plain footprint color. It is a kinematic sensor body, the same as an own tool. A table can now have 3 own tools, 3 other tools, the deploy tool, zone arcs, the own drag and the other player's drag (decision 18), so `MAX_FOOTPRINTS` goes from 7 to 12.
12. **Red's tools face Red.** A free spawn (decision 19) of a Red tool has the Blue yaw + π. So the buttons of Red's tools read from Red's side. A spawn snapped to a piece keeps the rules of today.
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
18. **Drag footprints.** The user asked for this on 2026-10-10, after Phase 2. A dragged piece hangs above the table: a model 0.3" (`DRAG_HOVER`), a token or a tactic card 1" (`TOKEN_DRAG_LIFT`). Without a mark on the table, the player cannot see where it will land.
    - During a drag, the piece shows a footprint on the table or terrain under it. It goes away at the drop or the cancel.
    - Pieces: a model (its base circle), a crisis token, every token drag of `TokenDragPreview` (a character token on the table, a pile with Shift, a token from a Give source, a supply pile, a pile or the Library), and a tactic card (its rectangle). A score marker does not lift during a drag, so it gets none.
    - The look is the footprint of a selected tool: `FOOTPRINT_COLOR` fill at 0.35, white line. A dragged model that overlaps another model (`dragOverlap`, Phase 1b) shows the red of `FOOTPRINT_APART`. So the player sees that a drop there goes back.
    - A circle is the rect shape of `footprintProjection.js` with half length 0: only its round hinge, with the radius as the half width. A card is the rect shape with half length = half the card length. So the shader does not change.
    - A drag takes one footprint slot. From Phase 5, a piece that the other player drags shows the same footprint, so it takes one more slot.

19. **Tools spawn at the pointer.** The user asked for this on 2026-10-10. Today a free tool spawns at a fixed place: a range tool at z 6, a movement tool at z −6, the Toward / Away tool at the mat center.
    - A tool key (1 to 5, the movement keys, 6) with the pointer over a character or a token: as today. The piece is selected, and the tool spawns snapped to it.
    - A tool key with the pointer over the table or terrain, not over a piece: the tool spawns free, with its center at the table or terrain point under the pointer. When the tool is already out, it spawns again there. A selected piece does not change this: the tool does not snap to it. So a key over the table no longer removes the tool. Escape, key 0 and the toolbar button remove it.
    - A toolbar button, and a tool key with the pointer off the table: as today, they turn the tool on or off. A new tool snaps to the selected piece. Without a selected piece, it spawns free at the table point in the middle of the screen, not at the fixed place.
    - The yaw of a free tool is the yaw of today. Phase 3 turns it by π for Red (decision 12).
    - From Phase 3, a free spawn stores its point in the entry (`at`), so the other browser and a reload get it.

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

Done.

- New: `drag/pointerDrag.js` (`startPointerDrag`, `DRAG_THRESHOLD`), `drag/tablePoint.js` (`tablePoint`), `drag/pointerDrag.test.js` (12 cases).
- `startPointerDrag(event, options)` returns `{ cancel }`, or `null` when nothing started. It calls `stopPropagation`, turns the controls off, releases the pointer capture, and listens on the window for this pointer id. At the end it turns the controls on and removes the listeners.
- Callbacks: `onStart`, `onMove`, `onEnd` (drop), `onClick`, `onCancel`. `onMove` may return true: the drag ends there (`onEnd` runs at once, the release does nothing more). Used by the tools.
- `tablePoint(scene, x, y, { offTable })`. `scene` is `{ camera, canvas, world, rapier }`.
- Options, and why each exists:
  - `canStart(ev)`: a drag needs a selected piece (model, tool, crisis token that can move). Called at each move past the threshold.
  - `immediate`: the press is a drag at once, no threshold, no click (score marker, turn handle). `canStart` runs at the press then.
  - `button: null`: any button. Only the token drag from the Library chips, which never checked the button.
  - `releaseCapture: false`: only the turn handle, which never released the capture.
  - `preventDefault: true`: token drag (DOM events from the HUD).
  - `threshold`: default 4 px. No caller changes it yet.
  - `controls`, `canvas`, `window`: come in so a test can pass fakes. `window` defaults to the real one.
  - `tablePoint` `offTable: 'null'`: `TacticCard` and `TokenDragPreview` get `null` off the table. Default: fall back to the table plane.
- Kept in the pieces:
  - `CharacterModel`: lift, slide, `freePlace`, `dragOverlap`, `overlapsAt` at the drop. The frame loop keeps the pointer in pixels and calls `tablePoint` each frame.
  - `useDragTool`: the grab plane and offset, `plan`, turn math. It keeps its own ray from the pointer, because it needs a ray and a plane, not a table point.
  - Token drag in `App.jsx`: Escape (`cancelTokenDrag` now calls `cancel()`), Shift for a pile move, the release rules.
- `addEventListener('pointermove'` is still in `TokenDragPreview.jsx`: it follows the pointer to show the preview. It is no drag gesture (no press, no id, no click).
- Possible differences:
  - Turn handle: when the first point is off the table, it used to leave the controls off. Now the controls stay on and nothing starts.
  - Token drag: the window listeners start at the press, not after the next React render. They now ignore other pointer ids (before, any pointer).
  - The grab setup of a tool now runs after the press starts, so a right click no longer changes the grab plane.
  - If a drop callback throws, the listeners are removed and the controls turn on anyway (before: they stayed).
  - Model drag: the table point is read from the last pointer pixels each frame (before: the NDC stored at the move). Same value unless the canvas moves during a drag.


## Phase 2b: Drag footprints

Read: decision 18. `components/footprintProjection.js`, `components/RulerTool.jsx` (`ToolFootprint`, the footprint colors), `components/CharacterModel.jsx` (the drag, `dragOverlap`), `components/CrisisToken.jsx` (the drag, the Zone Arc slot), `components/TokenDragPreview.jsx`, `components/TacticCard.jsx` (the drag), `components/Scene.jsx` (where `TokenDragPreview` is drawn).

Work:
1. `footprintProjection.js`: `MAX_FOOTPRINTS` 6 → 7. A slot gets `setCircle(x, z, radius, fill, opacity, line)`: the rect shape with half length 0. The shader does not change.
2. The footprint colors move from `RulerTool.jsx` to `footprintProjection.js` as exports, so every piece uses the same values.
3. `components/DragFootprint.jsx`: a component that takes a slot on mount and gives it back on unmount. Each frame it reads the shape from a function prop (`{ x, z, radius }` for a circle, or `{ x, z, yaw, halfLength, halfWidth }` for a card) and an `apart` flag, and writes the slot. A null shape hides it (the pointer is off the table).
4. The pieces mount it only during their drag:
   - `CharacterModel.jsx`: the body XZ and the base radius. `apart` while `dragOverlap`.
   - `CrisisToken.jsx`: the drag pose and the token radius. Not during a turn with the handle, because the token does not lift then.
   - `TokenDragPreview.jsx`: the preview point and the token radius. Hidden when the point is null.
   - `TacticCard.jsx`: the drag pose, the card size and its yaw.
5. No test: the parts are three.js and frame code. The shape math is the rect shape that the tools already use.

Checks:
- `pnpm --filter web test`, `pnpm --filter web build` pass.
- `pnpm format`, `pnpm lint`: no new errors.

User, after this phase, in a single player room: check 4b.

### Result

Done.

- `footprintProjection.js`: `MAX_FOOTPRINTS` is 7. New `setCircle(x, z, radius, fill, opacity, line)`. New `hide()` on a slot: it clears the fill and keeps the slot. The shader did not change.
- `FOOTPRINT_COLOR`, `FOOTPRINT_TOUCH` and `FOOTPRINT_APART` are exports of `footprintProjection.js`. `RulerTool.jsx` imports them.
- New `components/DragFootprint.jsx`. It takes a slot on mount and gives it back on unmount. Props: `getShape` and `getApart`, both functions that run each frame. A null shape hides the slot. Look: `FOOTPRINT_COLOR` fill at 0.35, white line, `FOOTPRINT_APART` fill when `getApart` is true.
- `CharacterModel.jsx`: a `dragging` state, set in `onStart` and `onEnd`. The shape is the body XZ and `baseRadius`. `apart` is `dragOverlap`.
- `CrisisToken.jsx`: a `dragging` state, set in the token drag only. The turn with the handle does not set it. The shape is `poseRef` and the token radius.
- `TokenDragPreview.jsx`: it mounts with the drag, so the footprint lives as long as the preview. The shape is `pointRef` and `TOKEN_RADIUS` (imported from `CrisisToken.jsx`). Null when the point is null.
- `TacticCard.jsx`: a `dragging` state, and `overTableRef` (was a local `overTable`). The footprint hides while the pointer is off the table.
- Score markers got none.

Choices that the plan did not fix:
- A card shape is `{ x, z, angle, halfLength, halfWidth }`, not `yaw`. `angle` is the direction of the long side, as in `RulerTool`. The rect shape has a round hinge of radius `halfWidth` at the center. The card is 2.5 wide and 3.5 long, so the long side (local z) is the length, `halfLength` 1.75 and `halfWidth` 1.25. With the short side as the length, the hinge would stick out of the card. The angle is `tacticCardYaw(team) - π/2`.
- The footprint uses the card yaw of its team, so it is turned for a red card.
- `hide()` is new, so a slot stays taken while the pointer is off the table.
- The shape is the token radius, 0.5, for every token drag of `TokenDragPreview`, also a pile or a supply pile.

Differences in behavior:
- A drag takes one slot. Seven slots can run out when many tools, arcs and a drag are on at once. Then `acquireFootprint` returns null and the drag has no footprint. Phase 3 raises the number to 12.

Checks:
- `pnpm --filter web test`: 134 pass, 0 fail.
- `pnpm --filter web build`: passes.
- `pnpm format` done. `pnpm lint`: 37 warnings, 0 errors, none new in the changed files.
- No new test, as the plan says.


## Phase 2c: Tools spawn at the pointer

Read: decision 19. `App.jsx` (`handleRangeClick`, `handleMoveClick`, `handleAngleClick`, `handleAngleKey`, `handleToolKey`, `toolSpawns`, `angleSpawn`, `hoveredRef`, `characterAtRef`). `components/Scene.jsx` (the tools, `toolTarget`, `toolModel`, `characterAtRef`). `components/RulerTool.jsx` (`Tool`: `position`, `spawnTarget`, the spawn effect). `drag/tablePoint.js`. `README.md` ("Tools").

Work:
1. `Scene.jsx`: a ref for App, the same pattern as `characterAtRef`. It returns the table or terrain point under the last pointer position over the canvas, or `null` when the pointer is not over the canvas or not over the table (`tablePoint` with `null` off the table). A second function gives the table point in the middle of the canvas.
2. `App.jsx`, `handleToolKey` and `handleAngleKey`:
   - A piece under the pointer: as today.
   - Else a point under the pointer: the tool spawns free at that point. It turns the tool on, and a new spawn mounts it again when it is already out.
   - Else: as today (the toolbar rule).
3. `App.jsx`: the spawn state gets the free point of each tool kind: `{ x, z }` or `null`. A spawn at the pointer sets it. A toolbar spawn sets it to the middle of the screen. The fixed places in `Scene.jsx` (z 6, z −6, the center) go away.
4. `RulerTool.jsx`, `Tool`: a `spawnAt` prop, `{ x, z }` or `null`. With `spawnAt`, the tool does not snap at spawn, and its center starts at that point, `hoverHeight` above the ground under its footprint. The yaw stays as today. Without `spawnAt`, the rules of today (snap to `spawnTarget`).
5. `README.md` ("Tools"): the spawn rules of decision 19.

Checks:
- `pnpm --filter web test`, `pnpm --filter web build` pass.
- `pnpm format`, `pnpm lint`: no new errors.

User, after this phase, in a single player room: check 4c.

### Result

Done.

- New `components/ToolPoint.jsx`. It sits inside `Physics`, because `tablePoint` needs the Rapier world. It fills `toolPointRef` with `{ atPointer(), atCenter() }`. Scene passes the ref up, as it does for `characterAtRef`.
- `atPointer()` reads the last pointer position of R3F. It gives `{ x, z }`, or `null` when the pointer is not over the canvas (`:hover`, as in `terrainAt`) or not over the table (`offTable: 'null'`).
- `atCenter()` is the table point in the middle of the canvas. If the middle sees no collider, it uses the table plane.
- `App.jsx`: new state `toolAt` (`{ range, move, angle }`, each `{ x, z }` or `null`). `handleToolKey` and `handleAngleKey`: piece under the pointer sets `null` and works as before. A point under the pointer sets it, turns the tool on and bumps `toolSpawns`, so an out tool mounts again. Else the toolbar rule.
- The toolbar buttons set `toolAt` when they turn a tool on. A selected piece gives `null`. No selected piece gives the middle of the screen, or `{ x: 0, z: 0 }` if that is unknown.
- `Scene.jsx`: `toolAt` and `toolPointRef` props. The fixed `position` of the three tools (z 6, z -6, center) is gone. Each tool gets `spawnAt`.
- `RulerTool.jsx`, `Tool`: new `spawnAt` prop. With it, the spawn effect does not snap. It puts the center at the point, `hoverHeight` above `groundY` of the footprint. The yaw stays 0. The `RigidBody` starts at that point, so there is no frame at the old place. Without it, the old rules.
- `README.md` ("Tools"): the spawn rules.

Choices that the plan did not fix:
- "Selected piece" for the toolbar rule is the same as the tool target: the piece selected last that a tool can measure against (`findLast(isToolPiece)`). For the Toward / Away tool it is the selected character, as before.
- The key over the table does not change the selection. The angle tool then has no aim piece and no snap target.
- The toolbar sets the point only when it turns the tool on, or switches range or movement type. Turning off sets nothing.

Differences in behavior:
- A tool key over the table used to remove an out tool (a toggle). Now it spawns the tool again at the pointer. This is decision 19.
- A tool from the toolbar with no selected piece now spawns in the middle of the screen, not at the fixed place.
- If a snap target has no center at spawn, the tool stays at the origin at ground height (it used to hang at the fixed place).

Checks:
- `pnpm --filter web test`: 134 pass, 0 fail.
- `pnpm --filter web build`: passes.
- `pnpm format` done. `pnpm lint`: 37 warnings, 0 errors, none new.
- No new test: the parts are three.js and React code.

## Phase 3: Tools in the document

Read: decisions 10 to 12. `App.jsx` (tool state, `handleRangeClick`, `handleMoveClick`, `handleAngleClick`, `handleAngleKey`, `handleToolKey`, `handleEscape`, `clearTools`, the Scene and Toolbar props). `components/Scene.jsx` (the tools, `PLAYER_TEAM`, `turnProps`). `components/RulerTool.jsx` (`Tool`, its spawn effect, `snapTo`, `turnAroundCenter`, `handleMirror`, `ToolFootprint`). `components/Toolbar.jsx` (the tool buttons). `components/footprintProjection.js`. `net/doc.js`, `net/collections.js`, `net/useY.js`, `rooms/table.js`.

Work:
1. `net/doc.js`: `tools`, a record of depth 1. `fillTable` writes `state.tools ?? {}`. `rooms/table.js`: `startTable` has `tools: {}`.
2. `components/storedTool.js`: the rounded stored fields of a tool, their equality, and the free spawn yaw of a tool kind for a side (decision 12).
3. `App.jsx`: `useYRecord(table.tools)`. The own side's entries give the toolbar state and the Scene props. The handlers write the own entries. A respawn writes a new `spawn`. A free spawn writes `at` (decision 19). Escape and key 0 delete the own entries. `toolSpawns`, `activeRange`, `activeMove` and `angleOn` go away.
4. `Scene.jsx`: the own tools from the own entries, keyed by `which` and `spawn`, in the own side's color, with the entry and a write function. `OtherTool` for each entry of the other side that has a `pose`. `PLAYER_TEAM` stays only for the dice (step 10), with a comment.
5. `RulerTool.jsx`: `Tool` starts from a stored entry (decision 10) and writes on rest. `OtherTool` (decision 11).
6. `footprintProjection.js`: `MAX_FOOTPRINTS` 12.
7. Tests: `net/doc.test.js` (a new table has `tools`, an entry of one side does not change the other side). `components/storedTool.test.js` (rounding, equality, the Red yaw is the Blue yaw + π).

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
5. `Scene.jsx`: `LiveSync`. It sends the own claimed models that moved, the own tools that moved or bent, and the cursor (decision 15). It keeps the latest received pose per piece key and of the cursor. `CharacterModel` in the remote mode and `OtherTool` follow them (decision 14). A model that follows live poses shows its drag footprint (decision 18). `components/RemoteCursor.jsx`.
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
3. `CrisisToken.jsx`, `TacticCard.jsx`, the markers of `ScoreBoard.jsx`, `LooseToken.jsx` and `TokenPile.jsx`: while the other player claims the piece, it follows the live pose (decision 14) and shows its drag footprint (decision 18). When the claim ends, it shows its place in the document.
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

After Phase 2b, in a single player room:
- 4b. Drag a model, a crisis token, a character token on the table, a pile with Shift, a token from a Give source, from a supply pile and from the Library, and a tactic card. Each shows a footprint on the table or terrain under it during the drag. The footprint goes away at the drop, and after Escape. Over a terrain roof, the footprint is on the roof. A model dragged into another model has a red footprint. A turn with the handle of a crisis token shows no footprint.

After Phase 2c, in a single player room:
- 4c. Pointer over an empty spot of the table, press 3: range 3 appears with its center under the pointer. Move the pointer, press 3 again: it appears there. Over a terrain roof, it hangs above the roof. The same with a movement key and with key 6.
- 4d. Pointer over a model, press 3: the model is selected and the tool snaps to it, as before. The same over a token.
- 4e. Select a model, put the pointer over the empty table, press 3: the tool spawns at the pointer, not at the model.
- 4f. Toolbar range 3 with a model selected: it snaps to the model. With nothing selected: it appears in the middle of the screen. The toolbar button again: it goes away.

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
