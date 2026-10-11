# Step 11: Reconnect

Detailed plan of step 11 in `docs/plans/implement-backend.md`. The rest of peer-to-peer phase 5. The design is in `docs/feature-peer-to-peer.md` ("Connect flow", "Data channels", "Room and players", "Local testing"). Decision 1 changes the design: no ICE restart.

## Goal

After a dropped network or a sleeping laptop, the two browsers connect again by themselves. While they try, both players see "Reconnecting". No change is lost: what a player did during the drop shows on the other screen after the new connection.

After step 10:
- A closed or reloaded page works (step 8, decision 8). The other page posts a new `hello` (as host) or a new offer (as guest).
- A dropped network does not work. The `sync` channel closes, or `connectionState` becomes `failed`, and both browsers go back to `waiting`. Neither posts a new `hello`. The guest offers only when it sees a new `hello` of the host. So both stay at "Waiting" until the 15 minutes end ("Not here"), and a player must press **Try again**.
- `connectionState` `disconnected` is not handled. The toolbar says "Connected" until `failed` comes, which can take about 30 s.
- A message lives 1 hour (TTL). After a game of more than 1 hour, the host's `hello` is gone. A guest that reloads then finds no `hello` and waits.

The step comes before step 4 (CI) and step 12 (first release), because real players on two networks need it.

## Scope

In the step:
- The state `reconnecting` and the text "Reconnecting" (decisions 2 to 5).
- A new connection after a drop, started by both browsers (decisions 1 and 3).
- Automatic new attempts, with a limit (decision 5).
- The traffic count per connection (decision 7).
- A check for lost changes: the table fingerprint in the console (decision 9).
- A local stand-in for a dropped network: `turn:pause` and `turn:resume` (decision 10).
- Docs.

Left for later:
- A test on two machines and two networks: step 12.
- `GET /ice` and Cloudflare TURN: step 13.

## Rules for every phase

- Read `CLAUDE.md`, `docs/plans/implement-backend.md` ("Rules for every step", "Step 11"), this plan, and the design sections named above.
- Do not open the app in a browser. Do not start the dev server. The user checks the app.
- Do not run `aws`, `cdk deploy` or `put-secrets`. The API code does not change in this step. Only `apps/api/package.json` changes (two scripts).
- Do not commit and do not push. The main model commits each finished phase.
- Temporary files go in the session's scratchpad directory.
- Keep tool output small (`head`, `grep`, `tail`, summaries).
- Code: plain JavaScript in `apps/web`. Plain, short comments that say why. Match the style of the code around you.
- Web tests run with `node --test`. A module under test must not import modules that read `import.meta.env` or load three.js scenes.
- Never log an SDP, a token or a live packet.
- After a code change: `pnpm format` and `pnpm lint`.
- Docs: short sentences, common words, one fact per sentence. Never the word "comprehensive".
- If a check fails and the fix is not in this plan, stop and report. Do not change the plan's decisions on your own.

## Names

| Thing | Value |
|---|---|
| `reconnecting` | A new state of `connectRoom` (`net/peer.js`). The connection was open and dropped, and the browser tries to connect again |
| Toolbar text | "Reconnecting" |
| `DROP_MS` | `10_000`. How long `connectionState` can stay `disconnected` before the attempt ends (decision 2) |
| `RECONNECT_TRIES` | `3`. Failed attempts in a row after a drop, before the state is `failed` (decision 5) |
| `tableFingerprint(doc)` | `net/fingerprint.js`. 8 hex characters. The same for two documents that have the same changes (decision 9) |
| Console line | `table fingerprint 3fa2c1d0`, once per connection (decision 9) |
| `turn:pause`, `turn:resume` | `pnpm --filter api turn:pause` and `turn:resume`: `docker compose pause coturn` and `docker compose unpause coturn` (decision 10) |

Files:

```
apps/web/src/
  net/peer.js                 + reconnecting, DROP_MS, hello after a drop, RECONNECT_TRIES
  net/peer.test.js            + tests of the rules of decisions 2 to 5
  net/fingerprint.js          new: tableFingerprint (phase 2)
  net/fingerprint.test.js     new (phase 2)
  components/RoomPlayers.jsx  + "Reconnecting"
  index.css                   + .room-player-status--reconnecting
  Table.jsx                   traffic per connection; the fingerprint line (phase 2)
apps/api/
  package.json                + turn:pause, turn:resume
  README.md                   + the two scripts
```

## Decisions that fill gaps in the design

1. **A new connection, no ICE restart.** The design names ICE restart: a new offer and answer on the same `RTCPeerConnection`, so the channels stay open. This plan makes a new `RTCPeerConnection` instead, the same way as at the start. Reasons:
   - The code path of a new connection exists and passed the user checks in three browser pairs (step 8). ICE restart is a second path, with its own rules for an offer from both sides at once. It needs its own checks in three pairs.
   - Both need the same signaling: one offer and one answer through the polls. So ICE restart is not faster here.
   - A new connection costs little. Yjs sync step 1 and 2 send only the changes that the other side does not have. Awareness sends the own state when a channel opens (step 9).
   - A new connection also works when the other page is new or its connection is closed. ICE restart works only on a connection that both pages still have.
2. **Drop detection.** While `connected`:
   - `connectionState` becomes `disconnected`: the state is `reconnecting` at once. The attempt stays. If `connectionState` is `connected` again within `DROP_MS`, the state is `connected` again. The channels stayed open, so nothing else happens: no new `onChannels`, no new sync.
   - `disconnected` for `DROP_MS`, or `connectionState` `failed`, or the `sync` channel closes: the attempt ends (the connection is closed), and a reconnect round starts (decision 3).
   - `DROP_MS` is 10 s. A short drop of the Wi-Fi then does not cost a new connection. Chrome reports `failed` only after about 30 s. `DROP_MS` is a starting value. The user checks give the real times.
3. **Both browsers post a new `hello` after a drop.** A reconnect round runs like a table open, with the same peer id:
   - Post `hello`. When it fails with no answer (status 0) or 5xx, post it again after `POLL_MS`. A 404 is `gone`, as today.
   - Start the polls when the `hello` is stored. So a later `hello` never deletes an offer or answer of this round (the server deletes the user's older messages when it stores a `hello`).
   - The guest offers on each new `hello` of the host, as today. The host answers each offer, as today.
   Reasons:
   - The guest offers only on a `hello` of the host. Without a new `hello`, nothing starts.
   - After a game of more than 1 hour, the TTL has deleted the old `hello`.
   - The guest's `hello` deletes its old offers. So many drops in one game do not reach the limit of 50 messages per room.
   - When one browser is offline, the other one's `hello` waits in the mailbox. The offline browser reads it with its first poll after the network comes back.
4. **The state `reconnecting`.** The toolbar shows "Reconnecting" from the drop until the state is `connected` again. The attempts in between (offer, answer) also show "Reconnecting", not "Waiting" or "Connecting". It ends:
   - with `connected`.
   - with a `bye` of the other player: `waiting`. The other player left the table on purpose. A reload of the other page also sends `bye`, then a new `hello`.
   - with `RECONNECT_TRIES` failed attempts: `failed` (decision 5).
   - after 15 minutes with no message from the other player: `stopped`, as today.
   - with a 404: `gone`, as today.
   A `hello` of the other player does not end it, also a `hello` of a new page. **Try again** (`retry()`) starts at `waiting`, as today.
5. **Automatic new attempts.** During `reconnecting`:
   - An attempt that got an answer and did not connect (15 s, or `connectionState` `failed`) counts as failed. The host then posts a new `hello` at once, so the guest offers again. Each attempt takes at least 15 s, so no extra wait is needed.
   - An offer with no answer after 15 s does not count. The host's page does not poll: it is offline, asleep or closed. The guest waits for the host's next `hello`, which the host posts when it is back (decision 3).
   - After `RECONNECT_TRIES` failed attempts in a row: `failed`, with "Could not connect" and **Try again**, as today. The host posts no more `hello`. Polls go on, as today.
   - A failed first connect (not after a drop) stays as today: `failed` at once.
6. **No `online` and `offline` events.** The `hello` post and the polls repeat every 2 s. So the browser finds out within 2 s that the network is back. The events would save at most 2 s and add a second path.
7. **Traffic per connection.** Today `Table.jsx` starts a traffic count at `connected` and ends it at any other state. With `reconnecting`, the same connection can come back. Then its bytes would count twice, because `getStats()` gives the sum since the connection started. So a count starts in `onChannels` and ends in `onChannelsEnd` (below). A traffic line in the console then means that a connection ended.
   - A browser fires no `close` event on a channel when its own `pc.close()` runs. This is the case after `DROP_MS` and `failed`. So `connectRoom` calls `onChannelsEnd()` once for each opened attempt when it ends, from a channel close or from its own close, whichever comes first. `Table.jsx` then ends the traffic count, stops the Yjs sync (which removes the other player's awareness states) and detaches the live channel. Found in Phase 1.
8. **Changes during a drop.** The code already keeps them. No change is needed:
   - Each change is in the document and in IndexedDB at once.
   - When a channel opens, Yjs sync step 1 and 2 send each side the changes that it does not have. This also covers a change that was sent on the old channel and did not arrive.
   - The guest's server writer runs when the state is not `connected` (step 8, decision 11). So during a drop both browsers write. `PUT /rooms/{code}/table` merges the bytes into the stored table (`mergeTables`). So no write replaces the other one.
   - The other player's claims go when the old connection ends (`onChannelsEnd`, then `syncChannel.js` `stop`). With `DROP_MS`, this is about 10 s after the drop, not 30 s (step 9, risk 6).
9. **Table fingerprint.** It checks for lost changes. Two documents with the same changes have the same state vector and the same delete set. Yjs 13.6 writes both sorted by client id. So `tableFingerprint(doc)` is a short hash (FNV-1a, 32 bits, 8 hex characters) of `Y.encodeSnapshot(Y.snapshot(doc))`.
   - `Table.jsx` logs `table fingerprint <hash>` once per connection: when the document had no change for 2 s after the `sync` channel opened. A change inside the 2 s starts the 2 s again.
   - The two consoles show the same hash when no change is lost. The players compare them after a drop.
   - All builds log it. It is one line per connection, and step 12 can use it with a real second player.
10. **A local stand-in for a dropped network.** On one Mac, Wi-Fi off does not stop a connection over `127.0.0.1`. So:
    - Both browsers open the room with `?relay`. All data then goes through the local coturn server.
    - `turn:pause` freezes the coturn container. No packet of the connection passes, the same as a dropped network. `turn:resume` lets the packets pass again. The TURN allocations stay valid, because a pause is short.
    - `turn:down` and `turn:up` (exist) give a long drop, where new attempts fail too.
    - The signaling API keeps working during a pause. A real drop also stops signaling. The unit tests cover that part (decision 3), and step 12 tests it on two networks.
    - Do not restart the API during a test. The memory store then loses the room, a poll gets 404, and the browser deletes its copy of the table (step 8, decision 12).

## Phase 1: Reconnect

Read: decisions 1 to 7 and 10. `net/peer.js`, `net/peer.test.js` (the fake connection and timers), `Table.jsx` (`connectRoom`, `onChannels`, `onState`, the traffic functions), `components/RoomPlayers.jsx`, `index.css` (`.room-player-status`), `apps/api/package.json`, `README.md` (the `turn:up` line).

Work:
1. `net/peer.js`: decisions 2 to 5.
   - `DROP_MS` and `RECONNECT_TRIES` as exported constants.
   - `connectionstatechange` of an open attempt: `disconnected` starts the drop timer, `connected` cancels it, `failed` ends the attempt.
   - The reconnect round: end the attempt, post `hello` with repeats, then poll. Cancel the repeat timer in `stop()`, in `gone()` and at `connected`.
   - The emitted state is `reconnecting` while a drop is not over (decision 4).
   - The count of failed attempts. It goes back to 0 at `connected`, at `bye` and in `retry()`.
   - Update the comment above `connectRoom`: the new state and the rules.
2. `net/peer.test.js`, new tests:
   - `disconnected`, then `connected` within `DROP_MS`: `reconnecting`, then `connected`. No new connection, no `hello`, no second `onChannels`.
   - `disconnected` for `DROP_MS`: the connection is closed. Both roles post `hello`. Polls start only after the `hello` is stored. The guest offers on the host's new `hello`, and the state is `connected` again.
   - `failed`, and the `sync` channel closes: a reconnect round at once.
   - The `hello` post fails with status 0: it is posted again after `POLL_MS`. A 404: `gone`.
   - An attempt fails after the answer: the host posts a new `hello`. After `RECONNECT_TRIES`: `failed`, and no more `hello`.
   - An offer without an answer: not counted, the state stays `reconnecting`.
   - A `hello` of the guest's new page during the host's `reconnecting`: still `reconnecting`.
   - `bye` during `reconnecting`: `waiting`. 15 minutes with no message: `stopped`.
   - `stop()` during the `hello` repeats: no more posts.
   - The existing tests still pass, also the closed and reloaded page of step 8.
3. `components/RoomPlayers.jsx`: `reconnecting: 'Reconnecting'`. No **Try again** for it. `index.css`: `.room-player-status--reconnecting` with the color of `--failed`.
4. `Table.jsx`: decision 7. The traffic count starts in `onChannels` and ends when that `sync` channel closes. A closing table still ends it with no line, as today.
5. `apps/api/package.json`: `turn:pause` (`docker compose pause coturn`) and `turn:resume` (`docker compose unpause coturn`). The root `README.md` documents them, in Phase 2 (`apps/api/README.md` does not exist).

Checks:
- `pnpm --filter web test`, `pnpm --filter web build` pass.
- `pnpm format`, `pnpm lint`: no new errors.

User, after this phase: checks 1 to 6.

### Result

Done. Web tests 269 pass, 0 fail (peer tests 36, 15 new, 1 changed). Build passes. `pnpm format` clean. Lint: no new warnings (the old ones are in other files).

- `net/peer.js`:
  - New exports `DROP_MS` (10 s) and `RECONNECT_TRIES` (3). Comment above `connectRoom` has the new state and rules.
  - Flags `reconnecting`, `failures`, `helloPending`, `helloTimer`. `emit()` shows `reconnecting` when the flag is set and the internal state is `waiting` or `connecting`. The internal state `reconnecting` is only the `disconnected` wait (no polls then).
  - `connectionstatechange` of an open attempt: `disconnected` starts `att.dropTimer`, `connected` cancels it (state `connected`, no new `onChannels`), `failed` and the drop timer call `dropped()`. The sync channel close calls `dropped()` too.
  - `dropped()` ends the attempt, sets `reconnecting`, then `reconnectHello()`. It posts `hello`, repeats after `POLL_MS` on status 0 or 5xx, 404 is `gone`. Polls wait while `helloPending`. Another error (400, 429): no repeat, the polls start, like a table open.
  - `failed()` during `reconnecting` counts. The host posts a new `hello` at once. At `RECONNECT_TRIES`: `failed`, no more hellos. An offer with no answer goes to `backToWaiting()` and does not count.
  - `clearRound()` (count, flag, hello timer) runs at connected, bye, idle stop, `retry()`. `stop()` and `gone()` cancel the hello timer. A bye of a known peer during `reconnecting` gives `waiting`.
  - New argument `onChannelsEnd()`: called once for each opened attempt, from `endAttempt` (flag `att.ended`). Every end of an attempt goes through `endAttempt`, and a channel close goes there through `dropped()`. Not called for an attempt that never opened.
- `net/peer.test.js`: `makeServer` has `failHello(status)`, `FakePc` has `setConnectionState`, `player` has `ends`. New tests as in Work item 2, plus two for `onChannelsEnd`. The test "a closed channel gives waiting" is now "gives reconnecting".
- `RoomPlayers.jsx`: `reconnecting: 'Reconnecting'`, no Try again. `index.css`: `.room-player-status--reconnecting` shares the `--failed` rule.
- `Table.jsx`: `onChannels` starts the traffic count, the Yjs sync and attaches the live channel. `onChannelsEnd` ends the count (`endTraffic(false)`), stops the sync and detaches the live channel. The per-channel `close` listeners are gone. `close()` ends traffic quietly first, so the later `onChannelsEnd` from `link.current.stop()` finds nothing to do.
- `apps/api/package.json`: `turn:pause`, `turn:resume`. `apps/api/README.md` does not exist; the root `README.md` is Phase 2.

For Phase 2:
- `Table.jsx`: start the fingerprint 2 s timer in `onChannels`. Clear it in `onChannelsEnd` and in `close()`.
- `onState` no longer touches traffic. The guest writer still pauses on `next.state === 'connected'`; during `reconnecting` the guest writes (decision 8).

## Phase 2: Table fingerprint and docs

Read: decisions 8 and 9. The **Result** of Phase 1. `Table.jsx`, `net/traffic.js` (how a module with no React is laid out and tested).

Work:
1. `net/fingerprint.js`, new plain module: `tableFingerprint(doc)` (decision 9). Tests in `net/fingerprint.test.js`:
   - Two documents that get the same updates in a different order have the same fingerprint.
   - A delete changes the fingerprint.
   - Two documents with different changes have different fingerprints.
2. `Table.jsx`: the console line of decision 9. The timer is cleared when the channel closes and when the table closes.
3. Docs:
   - `docs/feature-peer-to-peer.md`: "Status" line at the top. "Connect flow": the state `reconnecting` in the states table, the drop rules (decisions 2 to 5), and the sentence "Step 11 keeps the network cases …" replaced by the rules. "Room and players": the "Reconnecting" item. "Local testing": `turn:pause` and `turn:resume` with `?relay`. "Debug flags" or "Local testing": the fingerprint line. "Phases": phase 5 done, a new connection instead of ICE restart (decision 1).
   - `README.md`: the multiplayer part: "Reconnecting", and how to test a drop. `turn:pause` and `turn:resume` next to `turn:up` and `turn:down`.
   - `docs/plans/implement-backend.md`: a short **Result** under step 11. In the step 11 list, "ICE restart" is replaced by "a new connection (decision 1 of `11-reconnect.md`)".

Checks:
- `pnpm --filter web test`, `pnpm --filter web build` pass.
- `pnpm test`, `pnpm typecheck` pass.
- `pnpm format`, `pnpm lint`: no new errors.

User, after this phase: checks 7 to 9.

### Result

Done. Checks run at the end of the phase (numbers below).

- `net/fingerprint.js`: `tableFingerprint(doc)`, FNV-1a 32 bit of `Y.encodeSnapshot(Y.snapshot(doc))`, 8 lowercase hex. `fingerprint.test.js`: 4 tests (format, order, delete, different changes).
- `Table.jsx`: `startFingerprint()` in `onChannels` adds a doc `update` listener and a 2 s timer (`FINGERPRINT_QUIET_MS`). Each update restarts the timer. The timer logs `table fingerprint <hash>` and removes the listener. `onChannelsEnd` and `close()` call `stopFingerprint()`. All builds log it.
- Docs: `docs/feature-peer-to-peer.md` (Status, Connect flow with the drop rules, states table, Room and players, Local testing "Test a dropped network" with the fingerprint line, Code layout, Phases). `apps/api/README.md` does not exist, so the layout line now names `apps/api/package.json` and its scripts. Root `README.md`: "Reconnecting" part, `turn:pause` and `turn:resume`. `docs/plans/implement-backend.md`: step 11 list and Result.

## User

Setup for checks 1 to 5: `pnpm --filter api turn:up`. Alice (Blue, host) and Bob (Red, guest) open the room with `?relay`, for example `/?relay#room=…`. They are connected.

After Phase 1. Checks 1, 2 and 4 in each pair. Checks 3, 5 and 6 once, in one pair:
1. Short drop. `turn:pause`, wait 4 s, `turn:resume`. The status can show "Reconnecting" for a moment, then "Connected". The console logs no traffic line, because the same connection goes on. Write down if "Reconnecting" showed.
2. Long drop. `turn:pause`, wait 30 s, `turn:resume`. Both toolbars show "Reconnecting" within about 15 s of the pause. Within about 40 s of the resume, both show "Connected". Each console logs one traffic line for the old connection. Write down the times.
3. Very long drop. `turn:down`, wait 2 min. Both show "Reconnecting", then "Could not connect" with **Try again**. `turn:up`, then **Try again** on one side. Both show "Connected".
4. Reload and **← Lobby** work as in step 8. Alice reloads: Bob shows "Reconnecting" or "Waiting", then "Connected". Bob goes **← Lobby**: Alice shows "Waiting". Bob opens the room again: "Connected".
5. A drag during a drop. Bob drags a model and holds it. `turn:pause`. Within about 15 s, Alice can drag that model. `turn:resume`. After the reconnect, the model is at the same place on both screens.
6. Sleeping laptop. Close the Mac's lid for 1 min, then open it. Both browsers show "Connected" again within about 40 s. Write down if "Reconnecting" showed.

After Phase 2. Checks 7 and 8 in one pair. Check 9 in each pair:
7. Lost changes. `turn:pause`. During the pause, Alice moves a model, flips a crisis token and rolls 5 dice. Bob changes the damage of a character, moves a token and turns the mat. `turn:resume`. After the reconnect, both screens show all six changes. The last `table fingerprint` line is the same in both consoles.
8. Both go **← Lobby** and open the room again. All six changes are there. The fingerprints are the same.
9. A normal connect: both consoles show the same `table fingerprint` line.

### User check results

2026-10-11, after Phase 1. Alice in Chrome. The user reported checks 1 to 3 as "a, b, c": they work. The user is happy with the results for now and plans more profiling later. Checks 4 to 6 and the other pairs were not reported.

Alice's console, in order:

```
traffic: connection 0.0 KB sent, 0.0 KB received, 0 min, direct; table 0.0 KB sent, 0.0 KB received, 0 min
traffic: connection 3.8 KB sent, 1.9 KB received, 1 min, relayed; table 3.8 KB sent, 1.9 KB received, 1 min
traffic: connection 3.5 KB sent, 2.3 KB received, 1 min, relayed; table 7.2 KB sent, 4.2 KB received, 3 min
```

- The first line is a connection that ended before the first stats read (every 60 s). So its bytes are 0, and "direct" only means that nothing was read. Open: which check it came from. If it came from check 1, the short drop made a new connection.
- The user asked if reconnect uses exponential backoff. It does not: polls and the `hello` repeat every 2 s, and new attempts stop after `RECONNECT_TRIES`. The answer and the options are in chat on 2026-10-11.

## Done when

- `pnpm test`, `pnpm typecheck`, `pnpm --filter web build` pass. `pnpm lint` has no new errors.
- The user checks pass, in the three browser pairs where the check says so.
- The **Result** of each phase is filled in, with the times of checks 1, 2 and 6.

## Risks and open questions

1. **Times differ per browser.** When `connectionState` becomes `disconnected` and `failed` depends on the browser. Chrome and Safari use the same WebRTC code (libwebrtc). Firefox uses its own. Checks 1, 2 and 6 give the times. If a browser reports `disconnected` too late, `DROP_MS` cannot help, and only `failed` or the channel close starts the round.
2. **One Mac.** `turn:pause` stops only the WebRTC path, not the signaling. A real drop stops both. The unit tests cover the `hello` repeats. Step 12 tests two machines on two networks.
3. **A sleeping laptop for more than 15 minutes.** The other browser is `stopped` and does not poll. The laptop that wakes up shows "Reconnecting" until the other player presses **Try again**, or until its own 15 minutes end. Accepted, as the design accepts it for a forgotten tab.
4. **A drag at the moment of the drop.** The other player's claim goes when the old channel closes. Then this browser can write a rest pose of that piece. After the reconnect, Yjs keeps one of the two rest poses, the same on both screens. It can be the older place. Check 5 shows how it looks. Players move the piece again if needed.
5. **Hidden tabs.** Chrome slows the timers of a tab that is hidden for 5 minutes to one per minute (step 8, risk 5). A reconnect in such a tab takes longer. Accepted.
6. **Messages per room.** Each drop adds one `hello` per player, and at most `RECONNECT_TRIES` offers and answers. A `hello` deletes the older messages of its user. So a room stays far below 50 messages.
