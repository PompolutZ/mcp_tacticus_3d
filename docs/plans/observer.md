# Plan: Observer

Requested by the user on 2026-10-19. Status: not started, waits for the user's OK. Branch `observer`, worktree `../mcp_assist_3d-observer`, from main.

Each step makes one commit and writes its **Result** below. Paths are under `apps/web/` unless they start with `apps/api/` or `docs/`.

Checks of every step: `pnpm format`, `pnpm lint`, `pnpm test`, `pnpm --filter web build`, `pnpm --filter web typecheck`. Steps that change `apps/api` also run its tests.

## Request

Add an observer role: a third person who watches a multiplayer game live and cannot change it. The observer receives the game state and the motion of both players and sends no state back. For the first version:

- The observer camera is at the side of the table, at right angles to the players: host on the right of the screen, guest on the left.
- The observer has its own controls to open each player's roster at any time.
- The observer can use the Library, but a click shows the card or token in an overlay and adds nothing to the table.

The feature is `docs/features/observer.md`.

## Facts

Found on 2026-10-19. Paths under `src/`.

- State is in three objects, all made in `rooms/openTableSession.js`: the Y.Doc (stores in `net/doc.js`, writes through `net/collections.js`), the y-protocols Awareness (`net/ownership.js`, `net/presence.js`) and the live hub (`net/live.js`).
- `net/syncChannel.js` sends and receives the doc and awareness on one channel. It does not send back a change whose origin is the same channel. So a host with two channels forwards the guest's changes to the other channel with no new code.
- `net/live.js`: the hub holds one channel (`attach` replaces the old one) and one `seqs` map. `scene/LiveSync.jsx` sends at most every 33 ms and receives.
- `net/peer.js` (`connectRoom`): one pair. The guest offers to the host's `hello`, the host answers. A new offer ends the old connection.
- `presence.js` returns the first other awareness state only. `RemoteCursor.jsx` and `dice/OtherDiceTray.jsx` assume one other player.
- `rooms/seat.js` (`tableSeat`): `ownSide` is `host` or `guest`. Many places use `ownSide`, `isGuest`, `playedSides` and `mySide`.
- API: `apps/api/src/rooms/seats.ts` knows only `host` and `guest`. `routes/table.ts` and `routes/signal.ts` use `seated`. `routes/signal.ts` writes `user` into each message. The room has a message limit (`MAX_IN_ROOM`).
- `camera.js`: `startView(isGuest)` gives one of two views. Host at +z, guest at −z. The host's left is −x, so the observer camera is at −x looking at +x.
- Library: `ui/Library.jsx`, `ui/libraryTeam.js`. A gem click calls `onAttachedOpen`, which opens `rosters/CardPopup.jsx`. The Roster popup is `rosters/RosterPopup.jsx`, opened through `openRoster` in `App.jsx`.

## Decisions

1. **Logged-in observer with a seat.** The room gets an `observers` list. Signaling and the table snapshot keep their session and seat checks. A link without login is not in this plan.
2. **The observer connects only to the host.** The host forwards the guest's live packets on a third channel, `live-relay`. The guest's code and upload do not change.
3. **Read-only in two places.** The host ignores all from an observer channel except sync step 1. The observer's stores are read-only and its claims always fail. Both guards are central, so a new feature that writes the table is blocked for observers without new code.
4. **The server stamps the seat** into each signaling message (`user.seat`). Browsers use it to tell the guest from an observer.
5. **Hidden controls are only for clarity.** The guards above block writes. The UI step hides controls so the observer does not click buttons that do nothing.

## Steps

### Step 1. API: observer seat

- `apps/api/src/stores/store.ts`, `memory.ts`, `mongo.ts`: room `observers: string[]` (user ids). An old record without it reads as `[]`.
- `POST /rooms/{code}/watch` (login): adds the user to `observers`. 200 `{ room }`. A player of the room gets 409. A user who watches already gets 200 and no change. 409 when the room has the most observers (a constant in the API).
- `DELETE /rooms/{code}/watch` (login): removes the user. 204.
- `rooms/seats.ts`: seats include observers. `seated` returns the seat (`host`, `guest`, `observer`).
- `GET /rooms/{code}/table`: allowed for an observer. `PUT`: 403 for an observer.
- Signaling routes: allowed for an observer. The stored message gets `user.seat`.
- `GET /rooms`: also the watched rooms, with the seat `observer`. `GET /rooms/{code}`: the observer count, no observer ids.
- `DELETE /me`: removes the user from all `observers` lists.
- Check `MAX_IN_ROOM`: an observer adds a `hello` and offers. Raise it if the observer limit needs it, and write why.
- Tests: the seat rules above, the stamp, an observer cannot `PUT`.
- `docs/features/auth.md`: the new seat, the endpoints, the rules.

**Result:**

### Step 2. Web: read-only table for an observer

- `rooms/seat.js`: `tableSeat` gets `observer: true` for the seat `observer`. Decide what `ownSide`, `playedSides`, `isGuest` and `mySide` are for an observer (for example `playedSides: []`, `mySide: null`). Read every user of these fields and write in the Result what each does for an observer.
- `net/collections.js`, `net/doc.js`: `createTable(doc, { readOnly })`. A read-only store's `set` and `setField` do nothing. `transact` runs the function, which then writes nothing.
- `net/ownership.js`: an observer version where every claim fails.
- `rooms/openTableSession.js`: for an observer, no fill, no migrate, no `fillMap`, no server writer. Awareness with no local state. The table opens read-only. A table with an older or newer schema shows the same lobby message as today for newer, with text for the observer.
- Tests: a read-only store does not change the doc; every observer claim fails; an observer open writes nothing to the doc (doc state vector before and after).

**Result:**

### Step 3. Sync: read-only observer channel

- `net/syncChannel.js`: an option for the host side of an observer channel. It answers sync step 1 and ignores sync step 2, updates and awareness from the channel. It still sends all doc and awareness changes to the channel.
- The observer side sends step 1 and nothing else: no own updates, no awareness.
- Each player's awareness state gets `side` (`host` or `guest`), set in `openTableSession.js`.
- Tests with `net/linkedChannels.js`, three docs (guest, host, observer): a guest change reaches the observer through the host; an observer change does not reach the host; awareness of both players reaches the observer with their sides; the observer's awareness does not reach the host.

**Result:**

### Step 4. Connection: host to many peers

- `net/peer.js`: the host keeps one pair connection to the guest and one observer connection per observer peer. One signaling poll gives each message to the connection of its sender (`from`). Keep the pair rules of `docs/features/peer-to-peer.md`, "Connect flow", for each connection.
- The guest uses only messages with `user.seat` `host`. An observer makes offers only to the host's `hello`, the same way as the guest. The host uses `user.seat` to make a pair or an observer connection.
- The observer connection has three negotiated channels: `sync` (id 0), `live` (id 1), `live-relay` (id 2).
- `onChannels` and `onChannelsEnd` per connection. `openTableSession.js` starts and stops the sync of each.
- States: the host's toolbar status is the guest's status, as today. The observer's status is the host's status, with "Waiting for the host" while waiting.
- Tests in `net/peer.test.js`: the guest ignores an observer's `hello` and offer; the host answers the guest and an observer; a new observer offer ends only that observer's old connection.

**Result:**

### Step 5. Live: forward the guest's motion

- `net/live.js`: the hub attaches more than one channel. `send` writes to every attached send channel. `seqs` is per channel. A receive-only channel is possible (the observer's `live-relay`).
- The host forwards each raw packet from the guest's `live` channel to `live-relay` of each observer connection, in the message handler. Not in the 33 ms loop.
- `scene/LiveSync.jsx`: the observer sends nothing.
- Tests: two senders with their own sequence numbers both reach the observer; a forwarded packet is the same bytes; the host forwards when its own send loop does not run.

**Result:**

### Step 6. Scene: two remote players

- `net/presence.js`: the other players' states by side, not only the first one. The player's own browser still sees one other player.
- `scene/RemoteCursor.jsx`: one cursor per remote player, in its side color.
- Selection outlines, tool footprints and range marks of both players on the observer.
- `dice/OtherDiceTray.jsx`: both trays are "other" trays on the observer.
- Check `scene/useModelSync.js`, `scene/useModelClaims.js` and `scene/useLiveFollow.js` with two other players (`otherOwnedKeys` already takes a map). The observer never writes a pose at rest.
- Tests where the rules are plain JS (presence by side).

**Result:**

### Step 7. Join, lobby and camera

- Join page (`rooms/JoinRoom.jsx`): **Watch** next to **Join the fight!**, and only **Watch** when both seats are taken. A click calls `POST /rooms/{code}/watch` and opens the room.
- Lobby: a watched room has the **Watching** tag and **Stop watching**.
- `camera.js`: an observer view at −x, looking at +x, so the host is on the right. `startView` takes the seat, not `isGuest`. Space returns to it. The user tunes the numbers in the browser.
- `rooms/RoomPlayers.jsx`: the observer sees both seats with their status.
- `docs/features/rooms.md`: join page and lobby.

**Result:**

### Step 8. Observer UI: rosters, Library, hidden controls

- Toolbar: two roster buttons, one per player, as plates in the side color with the player's name. A click sets `openRoster` for that side. No Breakdown tab and no squad buttons for the observer.
- Library (`ui/Library.jsx`): for an observer, a character opens its card in `CardPopup` with Flip; a tactic card opens its face in `CardPopup`; a token opens a new overlay with the face, the name and the description. No For choice, no Single / Pile, no token drag.
- Hide the controls that write the table: setup actions, dice tray actions, tools, tray buttons, deploy line, mat turn, ping. Keys that write do nothing (the read-only stores already block the writes; hide or skip the key so no HUD message says it worked).
- `docs/features/library.md`: the observer Library.

**Result:**

### Step 9. Docs and test

- `docs/features/observer.md`: Status built.
- `docs/features/peer-to-peer.md`: the "Room and players" line about a spectator points to `observer.md`; the data channels table names `live-relay`; "Code layout" lists new files.
- User test with three browsers: host, guest, observer. Checks are listed in chat.

**Result:**
