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
- The live channel: live moves of every piece, also a new token from a Give source, a supply pile, a pile or the Library (decision 22), and the cursor.
- The `?drop` and `?delay` flags.
- The bytes of each connection, in the browser console.
- Docs.

Left for later:
- Dice: step 10. Until then, each browser has its own dice, and the number keys add dice to the Blue tray in both browsers.
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
| Awareness state | `{ owns: [piece key, …], drag: piece key or null, spawn: { key, tokenKey } or null, selection: [piece key, …], tools: [kind, …], mark: { key, mode } or null }` |
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
| `setDrag(key \| null)`, `otherDrag()` | The model that the own player drags now, and the one that the other player drags (decision 20). `subscribe` runs on a change of the other's |
| `setSpawn({ key, tokenKey } \| null)`, `otherSpawn()` | The same for a new piece (decision 22). `otherSpawn()` is the same object until its content changes |

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
  net/presence.js               the other player's selection, selected tools and range mark (decisions 24, 25)
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

20. **The other player's deploy tool.** The user asked for this on 2026-10-10. With Deploy Lock on, a drag of a model shows the R3 deploy tool (`DeployRangeTool`) along the model's deployment edge. Today only the dragging browser shows it, because it depends on the local `draggingCharId`.
    - The awareness state gets `drag`: the piece key of the model that the player drags now, or `null`. The drag sets it after the threshold, where it calls `setDraggingCharId`. The drag end and a cancelled drag set `null`.
    - A claim alone is not enough. R, Q / E, Throw and Place also claim a model, and they show no deploy tool.
    - The other browser shows `DeployRangeTool` for the other player's `drag` when Deploy Lock is on and the other player owns that key. The tool follows the model's body, and the body follows the live pose. So the tool moves live too.
    - The other deploy tool needs one more footprint slot. Decision 11 counted one deploy tool in `MAX_FOOTPRINTS` 12. The coder counts the slots again and raises the number if it is short.

21. **No cursor during Select squad.** The user asked for this on 2026-10-10. In a multiplayer room, the squad stays hidden until both players are Ready. The cursor over the roster cards shows which characters the player looks at.
    - While the own side's Select squad is on, LiveSync sends no cursor point.
    - When Select squad turns on, LiveSync sends `null` once, so the ring goes away on the other screen. It does not wait for a pointer move.
    - When Select squad turns off, the cursor is sent again after the next pointer move.

22. **New tokens are live.** The user chose this on 2026-10-10, after check 21. Today a new token from a Give source, the Library, a pile or a supply pile has no id before the drop, so the other screen sees only the cursor. An id alone is not enough: the other browser does not have the piece, so it does not know what to draw.
    - The token drag makes the id of the new piece at pointerdown (`crypto.randomUUID()`), and its piece key: `loose:<id>` for a character token (Give source, Library single, pile take), `pile:<id>` for a new pile (Library, Pile mode), `token:<id>` for a supply token. The drag code claims the key only after the threshold, so a click claims nothing.
    - The awareness state gets `spawn`: `{ key, tokenKey }` while a new piece is dragged, else `null`. `tokenKey` is the token key of the drag (a character token key, or the crisis token key of the supply). The key prefix gives the kind. The drag sets it after the threshold and sets `null` at the end, at Escape and at a refused drag.
    - LiveSync sends the drag point under the key, the same as for a table token.
    - The other browser draws a preview of the new piece at the live pose, the same look and height as the own preview, with its footprint. It shows from the first pose. While the pointer is off the table, the own browser sends no pose, so the preview stays at the last one.
    - The drop writes the piece into the document with the same id, then the claim and `spawn` end. Both go over the `sync` channel in that order. So the real piece shows before the preview goes, with no jump.
    - Escape, a drop over a HUD panel, a drop off the table, and a drop on a character write no new table piece. The preview goes when `spawn` ends. A drop on a character gives the token to the character, as today. A supply token on a character: the character holds a crisis token with the new id.
    - The key is new and random, so the other player cannot claim it. No tie.

23. **The footprint of a model that the other player moves.** Found in check 14. Today the other screen shows the drag footprint under every model that follows live poses, so also during a lift, a Q / E turn, Throw, Push and Place. The own screen shows it only during a drag. From now on the other screen shows it only while `otherDrag()` is that model's key (decision 20).

24. **The other player's selection.** The user asked for this on 2026-10-10.
    - The awareness state gets `selection`: the piece keys of the own selected character and crisis token, in the order of `selection.js` (the last one is the tool target). Terrain is left out: only unlocked terrain can be selected, to edit it. It also gets `tools`: the kinds of the own selected tools.
    - The other browser draws an outline on the other player's selected pieces, in that player's side color (the colors of the cursor ring). New outline mode `other`.
    - One piece, several marks. The order: `overlap`, a range mark (own, then the other player's), `selected`, `other`, `hovered`.
    - A piece that the other browser does not have shows nothing.

25. **The other player's range marks.** The user asked for this on 2026-10-10. The own screen has two marks:
    - The footprint of a selected tool turns green or red against the tool target (`ToolFootprint`). The other browser calculates the same thing for `OtherTool`, with the other player's `tools` and tool target from decision 24, and for R1 the snapped piece of the entry. It uses the poses it shows, so it needs no more data. Its colors can lag the other screen by the follow time.
    - While a player turns a snapped range tool, the piece under the pointer gets a green or red outline (`RangeMark`). The piece depends on the other player's pointer, so the other browser cannot calculate it. The awareness state gets `mark`: `{ key, mode }` or `null`, from the `onChange` of `RangeMark`. The other browser draws it with the `inRange` or `outOfRange` outline.

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

Done.

- `net/doc.js`: `tools`, `createRecord(doc.getMap('tools'), { depth: 1 })`. `fillTable` writes `state.tools ?? {}`. `rooms/table.js`: `startTable` has `tools: {}`. No new `SCHEMA`.
- New `components/storedTool.js` (plain module): `roundPose`, `roundTurn`, `roundPoint`, `storedFields`, `sameStored`, `freeSpawnYaw(side)`, `newSpawnId(random)`, `spawnEntry(which, at, random)`. Positions have 3 decimals. Yaw and bend have 4.
- `App.jsx`: `useYRecord(table.tools)`. `ownSide` is `red` for the Red seat of a multiplayer room (as the Red camera), else `blue`. `activeRange`, `activeMove` and `angleOn` are now read from the own entries. `toolSpawns`, `toolAt` and the state setters are gone. `angleSpawn` and `selectedTools` stay React state.
- `App.jsx` writes: a spawn writes a new entry `{ which, spawn, at? }` (`spawnTool`). The toolbar off, a repeated toolbar click, Escape (selected tools) and key 0 delete only own entries. `handleToolStore(kind, spawn, fields)` merges the rest fields into the own entry, and only when the entry still has that `spawn`.
- `Scene.jsx`: props `tools`, `ownSide`, `onToolStore`. Own tools come from the own entries, with the React key `kind-which-spawn` and the own side color. `OtherTool` is drawn for each entry of the other side that has a `pose`. `PLAYER_TEAM` stays for the dice only, with a comment.
- `RulerTool.jsx`, `Tool`: new props `entry`, `side`, `onStore`. `spawnAt` and `position` props are gone. The entry is read once at mount. With a `pose`, the body starts there (`position` and `rotation` of the `RigidBody`), with the stored `turn`, `mode` and `snap`. A snap whose piece is gone gives a free tool. Without a `pose`, the spawn rules run: `at` gives a free spawn with the yaw of `freeSpawnYaw(side)`, else the snap rules of today. `onSpawn` (selects the tool) runs only for a new spawn.
- `Tool` rest write: a `useFrame` reads pose, bend, snap and mode each frame. After 0.3 s (`REST_TIME`) without a change, and when the rounded values differ from the entry, it calls `onStore` once.
- `RulerTool.jsx`, `OtherTool`: other side color, plain footprint (`ToolFootprint` with no target and not selected), no buttons, hover or outline, no range mark. Raycast is off on its meshes. A kinematic sensor body. It jumps to the entry pose. The mesh loading is shared with `Tool` (`useRangeParts`, `useMovementParts`, `ToolFootprint`).
- `footprintProjection.js`: `MAX_FOOTPRINTS` is 12.
- Tests: `net/doc.test.js` (a new table has `tools`, an entry of one side does not change the other, the two sides merge), `rooms/startTable.test.js` (no tools), `components/storedTool.test.js` (rounding, equality, Red yaw is Blue yaw + π, ids, spawn entry).

Choices that the plan did not fix:
- `freeSpawnYaw` takes only the side, because the free yaw is the same for every kind.
- `mode` and `turn` are stored for every kind (a range tool stores a straight turn and `away`).
- Key 0 writes `{}` for the own side. A kind of the other side is never touched.
- A snap is stored with `across` only when it has one.
- `OtherTool` is keyed by kind, `which` and `spawn`, not by pose, so a new pose moves the body and does not mount it again.
- `OtherToolBody` repeats the hull collider and the part group of `Tool`, because `Tool`'s body is mixed with its buttons and handlers.

Differences in behavior:
- A tool now survives a reload, with pose, bend, snap and mode, once it rested 0.3 s.
- A Red free spawn faces Red (yaw + π). A Blue one is as before.
- After a reload, a tool that was never written (rest under 0.3 s) spawns again with the spawn rules. A snapped one then has no selected piece, so it is at the origin without `at`.
- Place, Throw, the Bend button and the selection are off after a reload.
- The other browser shows a tool only after the first rest write. Until Phase 5 it jumps to each new pose.

Checks:
- `pnpm --filter web test`: 147 pass, 0 fail.
- `pnpm --filter web build`: passes.
- `pnpm format` done. `pnpm lint`: 37 warnings, 0 errors. None are new.
- Not run in a browser, by the rules.


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

#### Part 4a: awareness and ownership

Done. Work items 1, 2 and 3, and the tests of `syncChannel.test.js` and `ownership.test.js`.

- `net/syncChannel.js`: `syncOverChannel(doc, channel, awareness)`. Type 1 is awareness, in the same frames as type 0. The own state goes out when the channel opens. Each awareness `update` whose origin is not the channel goes out while the channel is open, so the 15 s renew goes out too. Type 1 is applied with the channel as origin. `stop()` removes the listeners, then removes the states that came from the channel. Without `awareness` nothing changes.
- New `net/ownership.js`: `createOwnership({ awareness, role })` with `claim`, `release`, `owner`, `writes`, `otherPresent`, `mine`, `onLost`, `subscribe`, `otherOwned`, `destroy`. Without awareness it is the local version. Pure functions: `resolveOwner`, `otherOwnedKeys`, `lostKeys`, `sameSet`.
- `Table.jsx`: a multiplayer room makes one `Awareness` with `{ owns: [] }` and the ownership, after `createTable`. `close()` stops the sync, destroys the ownership, then the awareness. A single player room and the Sandbox get `createOwnership({})`. App takes the prop `ownership` and does not use it yet.
- Tests: `net/syncChannel.test.js` (awareness both ways, open, renew, not sent back, `stop`, a new channel after `stop`), `net/ownership.test.js` (claim, release, refusal, tie and `onLost`, `writes`, `otherOwned`, `subscribe`, the local version, the pure rules). New helper `net/linkedChannels.js` (the fake channels, moved out of the syncChannel test).

Choices that the plan did not fix:
- `stop()` also deletes the clocks (`awareness.meta`) of the removed states. y-protocols ignores a state with a clock that is not newer. Without this, a state sent again on a new channel would be ignored.
- Several other clients are handled (lowest id wins), though a room has two players.
- `otherPresent()` is true when any other client id has a state. `subscribe` also runs when that changes.
- A tie check runs on each awareness `change`, local ones too. It does nothing for a local change, because a claim is refused when the other owns the key.
- `claim` of a key already owned by this browser returns true and adds nothing.
- `createOwnership` sets the `owns` field at once, so the state has a clock above 0.
- `ownership.destroy()` removes the listeners only. Table destroys the awareness.
- App takes `ownership` with an eslint-disable for the unused variable, until 4b.

Checks:
- `pnpm --filter web test`: 165 pass, 0 fail.
- `pnpm --filter web build`: passes.
- `pnpm format` done. `pnpm lint`: 37 warnings, 0 errors.
- Not run in a browser, by the rules.

#### Part 4b: drag claims

Done. Work items 1 to 3 and 5 for the pieces without a body, and the tests of `pointerDrag.test.js`. The models are part 4c.

What changed:
- `drag/pointerDrag.js` has new options `key`, `ownership`, `releaseAtEnd` (true by default) and `onRefused`.
- With `key` and `ownership`, the drag claims `key` when it starts: after the threshold, or at the press for `immediate`. If `claim` returns false, no drag starts. There is no `onStart`, `onMove`, `onEnd`, `onClick` or `onCancel`. The listeners go and the controls turn on. An `immediate` drag returns `null`.
- With `releaseAtEnd` on, `release(key)` runs after `onEnd` returns (also when `onMove` ends the drag), and after `onCancel`. With it off, the drag code never releases.
- During the drag it listens to `ownership.onLost`. A lost tie for `key` calls `cancel()`. The listener goes at the end of the drag, also with `releaseAtEnd` off.
- Without `key` or `ownership` nothing changes. Tools, new tokens and the Library pass no key.
- `CrisisToken.jsx`: `token:<id>` for the drag and for the turn handle.
- `TacticCard.jsx`: `tactic:<id>`.
- `ScoreBoard.jsx`: `marker:blue`, `marker:red`, `marker:round`, through new props of `DraggableMarker`.
- `App.jsx`: the token drag claims `loose:<id>` for a character token on the table and `pile:<id>` for a pile moved with Shift. A take from a pile, a Give source, a supply pile and the Library claim nothing. The `eslint-disable` on `ownership` is gone.
- Each of these pieces has an `onCancel` that puts its shown pose back to its place in the document: the token (drag and turn), the card, the marker. The token drag of App already ended in `endTokenDrag`.

How the pieces get the ownership: as a prop. `App` gives it to `Scene`. `Scene` gives it to `CrisisToken`, `TacticCard` and `ScoreBoard`, and `ScoreBoard` to `DraggableMarker`. The chain is short, so there is no context.

Choices that the plan did not fix:
- New option `onRefused()`. The token drag of App sets its state at the press, before the claim. Without a callback the state would stay after a refused claim. App passes `endTokenDrag`.
- A cancel at the press, before the claim, does not release.
- Each piece keeps the place in the document in a `placeRef`, set by the same effect that syncs the pose. So a cancel puts the piece back to the newest place, not the place at the press.
- `Scene` also takes `ownership` for 4c. It uses it for these pieces only.

Differences in behavior:
- With the local ownership (single player room, Sandbox) every claim succeeds, so nothing looks different.
- A cancel by a lost tie now ends a piece drag. Before, only Escape did that for the token drag of App.
- A token turn that is cancelled goes back to the old yaw.

Checks:
- `pnpm --filter web test`: 179 pass, 0 fail.
- `pnpm --filter web build`: passes.
- `pnpm format` done. `pnpm lint`: 37 warnings, 0 errors.
- Not run in a browser, by the rules.

#### Part 4c: models

Done. Work item 6 (Scene and CharacterModel), the last part of Phase 4.

What changed:
- New `characters/claims.js` (plain, with `claims.test.js`): `claimCheck({ age, dynamic, asleep, busy, gone })` gives `'keep'`, `'rest'` or `'release'`. `claimChanges(prev, next, present)` gives `{ started, ended, gone }`. Also `MODEL_CLAIM_MIN` 0.2, `modelKey`, `modelIdOfKey`.
- `physics.js`: `SOLVER_ALL` and `SOLVER_NONE`.
- `App.jsx`: `useYRecord(table.poses)` goes to Scene as `poses`. `startPose` stays for the pose at mount.
- `Scene.jsx`:
  - `otherOwned` comes from `useSyncExternalStore(ownership.subscribe, ownership.otherOwned)`.
  - Scene keeps the time of the last claim of each key. It gives the models a copy of the ownership whose `claim` sets the time. So a drag, R, Q / E, Throw and Place all set it.
  - `claimModel(id)` runs before R, and before each turn step in `addTurn` (a tool turn claims nothing). R with no model under the pointer puts down every lift except those of the other player.
  - A `useFrame` checks each own `character:` claim with `claimCheck`. `rest` writes the pose with `onModelRest`, then releases. `release` is for a gone model or body. `busy` is a drag, lift or slide (`isBusy()` of the model) or a turn left.
  - `onRest` writes only when `ownership.writes(key)`.
  - Poses from the other browser: an effect on `poses` sets the exact pose of a model that nobody claims when the pose changed and the body stands elsewhere. Nothing at mount. A claimed model is skipped.
  - An effect on `otherOwned` uses `claimChanges`. A started key calls `markMoved`. An ended key gives the body the pose of `poses`, dynamic, then asleep. Without a pose the body only becomes dynamic. A gone key (the other player left) makes the body dynamic and awake. This browser then writes its rest pose, because `writes` is true when alone.
  - A body gets its pose, then sleeps 2 frames later, so its mesh follows first.
  - `onLost` removes the turn left for that model.
  - The tray move effect skips a model that the other player claims.
- `CharacterModel.jsx`: props `claimKey`, `ownership`, `remote`. The drag passes `key`, `ownership` and `releaseAtEnd: false`. The lift object has `isBusy()`.
  - `remote` on: the body is kinematic (`kinematicPosition`), the colliders get solver groups 0, the lift and slide are dropped, and the frame does nothing. `remote` off: the solver groups come back. Scene sets the body type and the pose.
  - `onCancel` of the drag (a lost tie) ends the drag state. It does not drop, write or change the body.
- `RulerTool.jsx`: `moveBase` returns false when the claim is refused. Place and Place 1 then stop before they change the snap or the Place state. Throw stops before the slide.

Choices that the plan did not fix:
- Refusal for Place, Place 1 and Throw: the `toolModels` entry of a model has `claim()`. `RulerTool` calls it before it moves the model. `moved()` stays as it was.
- The claim time is set by a wrapper around `claim`, so the drag code needs no change.
- A turn left counts as `busy` through the key `character:<id>`. It is the same string as the key of `turnsLeft`.
- `claimChanges` takes `present` and puts a left key in `ended` or in `gone`.
- A key that left the other player's set and that this browser now owns (a won tie) gets no pose.
- A lift or a slide of a model that loses a tie stops when the `remote` prop arrives, a render after `onLost`. Not at once.
- A body that is `remote` skips `settle`, so it does not fall asleep by itself.

Differences in behavior:
- With the local ownership (single player room, Sandbox) every claim succeeds. A claim lasts at least 0.2 s, then ends at rest. Nothing looks different.
- A model whose pose changes in the document while nobody claims it moves to that pose. This also fixes a guest that gets the poses after its models mounted.
- Not tried in two browsers. Live poses of a remote model come in Phase 5.

Checks:
- `pnpm --filter web test`: 185 pass, 0 fail.
- `pnpm --filter web build`: passes.
- `pnpm format` done. `pnpm lint`: 37 warnings, 0 errors.
- Not run in a browser, by the rules.

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

#### Part 5a: the live channel and the hub

Done. Work items 1 to 4 and the tests of item 6. Part 5b (`LiveSync`, the follow, `RemoteCursor`) is below.

What changed:
- `net/peer.js`: each attempt creates `sync` (id 0) and `live` (id 1, negotiated, `ordered: false`, `maxRetransmits: 0`) before the offer. `onChannel(channel)` is now `onChannels({ sync, live })`. It is called once per open, when `sync` opens. `live` may open a moment later.
- New `net/live.js` (plain, with `live.test.js`): `createLiveHub({ timers, random, drop, delay })` gives `{ attach, detach, send, subscribe }`. It also exports the pure `newer(seqs, key, s)`.
  - `send({ p?, c? })` sets `s`, rounds the numbers by key kind, and sends JSON on an open channel only.
  - Receiving: parse, check, `drop`, `delay`, then the sequence check per key and for the cursor. Subscribers get `{ p, c? }` with the newer parts only. `p` is `{}` when only the cursor is newer.
- `net/debugFlags.js`: `dropFlag()` and `delayFlag()`, dev builds only.
- `Table.jsx`: one hub per open table in a multiplayer room, made with `dropFlag()` and `delayFlag()`. `onChannels` syncs `sync` as before and attaches `live`. The close of `live` and the close of the table detach it. The hub goes to App as `live`, and App passes it to Scene. A single player room and the Sandbox pass `null`.
- `Scene.jsx` takes the `live` prop and does not use it yet.

Choices that the plan did not fix:
- `seqs` is a `Map`. The cursor has the key `cursor`. A piece key always has a colon, so they never meet.
- `s` grows only for a packet that is sent. It does not reset on a new channel.
- `attach` of a new channel detaches the old one first. `detach` of a channel that is not attached does nothing.
- `send` skips a key of an unknown kind or with a wrong count of numbers. A packet with no valid key and no `c` sends nothing.
- A packet with a `__proto__` key is bad. The sequence check runs after the `delay`, so the delay can reorder packets as the network would.
- `delay` and `drop` of 0 take the direct path, with no timer.
- `onChannels` runs for the `sync` open only. It does not wait for `live`. The hub sends nothing until `live` is open.

Checks:
- `pnpm --filter web test`: 201 pass, 0 fail.
- `pnpm --filter web build`: passes.
- `pnpm format` done. `pnpm lint`: 37 warnings, 0 errors.
- Not run in a browser, by the rules.

#### Part 5b: LiveSync, the follow and the cursor

Done. Work items 1 to 6 of the plan for Phase 5, the last part of Phase 5. The tests of item 6 for `livePose.js` are in. Not tried in two browsers.

What changed:
- New `net/livePose.js` (plain, with `livePose.test.js`): `followPart(dt)`, `lerpAngle`, `poseToNumbers(key, pose)` (rounded as a packet), `numbersToPose`, `sameNumbers`, `isLiveKind`, `kindOf`, `sameSideQuat`. A table `KINDS` maps a key kind to its number layout. Phase 6 adds the other kinds there and in `LAYOUTS` of `live.js`. `live.js` now exports `roundPiece`.
- New `components/LiveSync.jsx`, inside `Physics`. Scene mounts it only when `live` and `ownership` are set.
  - Sending: a packet at most every 33 ms, with the parts whose rounded numbers changed since the last sent value. Models: each `ownership.mine()` key `character:`, from the body (a lifted model sends the lifted pose). Tools: `tool:range`, `tool:move`, `tool:angle`, from getters.
  - The cursor: at most every 100 ms, only when the pointer moved, `c` = `tablePoint` under the last pointer position with `offTable: 'null'`. `c: null` once when the pointer leaves the canvas or the table.
  - Receiving: latest numbers per key in a ref Map with the time they came. A `character:` pose counts only while `otherOwned` has the key. When the key leaves the set, the pose is removed. `tool:` poses always count. Latest cursor in a ref.
  - `liveRef` (Scene calls it `received`) gives `pose(key)`, `tool(kind)` ({ pose, time }) and `cursor()`.
- `RulerTool.jsx`, `Tool`: new prop `liveRef(get)`, the same pattern as `turnRef`. The getter gives `{ x, y, z, yaw, right, left }`. Scene keeps the getters in `toolLives`.
- `CharacterModel.jsx`, remote mode: prop `getLivePose(key)`. Each frame the model keeps its own shown pose and goes `followPart(dt)` of the way to the latest live pose: position by lerp, rotation by slerp, then `setNextKinematicTranslation` and `setNextKinematicRotation`. Without a live pose it stays. While it follows it shows `DragFootprint`. The follow ends when `remote` goes false or the pose goes. The rules of 4c for the end of a claim did not change.
- `RulerTool.jsx`, `OtherTool`: prop `getLive`. The target is the live pose if it came after the tool mounted and after the last change of the entry, else the entry pose. The body follows with `followPart(dt)`: position, yaw (shortest turn) and bend. The part groups and the colliders turn with the bend. The footprint reads the shown bend.
- New `components/RemoteCursor.jsx`: a flat ring (0.2" to 0.25" radius, so 0.5" across) in the color of the other side, 0.04" above the point. No raycast. It follows the point with the same `followPart`. Hidden before the first cursor, after `null`, and when `otherPresent()` is false.
- `Scene.jsx`: `live` replaces `_live`. A single player room and the Sandbox pass no `live`, so they have no LiveSync and no cursor.

Choices that the plan did not fix:
- The shown pose of a remote model is kept in a ref of the model, not read from the body, because a kinematic body shows its new pose only after the next physics step.
- A remote model is woken up on each follow frame, as the drag does, so its mesh stays in sync.
- A model starts to follow from where its body stands. It does not jump to the first live pose.
- `OtherTool` moves its body with `setTranslation` and `setRotation`, not the next-kinematic calls, so the footprint reads the same pose that is drawn. The body is a sensor.
- The time of the entry is set in an effect after the entry pose or bend changes. A packet that comes in the same frame as the change counts as older.
- The cursor sends `null` only after a point was sent. A pointer that leaves before the first point sends nothing.
- A tool pose is not removed when the other player is gone. The time rule handles stale poses.
- The cursor is drawn for any other player that is present, in the opposite side color of the own side.

Differences in behavior:
- In a multiplayer room, a model that the other player drags moves smoothly in this browser, with its footprint. Before, it stayed.
- The other player's tool follows live while it moves, but it is drawn only after its first rest write (the entry needs a `pose`). So a new tool does not show during its first move.
- A single player room and the Sandbox look as before.

Checks:
- `pnpm --filter web test`: 208 pass, 0 fail.
- `pnpm --filter web build`: passes.
- `pnpm format` done. `pnpm lint`: 0 errors, no new warnings.
- Not run in a browser, by the rules.

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

Done. Work items 1 to 4. Not tried in two browsers.

What changed:
- `net/livePose.js`: `KINDS` has `token` ([x, z, yaw]) and `loose`, `pile`, `tactic`, `marker` ([x, z]). `livePose.test.js` tests each kind both ways.
- `drag/pointerDrag.js`: new options `live` (a Map, piece key to getter) and `livePose()` (the pose `{ x, z, yaw? }` or null). The getter goes into the Map when the claim is held, and out at the end of the drag (drop, cancel, lost tie). A refused claim registers nothing. `pointerDrag.test.js` has two new tests.
- `App.jsx`: makes the Map (`pieceLives`) and passes it to `Scene`. The token drag passes it with the point of `TokenDragPreview` (`dragPointRef`) as `livePose`. A new token has no key, so it sends nothing.
- `Scene.jsx`: passes `pieceLives` to `LiveSync` and to `CrisisToken`, `TacticCard` and `ScoreBoard`. It gives each piece `remote` (the key is in `otherOwned`) and `getLivePose` (`received.pose`). `LooseToken` and `TokenPile` get the same two props.
- `LiveSync.jsx`: each send also reads every getter in `pieceLives`. Receiving: every kind except `tool:` counts only while the other player claims the key, and is removed when the key leaves the set.
- New `components/useLiveFollow.js`: the follow of a piece without a body. Each frame the drawn pose goes `followPart(dt)` of the way to the live pose (yaw by `lerpAngle`). With no live pose it does nothing. When the live pose goes, the pose goes back to the place in the document at once.
- `CrisisToken.jsx`, `TacticCard.jsx`, `ScoreBoard.jsx` (markers), `LooseToken.jsx`, `TokenPile.jsx`: use the hook. The drags of the token (and its turn handle), the card and the markers pass `live` and `livePose`.

Choices that the plan did not fix:
- The registry is a plain Map made by `App`, not a context. It is passed down as a prop, as `ownership` is.
- The crisis token sends `[x, z, yaw]` for both a drag and a turn. The two are told apart on the receiving side. A piece counts as moved when its live point is more than 0.05" from its place. Once moved, it stays moved until the claim ends. A moved piece hangs `TOKEN_DRAG_LIFT` above the table and shows its footprint. A turn alone does neither.
- The footprint component is mounted while the other player claims the piece. It is hidden (shape null) until the piece moved. It takes one slot meanwhile.
- A loose token and a pile use the radius of `TokenDragPreview` (`TOKEN_RADIUS`) for the footprint.
- A place change in the document during a follow puts the drawn pose on the new place. The follow goes on from there.
- The marker follows its position only. It has no lift and no footprint.
- The drag registers its getter and the getter returns the drawn pose, so a token sends its yaw too.

Differences in behavior:
- In a multiplayer room, a token, card, marker, loose token or pile that the other player drags moves smoothly in this browser. Before, it stayed until the drop.
- A single player room and the Sandbox look as before.

Checks:
- `pnpm --filter web test`: 218 pass, 0 fail.
- `pnpm --filter web build`: passes.
- `pnpm format` done. `pnpm lint`: 36 warnings, 0 errors.
- Not run in a browser, by the rules.

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

#### Part 7a: traffic

Done. Work items 1 to 4. Not tried in two browsers.

What changed:
- New `net/traffic.js`: `trafficOf(report)` gives `{ sent, received, relayed }` or null. It takes the pair from the `transport` stat (`selectedCandidatePairId`), else a `candidate-pair` with `selected: true`. `relayed` is true when the local or the remote candidate has type `relay`. It also has `formatBytes`, `minutesOf`, `sumTraffic` and `trafficLine`.
- `net/peer.js`: `traffic()` on the link. It reads `getStats()` of the open connection and gives `trafficOf` of it. It gives null when no connection is open.
- `Table.jsx`: while connected, it reads `traffic()` every 60 s and keeps the last value. It logs one `console.info` line every 10 min, when a connection ends, and on **← Lobby**. The ended connections are summed with the current one for the table part. Both intervals stop at the end of the connection and at `close()`.
- `net/traffic.test.js`: Chrome and Safari form, Firefox form, relayed pair, no selected pair, bytes format, sums, line. `peer.test.js`: the fake peer connection has `getStats`, and one new test for `traffic()`.

Choices that the plan did not fix:
- `traffic()` gives null when `getStats()` fails, for example when the connection closes during the read.
- A read that ends after the connection ended is dropped.
- `close()` ends the connection without a line. **← Lobby** already logged, and a page close cannot wait.
- A line before the first read shows 0.0 KB and direct.
- Minutes are whole, rounded. Time runs from the open of the channel to the end.
- `relayed` is per connection. The table part has no direct or relayed word.
- A bad `getStats` value of bytes counts as 0.

Checks:
- `pnpm --filter web test`: 226 pass, 0 fail.
- `pnpm --filter web build`: passes.
- `pnpm format` done. `pnpm lint`: 36 warnings, 0 errors.
- Not run in a browser, by the rules.

#### Part 7b: docs

Done. Work items 5 to 8. Docs only, no code change.

- `docs/feature-peer-to-peer.md`: status line, "Data channels" (`sync` and `live`, both before the offer), "State" and "Yjs document" (`tools`, the tool entry), "Moving objects (physics)" (rewritten for claims, one writer, the follow, no pushed bodies), "Pose message", "Cursor message", "Traffic per game", "Debug flags", "What each player controls", "Code layout", "Phases".
- `README.md`: live moves, the other player's tools and cursor, the tools saved with the room, `?drop` and `?delay`, the traffic lines.
- `docs/feature-rooms.md` ("Storage"): the tools are in the document.
- `docs/plans/implement-backend.md`: **Result** under step 9, and the dice notes under step 10.
- Check 23 (the bytes of a local game): the user measured it on 2026-10-10. One browser logged 139.2 KB sent and 233.0 KB received in 10 min, relayed. That is about 37 KB per minute, so about 4.5 MB for a 2-hour game without dice. The estimate in "Traffic per game" is 22 MB without dice. Open: the pair is not known, and why a pair on one Mac went through TURN, not direct.

Choices that the plan did not fix:
- The first design said the tools are player bodies that the owner simulates. They are sensor bodies that the owner moves, and the other browser follows the live pose. They are never claimed. The doc says so.
- The first design said the cursor is `x, z`. The built cursor is `[x, y, z]` or `null`.
- The "Traffic per game" estimate stays, with a note that the built packet is smaller. The measured numbers wait for check 23.
- The selection of the other player is not built, and the "Players" row says so.

## Phase 8: Fixes from the user checks

The user found these on 2026-10-10, in a pair (alice on Blue, dylan on Red):
- The canvas stopped. A drag moved only the HTML labels and buttons, not the table. After that nothing synced.
- With Deploy Lock on, the other player does not see the R3 deploy tool of a model drag.
- The cursor is sent while Select squad is on.

Cause of the first one: `OtherToolBody` in `RulerTool.jsx` calls `colliders.current[i]?.setRotationWithParent(...)` every frame. The Rapier 0.14 collider has no such method. The name is `setRotationWrtParent`. The call runs only for a part with a `side`, so only for the other player's movement tool (S, M, L, T/A). Range tools have no sides. The error is thrown inside the R3F frame loop, so every later frame callback and `gl.render` stop on every frame: no physics, no LiveSync, no claim checks, no drawing. drei `<Html>` elements still follow the camera, because their callbacks run before the error. So the labels moved over a still image.

Read: decisions 20 and 21. `components/RulerTool.jsx` (`OtherToolBody`, `DeployRangeTool`), `net/ownership.js` (+ test), `components/Scene.jsx` (the model drag, the deploy tool, LiveSync), `components/LiveSync.jsx`, `App.jsx` (`squadSelect`).

Work:
1. `RulerTool.jsx`: `setRotationWithParent` → `setRotationWrtParent`. Search `apps/web/src` for other Rapier calls with a wrong name.
2. `net/ownership.js`: `setDrag(key | null)` writes the `drag` field of the own awareness state. `otherDrag()` gives the other player's `drag` key, or `null`. `subscribe` also calls on a change of it. The local version: `setDrag` does nothing, `otherDrag()` gives `null`. Tests in `ownership.test.js`.
3. `Scene.jsx`: the model drag calls `setDrag(modelKey(id))` at its start and `setDrag(null)` at its end. A second `DeployRangeTool` for the other player's `drag` when `deployLine` is on and `owner(key)` is `'other'` (decision 20). The same props as the own one, from that model.
4. `Scene.jsx`, `LiveSync.jsx`: `hideCursor` = the own side's `squadSelect`. While it is true, `cursorUpdate` gives `null` without the `moved` check, and the existing compare sends it once (decision 21). Put the choice in a plain function in `net/livePose.js` or a new plain module, with tests, if it fits.
5. Docs: "Names" (awareness state `{ owns, drag }`). `docs/feature-peer-to-peer.md`: the "Players" row (`drag`), "Cursor message" (no cursor during Select squad).

Checks:
- `pnpm --filter web test`, `pnpm --filter web build` pass.
- `pnpm format`, `pnpm lint`: no new errors.

User, after this phase: checks 24 to 26, then the open checks from 6 on.

### Result

What changed:
- `RulerTool.jsx`: `setRotationWithParent` → `setRotationWrtParent`. Other Rapier calls in `apps/web/src` checked by name (`setTranslation`, `setRotation`, `setBodyType`, `wakeUp`, `sleep`, `setAngvel`, `setLinvel`, `setNextKinematic*`, `castShape`, `castRay`, `intersectionsWithShape`): all exist. No other wrong name.
- `net/ownership.js`: `setDrag(key | null)` and `otherDrag()`. `subscribe` also runs when the other player's `drag` changes. `drag` starts as `null` in the awareness state. The local version: `setDrag` does nothing, `otherDrag()` gives `null`. Tests: a drag set and cleared, no call for the same value, a player who left.
- `Scene.jsx`: the model `onDragStart` and `onDragEnd` call `setDrag`. A cancelled drag ends through `onDragEnd`, so it clears too. A second `DeployRangeTool` for the other player's `drag` when `deployLine` is on and `owner(key)` is `'other'`. Scene reads `otherDrag` with `useSyncExternalStore`.
- `MAX_FOOTPRINTS` stays 12. Count: 3 own tools, 3 other tools, 2 deploy tools, 1 zone arc, 2 drags = 11. Only the selected token shows an arc. The comment in `footprintProjection.js` says so.
- `net/livePose.js`: `cursorStep({ hide, moved })` gives `'null'`, `'read'` or `'skip'`. Test added. `LiveSync.jsx` takes `hideCursor` and reads it through a ref in `useFrame`. Scene passes `squadSelect[ownSide]`.
- Docs: "Names" (awareness state), `docs/feature-peer-to-peer.md` ("Players" row, "Cursor message").

Choices that the plan did not fix:
- While the cursor is hidden, `moved` is cleared each time. So the cursor comes back after the first pointer move after Select squad ends, not at once.
- The hide ref is set in an effect, not in render, so lint has no new `react(refs)` warning.
- If nothing was sent before Select squad turned on, no `null` is sent. The other screen has no ring then.

Checks:
- `pnpm --filter web test`: 229 pass, 0 fail.
- `pnpm --filter web build`: passes.
- `pnpm format`: done. `pnpm lint`: 0 errors, 36 warnings (the same as before).

## Phase 9: New tokens are live, the footprint of the other player's model

Read: decisions 18, 20, 22 and 23. `App.jsx` (`startTokenDrag`, `handleTokenRelease`, `handleSupplyTake`), `drag/pointerDrag.js`, `net/ownership.js` (+ test), `net/livePose.js`, `components/Scene.jsx` (`TokenDragPreview` and its children, LiveSync), `components/TokenDragPreview.jsx`, `components/CharacterModel.jsx` (the remote mode and its footprint), `components/LiveSync.jsx`.

Work:
1. `net/ownership.js`: `setSpawn(spawn | null)` and `otherSpawn()`, the same way as `setDrag` and `otherDrag`. `subscribe` also runs on a change of it. The local version does nothing and gives `null`. Tests.
2. `App.jsx`, `startTokenDrag`: a new piece gets its id and key (decision 22). The key goes to `startPointerDrag`, and `livePose` gives the drag point. `onStart` sets `spawn`. The end, Escape and a refused drag set `null`. `handleTokenRelease` uses the id of the drag for the new table token, the new pile and the supply token (`handleSupplyTake` takes it). The document write comes before `setSpawn(null)` and the release of the claim.
3. `net/livePose.js`: if a `token:` key needs a yaw, a new supply token sends the yaw that its own preview has.
4. `Scene.jsx`: the preview of the other player's `spawn`, at the live pose of its key, with the look and the footprint of the own preview for that kind. Reuse `TokenDragPreview` with a pose source in place of the pointer, or a small component next to it.
5. `CharacterModel.jsx`, `Scene.jsx`: a model that follows live poses shows its drag footprint only while `otherDrag()` is its key (decision 23).
6. `drag/pointerDrag.js` line 59: the console shows "Unable to preventDefault inside passive event listener invocation". R3F listens to `pointerdown` as a passive listener, so `preventDefault` on an R3F event does nothing and logs this. Call it only on a DOM event. Check that a drag from a Library chip (a DOM element) still does not start the browser's image drag or text selection.
7. Docs: "Names" (awareness state `{ owns, drag, spawn }`). `docs/feature-peer-to-peer.md` ("Players" row, "Moving objects (physics)": new pieces). The "Scope" of this plan: the new token is no longer left for later.

Checks:
- `pnpm --filter web test`, `pnpm --filter web build` pass.
- `pnpm format`, `pnpm lint`: no new errors.

User, after this phase: checks 27 to 30.

### Result

What changed:
- `net/ownership.js`: `setSpawn({ key, tokenKey } | null)` and `otherSpawn()`. `subscribe` also runs when the other player's `spawn` changes. `otherSpawn()` is the same object until its content changes. `spawn` starts as `null` in the awareness state. The local version does nothing and gives `null`. Tests: set and clear, no call for the same value, a player who left, the local version.
- `net/livePose.js`: `tokenDragKey` (the key by kind of drag), `dragPose` (a `token:` key sends the yaw of its preview), `SUPPLY_YAW` (0, also used by `supplyToken`). Tests.
- `App.jsx`, `startTokenDrag`: a new piece gets `crypto.randomUUID()` and its key at the press. The drag claims it after the threshold, like a piece on the table. `onStart` sets `spawn` after the claim. `endTokenDrag` sets `null`: it runs at the end, at Escape, at a click and at a refused drag. `handleTokenRelease` and `handleSupplyTake` use the drag id. The document write comes before `setSpawn(null)`, and the claim release comes after.
- `TokenDragPreview.jsx`: `OtherSpawnPreview`. It follows the live pose of the key, finds the ground like `LooseToken`, hangs `TOKEN_DRAG_LIFT` high, and has the round footprint. Hidden until the first pose.
- `Scene.jsx`: reads `otherSpawn` and draws `OtherSpawnPreview` with the face of the kind (`token:` supply token, `pile:` pile stack, `loose:` token face). It gives `otherDragging` to each model.
- `CharacterModel.jsx`: a remote model shows the drag footprint only while `otherDragging` (decision 23).
- `drag/pointerDrag.js`: `preventDefault` only on a DOM event of an element that is not the canvas. An R3F event and a canvas event skip it. A Library chip is a HUD element, so its drag still gets it. Test added.
- Docs: "Names" (awareness state, the two ownership rows), "Scope" (the new token is no longer left for later), `docs/feature-peer-to-peer.md` ("Players" row, "Moving objects (physics)").

Choices that the plan did not fix:
- The preview ignores the yaw. The own preview has none, so the look is the same. The yaw is sent only because the `token` kind needs three numbers.
- `isHudEvent` tests `nativeEvent` and the `CANVAS` tag. Callers that pass `e.nativeEvent` from the canvas have the tag `CANVAS` on the target.
- The preview component is next to `TokenDragPreview`, in the same file, and it does not use `useLiveFollow` (it has no place in the document to compare with).
- Between the document write and `setSpawn(null)`, the real piece and the preview can both show for a moment. The preview is at the same place, so there is no jump.
- `MAX_FOOTPRINTS` stays 12. The preview takes the slot of the other player's drag, which is only used when no model is dragged.

Checks:
- `pnpm --filter web test`: 234 pass, 0 fail.
- `pnpm --filter web build`: passes.
- `pnpm format`: done. `pnpm lint`: 0 errors, 36 warnings (the same as before).

## Phase 10: The other player's selection and range marks

Read: decisions 24 and 25. `selection.js`, `App.jsx` (selection, selected tools), `components/Scene.jsx` (`rangeMark`, `toolTarget`, `OtherTool`), `components/SelectionOutlines.jsx`, `components/CharacterModel.jsx`, `components/CrisisToken.jsx`, `components/RulerTool.jsx` (`RangeMark`, `ToolFootprint`, `OtherToolBody`), `components/RemoteCursor.jsx` (side colors), `net/ownership.js`.

Work:
1. `net/presence.js`, new plain module: the fields `selection`, `tools` and `mark` of the own awareness state, and those of the other player. `set(fields)`, `other()` gives `{ selection, tools, mark }` (the same object until a field changes), `subscribe`, `destroy`. A version without awareness for a single player room. Tests. It is separate from `ownership.js`, because it is about what a player looks at, not about who moves a piece.
2. `Table.jsx`: one presence per table, next to the ownership. It goes to App and Scene.
3. `App.jsx` or `Scene.jsx`: writes the own selection (character and token keys, in order), the selected tool kinds, and the range mark (`{ key, mode }` or `null`).
4. `SelectionOutlines.jsx`: the mode `other`, in the other side's color. `outlineMode` takes the other player's selection and range mark, in the order of decision 24.
5. `CharacterModel.jsx`, `CrisisToken.jsx`: the outline mode from step 4.
6. `RulerTool.jsx`, `OtherToolBody`: `ToolFootprint` gets `selected` (the kind is in the other player's `tools`), `target` (the other player's tool target, as a tool model) and `rangeFrom` (R1: the snapped piece of the entry). The footprint colors then follow the same rule as the own tool.
7. Docs: "Names" (awareness state `{ owns, drag, spawn, selection, tools, mark }`). `docs/feature-peer-to-peer.md` ("Players" row: the selection is built; "What each player controls"). `README.md`: the other player's selection and range marks.

Checks:
- `pnpm --filter web test`, `pnpm --filter web build` pass.
- `pnpm format`, `pnpm lint`: no new errors.

User, after this phase: checks 31 to 34.

### Result

What changed:
- `net/presence.js` (new): `createPresence({ awareness })` with `set(fields)`, `other()`, `subscribe`, `destroy`. The fields are `selection` (piece keys), `tools` (kinds) and `mark` (`{ key, mode }` or `null`). `other()` is the same object until a field changes. It sets only its own fields with `setLocalStateField`, so it and `ownership.js` share the awareness state. A field that equals the current one is not sent again. The local version does nothing and gives an empty `other()`. Tests in `presence.test.js`: both ways, the same object, a player who left, sharing with ownership, the local version.
- `selection.js`: `presenceSelection` (character and token keys in selection order, terrain left out) and `presenceTools`.
- `Table.jsx`: one presence per table on the awareness, next to the ownership. It goes to `App` and `Scene`. A single player room and the Sandbox get the local version.
- `App.jsx`: an effect writes the own selection and selected tools.
- `Scene.jsx`: writes the own range mark from `rangeMark`. Reads `other()`: `rangeMarkOf` gives the own mark, else the other player's. `otherSelectedOf` gives the side of the other player for a piece. The other tool target is the last key of their selection. `OtherTool` gets `selected`, `target` and `rangeFrom`.
- `SelectionOutlines.jsx`: modes `otherBlue` and `otherRed` (the side colors of the cursor ring). `outlineMode(selected, hovered, rangeMark, overlap, other)`: overlap, range mark, selected, other, hovered.
- `CharacterModel.jsx`, `CrisisToken.jsx`: prop `otherSelected` goes to `outlineMode`.
- `RulerTool.jsx`: `OtherToolBody` passes `selected`, `target` and `rangeFrom` to `ToolFootprint`.
- Docs: "Names" (awareness state, Files), "Scope", `docs/feature-peer-to-peer.md` ("Players" row, "What each player controls"), `README.md`.

Choices that the plan did not fix:
- Two outline modes (`otherBlue`, `otherRed`) in place of one `other`, because an Outline has one color. `outlineMode` takes the side.
- The mark key is `<kind>:<id>`, the same as a piece key.
- `rangeFrom` for the other tool: only when the entry is range 1 and has a `snap`. The model is found by `snap.kind` and `snap.id`.
- `presence.set` is called from an effect when the selection, the selected tools or the mark change.
- Only the first other client is read.
- No tests for `outlineMode` and the selection helpers: they live in files that load three.js or have no test file.

Checks:
- `pnpm --filter web test`: 239 pass, 0 fail.
- `pnpm --filter web build`: passes.
- `pnpm format`: done. `pnpm lint`: 0 errors, 36 warnings (the same as before).

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

After Phase 8, in one pair:
24. Alice puts out S, M, L and T/A, and bends one. Bob sees them move live. Bob's table keeps drawing, his camera moves the table, and the console has no `RulerTool.jsx` error.
25. Deploy Lock on. Alice drags one of her models. Bob sees the R3 deploy tool on Alice's edge, and it moves with the model. It goes away at the drop. Alice turns a model with Q / E: no deploy tool on either screen. Then the same from Bob to Alice.
26. Alice turns Select squad on. Her ring goes away on Bob's screen. She moves the pointer over her roster cards and the table: Bob sees no ring. She turns it off and moves the pointer: the ring shows again.

After Phase 9, in one pair:
27. Alice drags a token from a Give source over the table. Bob sees it move live from the first drag, with its footprint. Alice drops it on the table: on Bob's screen it lies at the same place, with no jump and no second token.
28. The same from the Library (one token), from a pile on the table, a new pile from the Library in Pile mode, and a token from the supply pile of a Source card.
29. Alice drags a new token and presses Escape: it goes away on Bob's screen too. Alice drops a new token on a character: the preview goes away on Bob's screen, and the character has the token on both screens. A supply token on a character: the character holds it on both screens.
30. Alice lifts a model with R: no footprint on either screen. Alice drags a model: a footprint on both screens. A token drag from a tray, a pile or the Library: no "Unable to preventDefault" line in the console, and a drag from a Library chip does not select text.

After Phase 10, in one pair:
31. Alice selects a model. Bob sees a blue outline on it. Alice selects another model: the outline moves. Alice clicks the empty table: it goes away. The same with a crisis token. Bob selects the model that Alice selected: on Bob's screen his own orange outline shows. Then the same from Bob: Alice sees a red outline.
32. Alice selects a model and her range 3 tool, and moves the tool. Bob sees the tool footprint turn green when it touches the model and red when it does not, the same as on Alice's screen.
33. Alice snaps range 3 to a model and turns it around the base over another model. Bob sees the green or red outline on the measured model, the same as on Alice's screen. It goes away when Alice ends the turn.
34. Alice snaps range 1 to a model and selects a second model. Bob sees the footprint color of check 32 for range 1 between the two bases.

### User check results

- 2026-10-10: checks 1 to 3 pass (after Phase 1b).
- 2026-10-10: checks 24 to 26 pass (after Phase 8). Checks 4 to 23 are open. Results of 6 to 22 from before Phase 8 do not count, because the crash of the other player's movement tool stopped the frame loop.
- 2026-10-10, after Phase 8: checks 4 to 8, 10 to 13, 15 to 18, 21 and 22 pass. Check 8 shows the drag live, which is right since Phase 5. Open:
  - 9: tested with a selection, not a drag. A selection claims nothing, so Bob can drag a model that Alice selected. That is the design. Retest with a lift: Alice lifts with R, Bob tries a drag, Q / E and R.
  - 14: Bob sees a footprint under Alice's lifted model. Alice's own screen shows none during a lift. The tab close part is not reported yet.
  - 19: the flags were in the hash (`#room=…&drop=30&delay=150`). `net/debugFlags.js` reads `location.search`. Retest with `/?drop=30&delay=150#room=…`.
  - 20: one person cannot start two drags at the same moment. The tie rule has unit tests in `ownership.test.js`.
  - 21, 22: the first drag of a token from a Give source shows only the cursor on the other screen. Later drags are live. This is the known limit in "Scope": a new token has no id before the drop.
  - 23: no traffic lines seen. The page was reloaded during the game. A reload clears that browser's console, and a page close logs no line.
- 2026-10-10, after Phase 10: the user tried all checks and counts the step as done. A problem found later is fixed as a bug.

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
8. **Red outline** (decision 24). Red's selection outline is in Red's side color `#c0392b`. It is close to the red of `outOfRange` and `overlap` (`#e5484d`). If the user cannot tell them apart, pick another color for the other player's selection.
