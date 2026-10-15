# Step 8: Two browsers

Detailed plan of step 8 in `docs/plans/implement-backend.md`. Peer-to-peer phase 2 and auth phase 3. The design is in `docs/features/peer-to-peer.md` ("How a WebRTC connection starts", "Signaling service", "Connect flow", "Data channels", "State", "Room and players", "Local testing", "Debug flags") and `docs/features/auth.md` ("Identity in peer-to-peer games", "Table on the server"). Decisions 2, 3, 8, 9, 12 and 13 change parts of the design. The user agreed on 2026-10-09.

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
  src/rooms/RoomPlayers.jsx   avatars, names, status, Try again
  src/ui/Toolbar.jsx  shows RoomPlayers in a multiplayer room. Copy link hides when the guest is seen
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
   - A cached entry is used only when it gives the user a seat. Otherwise the store is read again, so a guest who just joined is not refused.
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

Added in `apps/api`:
- `POST` and `GET /rooms/{code}/messages` in `routes/signal.ts`, with `newMessageId` and `isMessageId`.
- `requireSession` in `middleware/session.ts`: token only, no user read.
- `createSeatCache` in `rooms/seats.ts`: 30 s per room, injectable `now`. One cache per app, made in `app.ts`.
- `MessagesStore` in `store.ts`, in memory and in Mongo. Mongo indexes `{ room: 1, _id: 1 }` and TTL `{ expiresAt: 1 }` are in the shared index promise.
- `DELETE /rooms/{code}` and `DELETE /me` delete messages.
- Tests: `signal.test.ts`, `seats.test.ts`, `signal.mongo.test.ts`, plus cases in `rooms.test.ts` and `me.test.ts`.

Tests: api unit 93 -> 112. Mongo project: 19 pass, with 3 new in `signal.mongo.test.ts`. Infra 16 pass.

Lambda `index.mjs`: 961,323 bytes (956,348 after step 7).

Checks: typecheck, api test, test:mongo, infra test, infra synth pass. `pnpm lint` has 0 errors (warnings in `apps/web` are old).

Notes:
- The message `user` is `{ id, name, avatar, discordId }` (type `MessageUser`). Mongo deletes by `user.id`.
- The body is parsed in the handler, not with `validate`, so the 400 text is `Invalid message`. The seat check runs before the body check.
- `offer` and `answer` need a peer id in `to`. Only `hello` and `bye` may use `*`.
- `data` limit is 8192 characters.
- A poll with a bad `to` or `x-after` answers 400 `Invalid request` before the seat check.
- The request log line of step 2 stays for every request, polls too. It has no query and no headers.

- Seat cache fix: `seats(code, userId)` uses a cached entry only when it gives the user a seat, else it reads the store again. An unknown room is read each time (no 30 s cache for 404). A seated user still gets the cached answer, so a deleted room shows as 404 after at most 30 s.

Deviations: none.

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

Added in `apps/web`:
- Dependencies `y-protocols@1.0.7` and `lib0@0.2.119` (exact versions).
- `api/client.js`: `headers` option. `rooms/serverStore.js`: `postMessage(code, message, { keepalive })`, `getMessages(code, peer, after)`.
- `net/ice.js`: the two STUN servers (`ICE_SERVERS`).
- `net/signaling.js`: `createSignaling({ code, peerId, post, get })` with `hello(build)`, `offer(to, sdp)`, `answer(to, sdp)`, `bye({ keepalive })`, `poll()`. `post(code, message, options)` and `get(code, peer, after)` are the `serverStore` functions.
- `net/syncChannel.js`: `syncOverChannel(doc, channel)` returns `{ stop }`. The channel must be open or about to open. It uses `addEventListener`, so the caller can add its own `close` listener. Origin of remote updates is the channel object.
- `net/peer.js`: `connectRoom`, and the time constants (`POLL_MS`, `GATHER_MS`, `OFFER_MS`, `CONNECT_MS`, `IDLE_MS`).
- `rooms/serverTable.js`: `pause(paused)`. A running timer is cleared on pause. Resume starts it when a change waits.

Signature:

```js
connectRoom({ role, userId, peerId, build, signaling, createPeerConnection, iceServers,
  timers = { setTimeout, clearTimeout }, onState, onChannel }) -> { retry(), stop({ keepalive }) }
```

- `role`: `'host'` or `'guest'`. `userId`: the own user id. `createPeerConnection({ iceServers })` returns an `RTCPeerConnection`.
- `onState({ state, peer, versionMismatch })`: `state` is `waiting`, `connecting`, `connected`, `failed`, `stopped` or `gone`. `peer` is the `user` (`{ id, name, avatar, discordId }`) of the other player's latest `hello`, or `null`. `versionMismatch` is a boolean. It is called at start (`waiting`) and only when one of the three values changes.
- `onChannel(channel)`: the `sync` channel is open. Call `syncOverChannel` there.
- `retry()` is async (posts `hello`). `stop({ keepalive })` returns a promise that resolves when `bye` is sent (errors are swallowed). After `gone` or a `stop`, both do nothing.

Tests: web 60 -> 97 (signaling 4, syncChannel 7, peer 21, serverTable 5 new).

Checks: `pnpm --filter web test`, `pnpm --filter web build` pass. `pnpm lint`: 0 errors, 44 warnings (same as before). `pnpm format` done.

Notes:
- Polls stop while `connected`, as the plan says. So a `bye` of the other player is seen only after the channel closes. A message that was in flight when the channel opened is still handled (a new offer from a reloaded guest ends the old connection).
- A failed post of `offer` or `answer` (not 404) ends the attempt and gives `waiting`. A 404 there gives `gone`. A failed post of `hello` is ignored, except 404.
- The offer timeout (15 s) does not restart the 15 min. The 15 min restart only on a message of the other player, on start and on `retry()`.
- A `bye` forgets the `hello` of that peer id, so an old offer of it is ignored and `retry()` does not offer to it.
- Phase 3 must call `stop()` in the table cleanup. For `pagehide` use `stop({ keepalive: true })`. `onState` can come with `gone` once: do what the writer's `onGone` does.

Deviations: none.

## Phase 3: The room connects

Read: decisions 11, 12, 14 and 16 to 18. `apps/web/src/Table.jsx`, `App.jsx` (camera, `resetCamera`, `serverWarning`), `ui/Toolbar.jsx`, `rooms/CopyLinkButton.jsx`, `rooms/Lobby.jsx` (the seats of a tile), `auth/avatar.js`, `vite.config.js`.

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
4. `rooms/RoomPlayers.jsx` (decision 16) and its styles in `index.css`. `Toolbar.jsx` shows it in a multiplayer room, and hides **Copy link** when the guest is seen.
5. The list of decision 18: search for document writes that run in an effect, a timer or a physics callback. Put the list in the **Result**.

Checks:
- `pnpm --filter web test`, `pnpm --filter web build` pass.
- `pnpm format`, `pnpm lint`: no new errors.
- A single player room and the Sandbox make no signaling call: the **Result** names the check in the code.

### Result

Added in `apps/web`:
- `vite.config.js`: `define` of `import.meta.env.VITE_BUILD_ID` from `process.env.COMMIT_REF`, else `dev`.
- `net/debugFlags.js`: `buildOverride()` returns `?build=<text>` in a dev build, else `null`. `Table.jsx` sends `buildOverride() ?? VITE_BUILD_ID`.
- `Table.jsx`: in a multiplayer room, after the writer starts, a new peer id, `createSignaling` with `postMessage` and `getMessages`, `connectRoom` with the role from `room.host === userId`. `onChannel` calls `syncOverChannel` and stops it on the channel `close` event. `close()` stops the sync and the connection. `pagehide` calls `stop({ keepalive: true })`. The guest's writer pauses on `connected` and resumes on the other states. `gone` does what the writer's `onGone` does. App gets a `connection` prop: `{ state, peer, versionMismatch, retry }`, or `null`.
- `App.jsx`: Red start view (decision 17) for the Canvas camera, the OrbitControls target and `resetCamera`, when `room?.multiplayer && room.side === 'red'`. The version warning (decision 14 text) is a closable `hud-warning`. It shows again after the mismatch ends and comes back. `side`, `players` and `connection` go to the toolbar.
- `rooms/RoomPlayers.jsx` and styles in `index.css` (`.room-player*`). `Toolbar.jsx` shows it in a multiplayer room.

UI choices:
- One row, two seats: team name in the side color, avatar, name. The own seat ends with "You". The other seat ends with the status text, and **Try again** (a chip) for `failed` and `stopped`. The "Could not connect" title has the design text.
- A free seat with no `hello` yet shows only "Free seat", with no status. When the guest `hello` arrives, its `user` fills the seat.
- **Copy link** shows while `guestSeatFree` and `connection.peer` is empty. It hides when a peer arrives. If the peer is forgotten later (`bye`), it shows again.
- No status for a "Deleted player" seat.

No signaling call outside a multiplayer room: `createSignaling` and `connectRoom` are called only inside the `if (room?.multiplayer)` block of the open effect in `Table.jsx`. The Sandbox has `room = null` and a single player room has `multiplayer` false, so neither reaches it. `pagehide` and the cleanup use `link.current?.`, which stays `null` there.

Decision 18, writes outside a player action (none is fixed):
1. `scene/Scene.jsx:947` (`onRest`, the Rapier `onSleep` of a model body) calls `onModelRest`, which is `table.poses.setField` (`App.jsx:1443`). Writes the rest pose of the model. No random id. Runs in both browsers.
2. `App.jsx:274`, in an effect on open: `table.rosters.setField(room.side, roster)`, only when the own key is empty. Writes the own roster once. No random id. Each browser writes only its own side, so it does not repeat on the other.
3. `Table.jsx` `fillTable(table, startTable(...))` when the stored table has no schema: writes the whole start table, with random ids (`rooms/table.js:17`). It runs at open, before the connection. A multiplayer room gets its table from the server, so it only runs for a single player room or the Sandbox.

Other effects, timers and frame callbacks I read only set local state, move bodies, or call hover callbacks. `Scene.jsx:420` (held turn) turns a body and writes only through its sleep (item 1). The `crypto.randomUUID()` calls in `App.jsx` are all in handlers (`handleSpawn`, `handleCrisisChange`, `handleSquadReady`, token and card handlers).

Checks: `pnpm --filter web test` 97 pass, `pnpm --filter web build` passes, `pnpm format` done, `pnpm lint` 0 errors, 44 warnings (same as before).

Deviations: none.

## Phase 4: Docs

Work:
1. `docs/features/peer-to-peer.md`:
   - Status line.
   - "Endpoints": the answers of "Names". `GET /ice` comes in step 13 (decision 13).
   - "Connect flow": both players post `hello` (decision 1), `hello` and `bye` replace older messages (decision 3), the timeouts (decision 7), the new connection after a close (decision 8), the guest learns about a delete from the poll (decision 12). No **Host game** button.
   - "Data channels": one negotiated channel in step 8, `poses` and awareness in step 9, frames of 16 KB (decisions 9, 10).
   - "Room and players": no peer id in `sessionStorage`, no typed name. The camera for Red.
   - "Code layout": the files of this step.
2. `docs/features/auth.md`: "Identity in peer-to-peer games": polls check only the token (decision 4). "Rules" and "Table on the server": decisions 11 and 12. "Endpoints": the messages routes. Status line.
3. `docs/features/backend.md`: "Code" (`routes/signal.ts`, `middleware/session.ts`, `rooms/seats.ts`), "Database" (`messages`).
4. `docs/plans/implement-backend.md`: a short **Result** under step 8. Step 9: the `poses` channel and awareness. Step 11: what decision 8 leaves for it. Step 13: `GET /ice`.
5. `README.md`: two browsers in local dev, and what the toolbar status means.

Checks:
- `pnpm test` at the root passes.
- `pnpm format`, `pnpm lint`: no new errors.

### Result

Changed docs:
- `docs/features/peer-to-peer.md`: status line, "Endpoints" (route details, `GET /ice` moved to step 13), "Connect flow" (both `hello`, states, timeouts, new connection after a close, the delete from the poll, build id, the guest's writer), "Data channels" (one channel, frames of 16 KB), "Room and players" (no `sessionStorage` peer id, no typed name, Red camera, toolbar), "Local testing", "Debug flags", "Code layout", phase 2.
- `docs/features/auth.md`: status line, "Rules" (delete from the poll), "Table on the server" (decision 11), "Endpoints" (messages routes), "Identity in peer-to-peer games" (decision 4, decision 15), toolbar text, "Code layout".
- `docs/features/backend.md`: "Code" (`signal`, `session`, `seats`), "Database" (`messages`).
- `docs/plans/implement-backend.md`: step 8 text and **Result**. Steps 9, 11 and 13 got the parts that moved.
- `README.md`: two browsers in local dev, and the status texts.

Where the docs keep history, one sentence says what changed: the removed **Host game** button, the `sessionStorage` peer id and the typed name (peer-to-peer doc, "Room and players"; auth doc), and the host telling the guest about a delete (auth doc, "Rules").

Checks: `pnpm test`, `pnpm format`, `pnpm lint` : `pnpm test` passes (web 97, api 112, infra 16), `pnpm format` done, `pnpm lint` has 0 errors (warnings are old).

Deviations: none.

## Phase 5: Local coturn and `?relay`

### Why

On 2026-10-09 every browser pair showed "Could not connect". `chrome://webrtc-internals` on the guest's Chrome showed:
- Signaling worked: the offer went out, the answer came back, the signaling state became `stable`.
- The answer had only one candidate, of type `srflx` (the public address of the home router). It had no `host` candidate.
- The only candidate pair stayed `in-progress`, and ICE stayed `checking`.

So the two browsers tried to reach each other through the public address of the router. Most home routers do not send such packets back into the same network (no NAT hairpin). The browsers do not share their local addresses, because a page without camera or microphone access gets only `*.local` names (Chrome, Firefox) or no local address at all (Safari). This was risk 1. Between two homes, the `srflx` candidates are the normal path, so production is not affected the same way.

A local TURN server makes the connection work for every pair, with no change in the browsers or the router.

### Decisions

21. **coturn in Docker**, in `apps/api/compose.yaml` next to `mongo`. Image `coturn/coturn:4.18.0`. Port `3478` over UDP and TCP on `127.0.0.1`. User `dev`, password `dev`, realm `localhost`. No TLS. Relay ports `49160-49200`. The relay addresses are inside the container. Both browsers get relay addresses of the same server, so coturn passes the data between the two relay ports inside the container, and the relay ports need no port mapping.
22. **The local TURN server is in the ICE list of every dev build.** `net/ice.js` gets `iceConfig({ dev, relay })`, which returns `{ iceServers, iceTransportPolicy }`. A dev build adds `turn:127.0.0.1:3478?transport=udp` and `?transport=tcp` with the dev user. A production build has only the STUN servers, as before. So in dev each pair connects directly when it can, and through coturn when not. When coturn does not run, ICE gathering ends after 3 s (decision 6), and the direct candidates still work.
23. **`?relay`** (dev builds only, `net/debugFlags.js`) sets `iceTransportPolicy: 'relay'`, so all data goes through coturn (design, "Debug flags").
24. **Start and stop.** `pnpm --filter api turn:up` and `turn:down` start and stop only the `coturn` service. `db:up` and `db:down` start and stop only `mongo`, so a tester who needs one does not need both.

### Work

Read: decisions 6, 13, 21 to 24. `apps/api/compose.yaml`, `apps/api/package.json`, `apps/web/src/net/ice.js`, `net/debugFlags.js`, `net/peer.js` (`createPeerConnection`), `Table.jsx`. The coturn docs for the flags of 4.18 (loopback and private peers, `--lt-cred-mech`, `--no-tls`, `--no-dtls`, `--log-file=stdout`).

1. `apps/api/compose.yaml`: the `coturn` service (decision 21). Only the flags it needs, each with a short comment. If coturn 4.18 refuses relay peers in private ranges by default, allow the container's range.
2. `apps/api/package.json`: `turn:up`, `turn:down`. `db:up` and `db:down` name the `mongo` service (decision 24).
3. `net/ice.js`: `iceConfig({ dev, relay })` (decision 22). `ICE_SERVERS` stays the production list.
4. `net/debugFlags.js`: `relayFlag()` (decision 23).
5. `Table.jsx` and `peer.js`: the connection gets the whole config: `createPeerConnection({ iceServers, iceTransportPolicy })`. The tests of `peer.js` pass the new shape.
6. `ice.test.js`: production has no TURN server and no policy. Dev has the TURN server. Dev with relay has `iceTransportPolicy: 'relay'`.
7. Check that coturn answers: `pnpm --filter api turn:up`, then a small Node script in the scratchpad sends a STUN Binding request over UDP to `127.0.0.1:3478` and gets a Binding success answer. Then `turn:down`.
8. `README.md` ("two browsers"): start coturn with `turn:up`, what `?relay` does. `docs/features/peer-to-peer.md` ("Local testing", "Debug flags"): coturn is in dev from step 8, not from phase 6. The Result of this phase.

Checks:
- `pnpm --filter web test`, `pnpm --filter web build` pass.
- The STUN check of work item 7 passes.
- `pnpm format`, `pnpm lint`: no new errors.

User, after this phase: `pnpm --filter api turn:up`, `pnpm dev`, then the user checks 3 to 12 again. Once in one pair, add `?relay` to both links: they still connect.

### Result

Added:
- `apps/api/compose.yaml`: `coturn` service, image `coturn/coturn:4.18.0`, `127.0.0.1:3478` udp and tcp only.
- `apps/api/package.json`: `turn:up`, `turn:down`. `db:up` and `db:down` now name `mongo` only (`down` is `stop mongo`, so the volume stays).
- `net/ice.js`: `iceConfig({ dev, relay })` returns `{ iceServers, iceTransportPolicy? }`. Dev adds the local TURN (udp and tcp, `dev:dev`). `relay` sets the policy in dev only. `ICE_SERVERS` is unchanged.
- `net/debugFlags.js`: `relayFlag()`.
- `peer.js`: option `iceConfig` replaces `iceServers`. `createPeerConnection(iceConfig)`. `Table.jsx` passes `iceConfig({ dev: import.meta.env.DEV, relay: relayFlag() })` and `new RTCPeerConnection(config)`. `peer.test.js` uses the new shape.
- `net/ice.test.js`: 4 tests. Web tests 97 -> 101.
- Docs: `README.md` (turn:up, `?relay`), `docs/features/peer-to-peer.md` ("Local testing", "Debug flags", file list).

coturn flags: `-n` (no config file), `--log-file=stdout` (see logs with `docker logs`), `--lt-cred-mech` with `--user=dev:dev` and `--realm=localhost` (browsers need a user), `--no-tls` (no certs), `--min-port=49160 --max-port=49200` (small relay range). No flag for peers: coturn 4.18 denies only loopback peers by default (`--allow-loopback-peers` is off), and the relay addresses are the container address, which is private and allowed. No `--external-ip`: the relay address is used only between the two relays inside the container. Relay-to-relay with two real allocations was not run (no browser).

STUN check: Node `dgram` Binding request to `127.0.0.1:3478` got type `0x0101` with the same transaction id (PASS). `turn:up` ran before, `turn:down` after. Port 3478 was free, no container stopped. The log has one harmless `Unknown argument:` line and cert warnings.

Checks: `pnpm --filter web test` 101 pass, `pnpm --filter web build` passes, `pnpm format` done, `pnpm lint` 0 errors, 44 warnings.

Deviations: no `--no-dtls`. coturn 4.18 does not know it (container exited). DTLS is off by default there.

## Phase 6: Secret squads

### Why

The user found on 2026-10-09: in a multiplayer room, each click of **Select squad** on a roster card shows on the other screen at once. The squad is in the Yjs document (`setup.squads`), and step 8 syncs it. The rules say that players choose their squads in secret and do not show them until deployment (rulebook p11, `docs/features/setup-game.md`, "Rules"). So the squad and the Team Tactic cards of a player must stay in that player's browser until both players are Ready.

Today the second **Ready** click puts both squads on the table (`putSquadsOnTable` in `App.jsx`). In a multiplayer room that browser does not know the other squad any more. So each browser puts its own squad on the table.

### Decisions

25. **The own squad stays in this browser.** In a multiplayer room, the squad that the player chooses is not in the document. It is in `localStorage`, key `mcp-assist-3d/squad/<user id>/<code>`, value `{ setupId, squad: { characters, tactics } }`. The functions are in `rooms/store.js`, the only module that uses `localStorage`. So the choice survives a reload, and the server and the other browser never get it before the reveal. Single player rooms and the Sandbox keep the squads in the document, as today: one person plays both sides there.
26. **Ready writes only `ready[side]`.** The check of the threat and of at least 1 character stays. A second click turns Ready off, as today.
27. **Reveal and placement.** When the document has `ready.blue` and `ready.red`, each browser reveals and places the squads of the sides it plays: the own side in a multiplayer room, both sides in a single player room and the Sandbox. For each such side, in one transaction: write the squad into `setup.squads[side]`, add the characters and Team Tactic cards of that squad to the table (the code of `putSquadsOnTable`, for one side), and set `setup.placed[side]`. Then the browser deletes the `localStorage` key.
    - An effect does it, because the second Ready can come from the other browser.
    - The effect reads the document, not React state, and skips a side whose `placed[side]` is set. So a second run (StrictMode, a new render) does nothing.
    - Each browser writes only the sides it plays, so the two browsers never make the same characters (decision 18).
28. **`placed` per side.** `setup.placed` becomes `{ blue: null | { characters, tactics }, red: … }`. Each browser writes only its key. A restart removes what both keys name. `NEW_SETUP` has `{ blue: null, red: null }`. A stored setup with the old shape `{ characters, tactics }` counts as the placed cards of Blue, so a restart of an old single player room still removes them. No schema change, because a new schema makes both browsers of a multiplayer room build a start table (step 7, decision 1).
29. **Setup id.** `setup.id` is a random id, made where a new setup is made: the start table and `restartSetup`. Both run in one browser. A stored squad counts only when its `setupId` equals `setup.id`. So a restart in the other browser makes this browser drop its old choice.
30. **The other player's squad panel.** In a multiplayer room, the panel of the other side shows only "Choosing a squad" or "Ready". It has no threat, no Team Tactic count, no **Select squad** and no **Ready**. A click on the other player's roster cards opens the roster popup. Single player rooms and the Sandbox show both panels, as today.
31. **New step `reveal`.** `setupStep` returns `reveal` when both players are Ready but a side is not placed yet, for example while the other player's page is closed. The panel then says "Waiting for the Red player to reveal their squad." It returns `done` when both sides are placed.
32. **No stored squad at the reveal.** When both players are Ready and this browser has no stored squad for its side (another device, cleared storage), it sets its own `ready` back to false. The HUD says "Your squad choice is not in this browser. Choose it again."
33. **Cleanup.** The lobby deletes the squad keys of this user whose code is not in the room list, in the same cleanup as the IndexedDB copies (step 7, decision 12). `deleteDoc` of a multiplayer room also deletes its squad key.
34. **Accepted race.** A player who turns Ready off at the same moment as the other player turns Ready on can see the other squad early. The window is the time of one sync message. Accepted, as the design accepts other ways to cheat.

### Work

Read: decisions 25 to 34. `docs/features/setup-game.md` ("Squads", "State"). `apps/web/src/setup/setup.js`, the setup parts of `App.jsx` (`restartSetup`, `handleRosterClick`, `handleSquadReady`, `putSquadsOnTable`, the setup panel props), `setup/GameSetup.jsx`, `rosters/RosterCards.jsx` (the squad frame), `Scene.jsx` (when the roster cards leave), `rooms/store.js`, `rooms/localDocs.js`, `rooms/Lobby.jsx` (the cleanup), `rooms/table.js` (`startTable`).

1. `setup/setup.js`: `setup.id` in the new setup (a function, because `NEW_SETUP` is a constant and the id is random), `placed` per side, the reading of the old `placed` shape, `reveal` in `setupStep`, a pure function that says which sides this browser reveals now and with which squad (decisions 27, 31, 32).
2. `rooms/store.js`: read, save and delete the stored squad (decision 25). `rooms/localDocs.js` and `Lobby.jsx`: the cleanup of decision 33.
3. `App.jsx`: in a multiplayer room, the squad of the own side comes from the stored squad, and a click writes there. Ready writes only `ready`. The effect of decision 27. Decision 32. `restartSetup` makes a new setup id and removes both `placed` keys.
4. `GameSetup.jsx`, `RosterCards.jsx`: decision 30, and the `reveal` text of decision 31. No yellow frame on the other player's roster cards.
5. Tests (`node --test`): `setup.test.js` (new): `setupStep` with `reveal`, the old `placed` shape, the reveal function: both Ready reveals only the own side in multiplayer and both sides otherwise, a placed side is skipped, a stored squad of another setup id does not count, no stored squad gives decision 32. `localDocs.test.js`: the squad keys in the cleanup.
6. `docs/features/setup-game.md`: "Squads", "State", "Not built yet" (hidden squads are built for multiplayer rooms). The Result of this phase.

Checks:
- `pnpm --filter web test`, `pnpm --filter web build` pass.
- `pnpm format`, `pnpm lint`: no new errors.
- `grep -rn "localStorage" apps/web/src/rooms apps/web/src/components apps/web/src/App.jsx` shows only `rooms/store.js`.

User, after this phase, in one pair: Alice and Bob each choose a squad with **Select squad**. The other screen shows only "Choosing a squad", with no frames on the cards. Alice clicks Ready: Bob sees "Ready" on her panel, and still no cards. Bob reloads during his choice: his choice is still there. Bob clicks Ready: both squads go on the table on both screens. **Restart setup** in one browser clears the choice in the other. In a single player room, the squad setup works as before.

### Result

Done. `pnpm --filter web test`: 113 pass (12 new). `pnpm --filter web build` passes. `pnpm format` and `pnpm lint`: no new warnings or errors. `localStorage` appears only in `rooms/store.js`.

- `setup/setup.js`: `NEW_SETUP` has `id: null` and `placed: { blue: null, red: null }`. New `newSetup()` makes a random id. New `placedSides` (old `placed` shape reads as Blue; it counts as placed only when both players are Ready, so an old done setup stays done), `placedIds`, `placeSquad` (replaces `activateSquads`), `revealPlan`. `setupStep` returns `reveal`. `setupPlacedCards` uses `placedIds`.
- `setup/setup.test.js` (new, 11 tests): the steps, the old shape, `placeSquad`, `revealPlan` (own side only, both sides in single player, placed side skipped, other setup id, no stored squad).
- `rooms/store.js`: `readSquad`, `saveSquad`, `deleteSquad`, `listSquadCodes`. `deleteDoc` of a multiplayer database name also deletes that room's squad key, so every caller (Lobby delete, 403/404 in `Table.jsx`) is covered.
- `rooms/localDocs.js`: `staleSquadCodes`, `deleteStaleSquads`. `Lobby.jsx` calls it next to `deleteStaleDocs`. One new test in `localDocs.test.js`.
- `rooms/table.js`: the start table uses `newSetup()`.
- `App.jsx`: new prop `userId` (from `Table.jsx`). In a multiplayer room the own squad is React state backed by the stored squad. A click on the other player's roster cards opens the popup. `viewSetup` (own squad, other squad empty) goes to the scene. **Ready** writes only the toggle. `putSquadsOnTable` is now `revealSquad(side, squad)`, run by an effect on `setup` that reads the document. The effect handles decision 32. `restartSetup` makes a new id, removes the ids of both `placed` keys and deletes the stored squad.
- A placed side is final: `handleSquadReady` and `handleRosterClick` ignore a team whose `placedSides(setup)[team]` is set, and its panel says only "Ready". This covers the missing case of decision 32.
- `Scene.jsx`, `GameSetup.jsx`: new prop `mySide`. The other player's panel shows "Choosing a squad" or "Ready". The `reveal` hint names the side not placed.
- `docs/features/setup-game.md`: "Squads", "State", "Code", "Not built yet".

Deviations and notes:
- `deleteDoc` deletes the squad key (see above), not each caller. Same effect as decision 33.
- A `react-hooks/exhaustive-deps` disable on the reveal effect: it reads the document, so its only trigger is `setup`.
- Rooms made before this phase have no `setup.id`. A stored squad then has `setupId: null` and counts.
- If the other browser has revealed its side and this player then has no stored squad, this player's Ready goes off while the other side stays placed. The next Ready reveals only the missing side.

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

- 2026-10-09: every browser pair showed "Could not connect". The reason is in Phase 5 ("Why"). The user agreed to Phase 5 on 2026-10-09.
- 2026-10-09, after Phase 5 with `turn:up`: both sides show "Connected". Checks 5 to 12 are open.
- 2026-10-09: the user reported that the sync works well. They found that the squad choice shows on the other screen while the player chooses. Phase 6 fixes it.
- 2026-10-09, after Phase 6: the user reported that the secret squads work.
- 2026-10-09: the user reported that all checks of step 8 pass, 1 to 12, in the three browser pairs.

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
