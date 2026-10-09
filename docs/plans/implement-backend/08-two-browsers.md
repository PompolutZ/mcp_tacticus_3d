# Step 8: Two browsers

Detailed plan of step 8 in `docs/plans/implement-backend.md`. Peer-to-peer phase 2 and auth phase 3. The design is in `docs/feature-peer-to-peer.md` ("How a WebRTC connection starts", "Signaling service", "Connect flow", "Data channels", "State", "Room and players", "Local testing", "Debug flags") and `docs/feature-auth.md` ("Identity in peer-to-peer games", "Table on the server"). Decisions 2, 3, 8, 9, 12 and 13 change parts of the design. The user agreed on 2026-10-09.

## Goal

The two players of a multiplayer room see one table. When both have the room open, their browsers connect over WebRTC, and the Yjs document syncs over a data channel. A discrete change by one player shows on the other screen at once: mat turn, crisis cards, tokens, new characters, damage and power.

The step comes after step 7, because signaling accepts only players with a seat, and the seats are made in step 7. Moving objects (step 9) and dice (step 10) need the connection of this step.

## Scope

In the step:
- `apps/api`: the signaling routes (`POST` and `GET /rooms/{code}/messages`), the messages store (memory and Mongo), a token check without a database read, the seat cache. The room delete and `DELETE /me` also delete messages. Tests.
- `apps/web`: the signaling client, the connection (`peer.js`), Yjs sync over the `sync` channel, the start of the connection in a multiplayer room, the players and the connection status in the room toolbar, the camera turn for Red, the version check and `?build`.
- A new connection after the other page closes or reloads (decision 8).
- The guest's table writer pauses while the two browsers are connected (decision 11).
- Docs.

Left for later steps:
- Live moves of models and tokens, the `poses` channel, claims, Yjs awareness: step 9 (decision 9). Until then, a model that one player moves shows at its new place on the other screen only after the room opens again.
- A dropped network, "Reconnecting", ICE restart: step 11 (decision 8).
- `GET /ice` and TURN credentials: step 13 (decision 13).
- Local coturn and `?relay`: Phase 5, only if a browser pair cannot connect directly.

## Rules for every phase

- Read `CLAUDE.md`, `docs/plans/implement-backend.md` ("Rules for every step", "Step 8"), this plan, and the design sections named above.
- Do not open the app in a browser. Do not start the dev server. The user checks the app.
- Do not run `aws`, `cdk deploy` or `put-secrets`. `cdk synth` is fine. `infra/` does not change in this step.
- Do not commit and do not push. The main model commits each finished phase.
- Temporary files go in the session's scratchpad directory.
- Keep tool output small (`head`, `grep`, `tail`, summaries).
- Code: TypeScript, strict, in `apps/api`. Plain JavaScript in `apps/web`. Plain, short comments that say why. Match the style of the code around you.
- Web tests run with `node --test`. A module under test must not import `api/client.js` or other modules that read `import.meta.env`. Pass the API calls, the timers and `RTCPeerConnection` in as arguments.
- Never log a token, a secret, the `Authorization` header or an SDP.
- After a code change: `pnpm format` and `pnpm lint`.
- Docs: short sentences, common words, one fact per sentence. Never the word "comprehensive".
- If a check fails and the fix is not in this plan, stop and report. Do not change the plan's decisions on your own.

## Names

| Thing | Value |
|---|---|
| Roles | The room's host answers. The guest makes the offer (design, "Connect flow"). Either player can open the room first |
| Peer id | `crypto.randomUUID()`, new at each table open (decision 2). Format `^[A-Za-z0-9_-]{8,64}$` |
| Message types | `hello` (data: the build id), `offer` and `answer` (data: the SDP), `bye` (data: empty) |
| `to` | A peer id, or `*` for `hello` and `bye` |
| Message id | 13 digits of the server time in ms, `-`, 8 random base64url characters. Sorts by time |
| Limits | `data` at most 8 KB. Body at most 16 KB (413). 50 messages per room (429). A poll returns at most 50 |
| Collection | `messages`: `{ _id: id, room, from, to, type, data, user, expiresAt }`. Indexes `{ room: 1, _id: 1 }` and TTL `{ expiresAt: 1 }` with `expireAfterSeconds: 0`. `expiresAt` is 1 hour after the write |
| Seat cache | Per API instance, 30 s per room (auth doc, "Identity in peer-to-peer games") |
| New web dependencies | `y-protocols@1.0.7`. `lib0` at the version in `pnpm-lock.yaml` (`0.2.119`), because the web code imports it directly |
| Data channel | `sync`: `negotiated: true`, `id: 0`, reliable and ordered. `binaryType = 'arraybuffer'` |
| Frames on `sync` | Byte 0: `0` a whole message, `1` a part with more to come, `2` the last part. At most 16 KB per frame (decision 10) |
| Messages on `sync` | y-websocket layout: a varUint type (`0` sync), then the `y-protocols/sync` message. Type `1` (awareness) comes in step 9 |
| ICE servers | `stun:stun.l.google.com:19302`, `stun:stun.cloudflare.com:3478`, in `net/ice.js` (decision 13) |
| Times | Poll every 2 s. ICE gathering at most 3 s. Offer without answer: 15 s. Not connected 15 s after the answer: failed. No message from the other player for 15 min: polling stops |
| Build id | `import.meta.env.VITE_BUILD_ID`: Netlify's `COMMIT_REF`, or `dev` (decision 14) |

API answers:

| Request | Body | Answer |
|---|---|---|
| `POST /rooms/{code}/messages` | `{ from, to, type, data }` | 201 `{ id }`. 400 bad body. 401. 403 no seat. 404. 413. 429 |
| `GET /rooms/{code}/messages?to={peer}` | Header `x-after`, optional | 200 `{ messages }`: to `peer` or `*`, not from `peer`, id after `x-after`, the oldest first. 400 bad `to` or `x-after`. 401. 403. 404 |

- A message in an answer: `{ id, from, to, type, data, user }`. `user` is `{ id, name, avatar, discordId }`, set by the server (auth doc). The server ignores a `user` field in the body.
- Error texts: `Invalid message`, `Too many messages in this room`. The others are the texts of step 7.

Connection states, for the UI:

| State | Means | Toolbar text next to the other player |
|---|---|---|
| `waiting` | Polls. The other player's page is not seen | "Waiting" |
| `connecting` | Offer or answer sent | "Connecting" |
| `connected` | The `sync` channel is open | "Connected" |
| `failed` | The answer came, but ICE did not connect. Polls go on | "Could not connect" and **Try again**. The title has the design's text: "Could not connect directly. One of the networks blocks peer-to-peer connections." |
| `stopped` | 15 min with no message from the other player. No polls | "Not here" and **Try again** |
| `gone` | A poll got 404: the room was deleted | The lobby opens with "The host deleted room K7Q2-M9XD." |

Files:

```
apps/api/src/
  app.ts                      mounts the signal routes, makes one seat cache
  middleware/session.ts       requireSession: checks the token, reads no user (decision 4)
  rooms/seats.ts              createSeatCache: the seats of a room, 30 s
  routes/signal.ts            POST and GET /rooms/{code}/messages, newMessageId, isMessageId
  routes/rooms.ts             DELETE /rooms/{code}: + the room's messages
  routes/me.ts                DELETE /me: + the user's messages
  stores/store.ts             + MessagesStore, MessageDoc
  stores/memory.ts            + messages
  stores/mongo.ts             + messages, indexes
apps/api/test/
  signal.test.ts, seats.test.ts, signal.mongo.test.ts
  rooms.test.ts, me.test.ts   + the message cleanup
apps/web/
  vite.config.js              VITE_BUILD_ID
  src/api/client.js           + headers
  src/rooms/serverStore.js    + postMessage, getMessages
  src/rooms/serverTable.js    + pause (decision 11)
  src/net/ice.js              the STUN list
  src/net/debugFlags.js       ?build, dev builds only
  src/net/signaling.js        hello, offer, answer, bye, poll with x-after
  src/net/peer.js             connectRoom: roles, timeouts, states
  src/net/syncChannel.js      Yjs sync over the sync channel, 16 KB frames
  src/Table.jsx               starts the connection in a multiplayer room, pauses the guest's writer, 404 of a poll
  src/App.jsx                 camera for Red, connection props, version warning
  src/components/RoomPlayers.jsx   avatars, names, status, Try again
  src/components/Toolbar.jsx  shows RoomPlayers in a multiplayer room. Copy link hides when the guest is seen
  src/index.css               styles of RoomPlayers
```

## Decisions that fill gaps in the design

1. **Both players post `hello` and poll.** The design has a host who presses **Host game** and waits. In a multiplayer room, either player can open the room first. So each browser posts `hello` when the table opens, and polls every 2 s. The guest makes the offer when it sees a `hello` of the host (design: the guest offers, so the offer and the answer are made seconds apart).
2. **Peer id per table open.** The design keeps the peer id in `sessionStorage`. A browser copies `sessionStorage` when a tab is duplicated, so two tabs could share one id. Decision 3 makes a stable id unnecessary. So `Table.jsx` makes a new id each time the table opens.
3. **`hello` and `bye` replace the user's older messages.** Before the server stores a `hello` or a `bye`, it deletes the messages of the same user in the room. Reasons:
   - A reload leaves no old `hello` behind, so the other browser does not offer to a page that is closed.
   - A room keeps a few messages. So the limit of 50 is reached only by abuse, also when testers reload often.
4. **Polls do not read the user.** `requireUser` reads the user from Mongo on every request. A poll every 2 s would then cost two Atlas reads. So:
   - `requireSession` checks only the token and sets `userId`. The signal routes use it.
   - The seat cache keeps `{ blue, red }` of a room, or `null` for a room that does not exist, for 30 s (`store.rooms.get`). It answers 403 and 404.
   - `POST` reads the user, because it adds `user` to the message. A page posts about 3 messages.
   - A deleted user with a valid token can poll a room where they keep a guest seat. They see only signaling messages. Accepted.
5. **The poll cursor.** The poll sends the last id it got in `x-after`. The URL has only `to`, so it stays the same between polls (backend doc, "Preflight per URL"). A message whose id is older than a message already read, but stored later, is missed. The window is the time of one Mongo write. The timeouts of decision 7 recover from it (risk 2).
6. **The handshake.** Non-trickle ICE, as in the design: the browser waits until ICE gathering ends, at most 3 s, then posts the SDP with the candidates it has.
   - The guest offers to each new `hello` of the host. A newer `hello` of the host ends the attempt in progress, and the guest offers to the new one.
   - The host answers each offer to its peer id. A new offer ends the attempt in progress or the old connection: the guest's page is new.
   - Each attempt has its own `RTCPeerConnection`. The old one is closed.
7. **Timeouts.**
   - An offer with no answer after 15 s: the host's page is gone. The state goes back to `waiting`, and the guest does not offer to that `hello` again.
   - No connection 15 s after the answer, or `connectionState` is `failed`: the state is `failed`. Polls go on, so a new `hello` or offer starts a new attempt.
   - 15 min with no message from the other player: polls stop, the state is `stopped`. So a forgotten tab does not poll forever (design).
   - **Try again** posts a new `hello` and starts the 15 min again. The guest also offers again to the host's latest `hello`.
8. **A new connection after the other page closes.** The design gives reconnect to step 11. But testers reload and close tabs all the time, and the rules above handle it with no extra code: when the `sync` channel closes or `connectionState` is `failed`, the state goes back to `waiting`, with the same peer id, and polls start again. The other page posts a new `hello` (as host) or a new offer (as guest). Yjs syncs what changed in between. Step 11 keeps the network cases: a dropped network, a sleeping laptop, the "Reconnecting" message, ICE restart, and the checks for lost changes.
9. **One channel and no awareness in this step.** The design has the `sync` channel with Yjs sync and awareness, and the `poses` channel. In this step:
   - Only `sync`, as a negotiated channel with id 0. Both browsers create it before the offer and the answer, so there is no `ondatachannel` race.
   - The `poses` channel (id 1) and awareness come in step 9, which uses them for poses and claims. A channel added after the connection needs no new offer, because the data channel transport exists already.
   - Names and sides come from the room and from the `user` of the messages, which the server sets. So step 8 shows them without awareness.
10. **Frames of 16 KB.** The first sync of a long game is about 35 KB. The design says to check `pc.sctp.maxMessageSize` and split. Its value differs between browser pairs. So `syncChannel.js` always splits a message above 16 KB, a size that works in every pair, and does not read the value. The sync channel is ordered and reliable, so the parts arrive in order.
11. **The guest's writer pauses while connected.** The auth doc says that when both players are connected, only the host writes the table, because both browsers have the same document. So:
    - `watchServerTable` gets `pause(paused)`. While paused, a change does not start the 60 s timer. `flush()` still writes, on **← Lobby** and on a hidden tab.
    - `Table.jsx` pauses the guest's writer when the state is `connected`, and resumes it when the state changes. On resume, a waiting change starts the timer.
    - The host's writer counts changes from the guest, because their origin is not `'server'`. So the host writes them.
    - Reasons: it halves the table writes, and Atlas M0 allows 10 GB out per week (backend doc, "Free cluster limits"). Two writers would also write at the same moment after each change, because both timers start when the change syncs.
12. **The guest learns about a delete from the poll.** Step 7 (decision 15) planned that the host's browser tells the guest over the connection. But the host deletes only from the lobby, where its room is not open and has no connection. So:
    - While the guest waits for the host, it polls. When the room is deleted, a poll gets 404 within 32 s (the seat cache plus one poll). The guest's browser then opens the lobby with "The host deleted room K7Q2-M9XD." and deletes its copy, the same as the writer's 404.
    - A guest whose polls stopped (15 min) finds out at the next write, as in step 7.
    - No new message type.
13. **ICE servers in the web app.** The design's `GET /ice` returns the ICE server list, and later TURN credentials. In this step the list has only the two free STUN servers. So it is a constant in `net/ice.js`, and a connect makes no extra request. `GET /ice` comes with the TURN credentials in step 13.
14. **Build id and version check.**
    - `vite.config.js` sets `import.meta.env.VITE_BUILD_ID` to `process.env.COMMIT_REF` (Netlify sets it to the git commit), or `dev`.
    - `hello` carries it. When the other player's `hello` has another build id, both players see a HUD warning: "Your opponent uses a different version of the app. Both players should reload the page." The connection still runs.
    - `?build=<text>` in a dev build sends `<text>` instead (`net/debugFlags.js`, design "Debug flags").
15. **Identity.** The browser uses a message only when:
    - its `user.id` is not the own user id. So a second tab of the same user is ignored.
    - for an `offer` or an `answer`: its `user.id` equals the `user.id` of the `hello` with the same `from` (auth doc).
16. **Players in the room toolbar** (`RoomPlayers.jsx`). Only in a multiplayer room.
    - Blue and Red: avatar (`avatarUrl`), name, in the side color. "Free seat" or "Deleted player" as in the lobby tile. The own seat says "You".
    - The other player gets the status text of "Names", and **Try again** for `failed` and `stopped`.
    - When the guest seat was free at open, the name and avatar come from the guest's `hello`. **Copy link** hides when it arrives.
17. **Camera for Red.** In a multiplayer room where the user has the Red seat, the start view is the Blue view turned 180° around the mat center: position `[0, 32.5, -42.9]`, target `[0, 0, -10.4]`. Space returns to it. Single player rooms and the Sandbox keep the Blue view, because one player plays both sides there. The camera controls move relative to the view, so they need no change.
18. **Writes outside a player action.** After the connection, each document write that runs in an effect or a physics callback runs in both browsers. Phase 3 lists each such write in its **Result**. One is known: a new character's model falls asleep in both browsers, and both write its rest pose. This is accepted until step 9. A write that makes random ids in an effect would add the same thing twice. Phase 3 reports it and does not fix it.
19. **Messages of a deleted room or user.** The SDP has the player's public IP address. So `DELETE /rooms/{code}` also deletes the messages of the room, and `DELETE /me` deletes the messages of the user. The TTL deletes the rest after 1 hour.
20. **`bye`.** When the table closes (**← Lobby**, the page closes or reloads), the browser posts `bye`. On a page close it uses `keepalive`. It is best effort: in production, a `keepalive` request with an `Authorization` header needs a preflight, which a closing page may not send (risk 4). Without `bye`, the other browser finds out by the timeouts of decision 7. A `bye` of the other player ends the attempt in progress, and the state goes to `waiting`.

## Phase 1: Signaling routes

Read: peer-to-peer doc "Signaling service" ("Data", "Endpoints"), "Security and abuse". Auth doc "Identity in peer-to-peer games". Decisions 3 to 5, 19. `apps/api/src/*`, `apps/api/test/*`.

Work:
1. `stores/store.ts`: `MessageDoc`, `MessagesStore`:
   - `add(message)`.
   - `deleteFromUser(room, userId)`: for `hello` and `bye` (decision 3).
   - `count(room)`.
   - `list(room, peer, after, limit)`: to `peer` or `*`, not from `peer`, `_id` after `after` (or all when `after` is null), sorted by `_id`.
   - `deleteRoom(room)`, `deleteUser(userId)`.
   - `Store` gets `messages`.
2. `stores/memory.ts`, `stores/mongo.ts`: the messages store. Mongo: the two indexes of "Names", in the shared index promise.
3. `middleware/session.ts`: `requireSession` (decision 4). The same 401 as `requireUser`.
4. `rooms/seats.ts`: `createSeatCache(store, { ttl, now })`. `seats(code)` returns `{ blue, red }` or `null`. A code of another format is `null` with no store call.
5. `routes/signal.ts`:
   - `POST`: `bodyLimit` 16 KB (413), `requireSession`, seat (403, 404), the zod/mini body (400 `Invalid message`), the user read (401 when gone), decision 3, the count (429), `add`. 201 `{ id }`.
   - `GET`: `requireSession`, `to` and `x-after` checks (400), seat, `list`. 200 `{ messages }`.
   - No log line per poll. The request log of step 2 stays.
6. `app.ts`: one seat cache per app, the signal routes.
7. `routes/rooms.ts`: `DELETE /rooms/{code}` also calls `messages.deleteRoom`. `routes/me.ts`: `DELETE /me` also calls `messages.deleteUser`.
8. Tests:
   - `signal.test.ts`: post and poll between two seated users. The answer has `user` from the server, and a `user` in the body is ignored. A poll does not return own messages, or messages to another peer. `x-after` returns only newer ones. A second `hello` of a user deletes the user's older messages, and not the other user's. `bye` does the same. Unknown type, bad peer id, `data` above 8 KB: 400. Body above 16 KB: 413. The 51st message: 429. No token: 401. A third user: 403. Unknown room: 404. Bad `x-after`: 400. A poll does not call `users.get` (wrap the store).
   - `seats.test.ts`: one store read for two calls within 30 s, a new read after 30 s, `null` for an unknown room, no read for a bad code.
   - `rooms.test.ts`: the room delete removes its messages. `me.test.ts`: `DELETE /me` removes the user's messages.
   - `signal.mongo.test.ts`: the store calls on Mongo, the two indexes exist, the TTL one with `expireAfterSeconds: 0`.

Checks:
- `pnpm --filter api typecheck`, `pnpm --filter api test`, `pnpm --filter api test:mongo` pass.
- `pnpm --filter infra test` and `pnpm --filter infra synth` pass. Give the size of the Lambda `index.mjs` (956,348 bytes after step 7).
- `pnpm format`, `pnpm lint`: no new errors.

### Result

## Phase 2: Connection modules

Read: peer-to-peer doc "How a WebRTC connection starts", "Connect flow", "Data channels". Decisions 1, 2, 5 to 11, 13, 15, 20. `apps/web/src/api/client.js`, `rooms/serverStore.js`, `rooms/serverTable.js` (+ test). The `y-protocols` sources: `sync.js`. The y-websocket provider, for the message layout. MDN for `RTCPeerConnection`, negotiated data channels, `iceGatheringState`.

Work:
1. `pnpm --filter web add y-protocols@1.0.7 lib0@0.2.119`.
2. `api/client.js`: a `headers` option.
3. `rooms/serverStore.js`: `postMessage(code, message, { keepalive })`, `getMessages(code, peer, after)`.
4. `net/ice.js`: the STUN list.
5. `net/signaling.js`: `createSignaling({ code, peerId, post, get })`: `hello(build)`, `offer(to, sdp)`, `answer(to, sdp)`, `bye({ keepalive })`, `poll()`. `poll` keeps the cursor and returns the new messages. Errors keep their `status`.
6. `net/syncChannel.js`: `syncOverChannel(doc, channel)`: sends sync step 1 when the channel opens, answers sync messages, sends each document update whose origin is not this channel. Applies remote updates with this channel as the origin. Frames of decision 10. Returns `{ stop }`.
7. `net/peer.js`: `connectRoom({ role, userId, peerId, build, signaling, createPeerConnection, iceServers, timers, onState, onChannel })`. The rules of decisions 1, 6, 7, 8, 15, 20. Returns `{ retry, stop }`. `onState({ state, peer, versionMismatch })`: `peer` is the `user` of the other player's latest `hello`. `onChannel(channel)` when the `sync` channel opens. `stop()` posts `bye`, ends the polls and closes the connection.
8. `rooms/serverTable.js`: `pause(paused)` (decision 11).
9. Tests (`node --test`, `mock.timers`, a fake `RTCPeerConnection` and a fake signaling):
   - `signaling.test.js`: the cursor goes into `x-after` of the next poll. `bye` passes `keepalive`.
   - `syncChannel.test.js`: two documents over two linked fake channels end equal, both ways. A change after the first sync arrives. A 100 KB update arrives in parts of at most 16 KB. An update applied from the channel is not sent back.
   - `peer.test.js`: guest and host connect in both orders of opening. A `hello` of the own user is ignored. An offer whose `user` differs from its `hello` is ignored. A newer `hello` of the host makes a new offer and closes the old connection. No answer in 15 s: `waiting`, and no new offer to that `hello`. `failed` 15 s after the answer. A closed channel: `waiting`, polls again. 15 min without a message from the other player: `stopped`, no polls. **Try again**: a new `hello`, and the guest offers again. Poll 404: `gone`. Another build id: `versionMismatch`. `stop()` posts `bye` and closes the connection. A `bye` of the other player: `waiting`.
   - `serverTable.test.js`: a change while paused starts no timer, `flush()` still writes, resume starts the timer for a waiting change.

Checks:
- `pnpm --filter web test`, `pnpm --filter web build` pass.
- `pnpm format`, `pnpm lint`: no new errors.

### Result

## Phase 3: The room connects

Read: decisions 11, 12, 14 and 16 to 18. `apps/web/src/Table.jsx`, `App.jsx` (camera, `resetCamera`, `serverWarning`), `components/Toolbar.jsx`, `components/CopyLinkButton.jsx`, `components/Lobby.jsx` (the seats of a tile), `auth/avatar.js`, `vite.config.js`.

Work:
1. `vite.config.js`: `VITE_BUILD_ID` (decision 14). `net/debugFlags.js`: `?build`, only when `import.meta.env.DEV`.
2. `Table.jsx`, in a multiplayer room, after the writer starts:
   - A new peer id, `createSignaling` with the `serverStore` calls, `connectRoom` with the role from `room.host`.
   - `onChannel`: `syncOverChannel(doc, channel)`. Its `stop` runs when the channel closes or the table closes.
   - `onState`: the guest's writer pauses on `connected` and resumes on the other states (decision 11). `gone` does what the writer's `onGone` does (decision 12). The state goes to App as a prop.
   - On close: `stop()` of the connection and of the sync. On `pagehide`: `bye` with `keepalive` (decision 20).
3. `App.jsx`:
   - The start view of decision 17, for `CAMERA_POSITION`, `CAMERA_TARGET` and `resetCamera`.
   - The connection prop goes to the toolbar. The version warning shows like `serverWarning`.
4. `components/RoomPlayers.jsx` (decision 16) and its styles in `index.css`. `Toolbar.jsx` shows it in a multiplayer room, and hides **Copy link** when the guest is seen.
5. The list of decision 18: search for document writes that run in an effect, a timer or a physics callback. Put the list in the **Result**.

Checks:
- `pnpm --filter web test`, `pnpm --filter web build` pass.
- `pnpm format`, `pnpm lint`: no new errors.
- A single player room and the Sandbox make no signaling call: the **Result** names the check in the code.

### Result

## Phase 4: Docs

Work:
1. `docs/feature-peer-to-peer.md`:
   - Status line.
   - "Endpoints": the answers of "Names". `GET /ice` comes in step 13 (decision 13).
   - "Connect flow": both players post `hello` (decision 1), `hello` and `bye` replace older messages (decision 3), the timeouts (decision 7), the new connection after a close (decision 8), the guest learns about a delete from the poll (decision 12). No **Host game** button.
   - "Data channels": one negotiated channel in step 8, `poses` and awareness in step 9, frames of 16 KB (decisions 9, 10).
   - "Room and players": no peer id in `sessionStorage`, no typed name. The camera for Red.
   - "Code layout": the files of this step.
2. `docs/feature-auth.md`: "Identity in peer-to-peer games": polls check only the token (decision 4). "Rules" and "Table on the server": decisions 11 and 12. "Endpoints": the messages routes. Status line.
3. `docs/feature-backend.md`: "Code" (`routes/signal.ts`, `middleware/session.ts`, `rooms/seats.ts`), "Database" (`messages`).
4. `docs/plans/implement-backend.md`: a short **Result** under step 8. Step 9: the `poses` channel and awareness. Step 11: what decision 8 leaves for it. Step 13: `GET /ice`.
5. `README.md`: two browsers in local dev, and what the toolbar status means.

Checks:
- `pnpm test` at the root passes.
- `pnpm format`, `pnpm lint`: no new errors.

### Result

## Phase 5: Local coturn and `?relay`

Only if a browser pair of the user checks cannot connect directly (peer-to-peer doc, "Browser differences", the mDNS risk). Planned after the user checks, with what they show.

## User

After Phase 1:
1. `pnpm --filter infra cdk:deploy`.
2. `curl -i -X POST <ApiUrl>/rooms/AAAA-AAAA/messages` → 401. `curl -i "<ApiUrl>/rooms/AAAA-AAAA/messages?to=abcdefgh"` → 401.

After Phase 3, with `pnpm dev`. Do checks 3 to 8 in each pair: Chrome and Safari, Chrome and Firefox, Safari and Firefox. The first browser is Alice, the second is Bob.
3. Alice: dev login `alice`, create a multiplayer room on **Red**. The view shows the Red side at the bottom. Space returns to it. The toolbar shows Alice (You) in Red and "Free seat" in Blue.
4. Bob: dev login `bob`, open the link, join. Within a few seconds both toolbars show "Connected". Alice's toolbar shows Bob's avatar and name, and **Copy link** is gone.
5. Each player, while the other watches: turn the mat, choose a crisis card in the setup, flip a token, add a character from the tray, change damage and power, flip a character card to injured. Each change shows on the other screen at once.
6. Bob reloads. Alice shows "Waiting", then "Connected". Bob's changes made before the reload are there. Then Alice reloads, the same.
7. Bob: **← Lobby**. Alice makes two changes. Bob opens the room: he sees both changes.
8. DevTools → Network:
   - While connected: no `messages` requests. Alice (the host) sends `PUT .../table` 60 s after a change. Bob sends it only on **← Lobby** or when his tab is hidden.
   - Bob alone in the room: a `GET .../messages` every 2 s.

Once, in one pair:
9. Bob: open the room, Alice not in it. Alice: in the lobby, **Delete** the room. Within about 30 s Bob's browser opens the lobby with "The host deleted room ...".
10. Alice: create a new room, open it as `http://localhost:5173/?build=test#room=<code>`. Bob joins. Both see the version warning.
11. A single player room and the Sandbox: work as before, and make no `messages` request.
12. A long game: play some rounds in one room until the table is above 30 KB (the `PUT .../table` size in DevTools). Bob reloads: the table syncs. Do it in each pair.

### User check results

## Done when

- `pnpm test`, `pnpm typecheck`, `pnpm --filter web build` pass. `pnpm lint` has no new errors.
- The user checks pass in the three browser pairs.
- The API with the signal routes is deployed. Production shows no login and no multiplayer rooms.
- The **Result** of each phase is filled in.

## Risks and open questions

1. **mDNS on one Mac.** All three browsers can hide local addresses behind `*.local` names. It is not tested whether each pair resolves the other's names. If a pair cannot connect, Phase 5 adds coturn and `?relay`.
2. **A missed message** (decision 5). A message stored in the same moment as a newer one can be skipped by the poll. The offer timeout and **Try again** recover from it.
3. **Rest poses from both browsers** (decision 18). Until step 9, both browsers write the rest pose of a body that falls asleep. A model that one player moved can move back on the other screen when its body wakes there.
4. **`bye` on page close.** In production, the `keepalive` request needs a preflight. If the browser does not send it, the other player waits for the timeouts of decision 7. Production has no multiplayer until step 12, so this shows first there.
5. **Hidden tabs.** Chrome slows the timers of a tab that is hidden for 5 minutes to one per minute. A hidden page then polls slowly, and the connect takes longer. Accepted.
6. **Table writes while connected.** Only the host writes (decision 11). If the host's page closes without its hidden-tab write, the guest's writer resumes and writes the whole document. So no change is lost, but the server can have an older table for up to 60 s.
