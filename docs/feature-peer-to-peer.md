# Feature: Peer-to-peer play

Status: steps 8 and 9 are built. Two browsers of a multiplayer room connect over WebRTC. The Yjs document and Yjs awareness (the claims) go over the `sync` channel. Live moves of pieces and the cursor go over the `live` channel. The tools are in the document, per side. Dice come in step 10. A dropped network and "Reconnecting" come in step 11. `GET /ice` and TURN come in step 13. The user's browser checks of step 8 passed on 2026-10-09. The browser checks of step 9 are open. See [Open questions](#open-questions) at the end.

The backend (repo, stack, AWS, deploy) is in `docs/feature-backend.md`. The order of the work is in `docs/plans/implement-backend.md`.

## Goal

Two players play one game from two browsers. Both see the same table: map, mat turn, crisis cards, tokens, models, tools and dice. A move by one player shows on the other screen within a fraction of a second.

The game data goes directly from browser to browser over WebRTC. We run no game server. We run only a small service that helps the two browsers find each other (signaling). It must cost nothing.

## Summary

| Part | Choice |
|---|---|
| Transport | WebRTC data channels, browser to browser |
| Signaling | Routes in the API of `docs/feature-backend.md` (one AWS Lambda with a function URL), plus one collection in its Atlas Free cluster. HTTP polling, no WebSocket |
| NAT traversal | Public STUN servers first. Cloudflare TURN later, only if direct connections fail too often |
| Shared state | Yjs document, synced over a reliable data channel, the same way as the whiteboard at work |
| Moving objects | The player who moves a piece claims it and streams its pose over an unreliable data channel (`live`). The rest pose goes into the Yjs document |
| Cost | $0. Lambda "Always Free" limits have no end date, and the Atlas cluster is a Free cluster. See [Cost and free tier](#cost-and-free-tier) |

## How a WebRTC connection starts

1. Browser A creates an **offer**: a text (SDP) that describes the data channels, the encryption keys, and the network addresses where A can be reached (ICE candidates).
2. A sends the offer to browser B. WebRTC does not say how. This step is **signaling**, and it needs some service that both browsers can reach.
3. B creates an **answer** with its own addresses and sends it back to A.
4. The browsers try the address pairs and connect directly. After that, the signaling service is not used.

To find its public address behind a home router (NAT), a browser asks a **STUN** server. STUN is cheap, and public STUN servers are free.

Some networks block direct connections, for example strict company networks and some mobile networks. Then the data must go through a **TURN** server, which relays every packet. TURN costs bandwidth, so it is the only part that can cost money.

At work, Twilio provided the transport and the signaling. Here the browser's `RTCDataChannel` is the transport, and we run the signaling ourselves. The Yjs part is the same: Yjs sync and awareness messages go over a channel.

## Signaling options

| Option | Server we run | Cost | Problems |
|---|---|---|---|
| Copy and paste the offer and the answer (for example in a chat) | None | $0 | Two manual steps per connection, also for every reconnect |
| [Trystero](https://github.com/dmotz/trystero) (signaling over public Nostr relays, BitTorrent trackers or MQTT brokers) | None | $0 | Depends on public servers that we do not control. They can be slow, rate-limited or gone |
| y-webrtc public signaling server | None | $0 | Not reliable. The public server has been down, and the y-webrtc docs say to run your own |
| PeerJS public server | None | $0 | Same problem: a free public service with no guarantee |
| **AWS Lambda function URL + MongoDB Atlas, HTTP polling** | One function, one collection | $0 (Lambda Always Free, Atlas Free cluster) | Polling adds about 1 s to the connect time |
| AWS Lambda function URL + DynamoDB, HTTP polling | One function, one table | $0 (Always Free) | Polling adds about 1 s to the connect time. One more database to run |
| AWS API Gateway WebSocket + Lambda + a database | One API, functions, a database | Free for 12 months (old accounts) or while credits last (new accounts), then a few cents a month | More parts. Must track open connections |
| Cloudflare Worker + Durable Object (WebSocket) | One Worker | $0 (Workers Free plan) | A second cloud vendor. Otherwise a good choice, see [Open questions](#open-questions) |

**Choice: Lambda function URL + MongoDB Atlas.** It is under our control and stays free with no end date. The Atlas Free cluster costs nothing, and signaling fits its limits (backend doc, "Free cluster limits"). DynamoDB is the fallback: it is also free with no end date, and the store interface keeps the switch small. Signaling needs few messages, because we send the offer and the answer only after the browser has found all its addresses (non-trickle ICE). So polling is cheap and simple.

The client code uses a small `Signaling` interface, so we can change the option later without touching the rest. For development, the same Hono app runs in a local Node process behind the Vite proxy. See [Local testing](#local-testing).

## Signaling service

### Parts

The signaling routes are part of the API of `docs/feature-backend.md`. That doc describes the AWS parts in detail.

- **Lambda function**: the Hono app of `apps/api`. Node.js 24, arm64, 256 MB, 10 s timeout. The signaling routes read and write messages through a store interface. The Lambda uses the MongoDB store. Local dev and the tests use the memory store. The bundle includes the official `mongodb` driver, because the Lambda runtime has only the AWS SDK. 256 MB gives more CPU than 128 MB, so the TLS and login steps of a new Atlas connection take less time.
- **Function URL** with auth type `NONE`. CORS allows only the site origin. In dev, Vite forwards `/api` to the local API, so the browser sends no cross-origin request. A function URL has no cost of its own. We pay only for Lambda requests and compute.
- **MongoDB collection** `messages` in the database `assist3d`, on the Atlas Free cluster of this app. A TTL index deletes each document after 1 hour. Atlas checks TTL indexes about once a minute, so a document can stay a little longer.
- **Atlas database user** `mcptacticus-api` with `readWrite` on `assist3d` only.
- **CloudWatch log group** with 1 week retention, so logs do not grow forever.
- **AWS Budgets** alert by email at $1.

The CDK stack `McpTacticusApi` in `infra/` creates the function, the function URL and the log group. The stack `McpTacticusAccount` creates the budget. The Atlas CLI commands in `docs/plans/implement-backend/03-infra.md` ("First deploy commands") create the database user and the IP access list. The cluster is not shared with wuclub.

### MongoDB connection

These rules come from wuclub `apiv2` (`src/dal/client.ts`), with two changes.

- One `MongoClient` in module scope. Warm Lambda calls reuse it. Only the first call of a new Lambda instance opens a connection.
- Options: `maxPoolSize: 2` and `serverSelectionTimeoutMS: 5000`. `apiv2` keeps the defaults: 100 connections per instance and 30 s. With 30 s, the Lambda reaches its own timeout before the driver reports that Atlas cannot be reached.
- On the first call, the store creates the indexes: `{ room: 1, id: 1 }` and the TTL index `{ expiresAt: 1 }` with `expireAfterSeconds: 0`. `createIndex` does nothing when the index exists already, so this is safe on every cold start.
- The connection string is the SSM `SecureString` parameter `/mcptacticus/prod/mongodb-uri`. The Lambda reads it at cold start (backend doc, "Secrets and config"). It is not a Lambda env var, so the Lambda console does not show it. Local dev reads `MONGODB_URI` from `apps/api/.env`.
- Network: the Lambda runs outside a VPC, so its public IP address changes. Therefore the Atlas IP access list allows `0.0.0.0/0`. The Atlas CLI sets it, with the command in `docs/plans/implement-backend/03-infra.md` ("First deploy commands"). A fixed IP address needs a VPC and a NAT gateway, and a NAT gateway costs money.
- Region: the Lambda and the Atlas cluster are both in `eu-central-1`. Every poll is one round trip to Atlas, so they must be close.

### Data

The collection is a mailbox per room. One document per message. The index `{ room: 1, id: 1 }` finds the messages of a room in time order.

| Field | Meaning |
|---|---|
| `room` | Room code, for example `K7Q2-M9XD` |
| `id` | Message id, sorts by time |
| `from`, `to` | Peer ids. `to` is `*` for a message to every peer in the room |
| `type` | `hello`, `offer`, `answer`, `bye` |
| `data` | The SDP text, or the app version in `hello`. At most 8 KB |
| `expiresAt` | `Date`, 1 hour from now. The TTL index deletes the document after this time |

### Endpoints

| Request | Does |
|---|---|
| `POST /rooms/{room}/messages` | Stores one message. Rejects unknown types, big bodies, and rooms that have 50 messages already |
| `GET /rooms/{room}/messages?to={peer}` | Returns the messages for this peer (or for `*`) after the id in the `x-after` header. Without the header, it returns all of them |
| `GET /ice` | Not built yet. Step 13 adds it: the ICE server list and short-lived TURN credentials, see [STUN and TURN](#stun-and-turn). Until then the web app has the two STUN servers as a constant in `net/ice.js` |

Details of the routes (step 8):

- Both routes need a valid token and a seat in the room. A user without a seat gets 403. An unknown room gets 404.
- `to` of an `offer` or an `answer` is a peer id. Only `hello` and `bye` may use `*`.
- A message in an answer is `{ id, from, to, type, data, user }`. The server sets `user` to `{ id, name, avatar, discordId }` and ignores a `user` in the body.
- The message id is 13 digits of the server time in ms, `-`, and 8 random characters. A poll returns at most 50 messages, the oldest first, and not the messages of the asking peer.
- Errors: 400 for a bad body, `to` or `x-after`. 413 above 16 KB. 429 for the 51st message of a room.
- Before the server stores a `hello` or a `bye`, it deletes the older messages of the same user in the room. So a reload leaves no old `hello`, and a room keeps few messages.
- A poll checks only the token. It does not read the user (`docs/feature-auth.md`, "Identity in peer-to-peer games"). The seat comes from a cache of 30 s per API instance.
- `DELETE /rooms/{code}` and `DELETE /me` delete the messages too, because the SDP has the public IP address.

The poll sends `after` in the `x-after` header, not in the query. So the poll URL stays the same between polls, and the browser sends one CORS preflight for it, not one per poll (backend doc, "Preflight per URL"). The CORS config of the function URL allows this header.

### Connect flow

Both players of a multiplayer room (step 7, `docs/feature-auth.md`) run the same code. Either player can open the room first. The room's host answers. The guest makes the offer.

1. When the table opens, the browser makes a new random peer id (`crypto.randomUUID()`), posts `hello` and polls every 2 s. The peer id is not kept: a reload makes a new one. The room link is `https://<site>/#room=K7Q2-M9XD`. The code is in the URL hash, so Netlify never receives it. A guest who opens the link joins the room first (`docs/feature-auth.md`). A single player room and the Sandbox never connect and make no signaling call.
2. The guest sees the `hello` of the host. It creates the offer, waits until ICE gathering ends (at most 3 s), and posts the `offer`. A newer `hello` of the host ends the attempt in progress, and the guest offers again.
3. The host reads the offer, creates the answer the same way, and posts the `answer`. A new offer ends the attempt in progress or the old connection, because the guest's page is new.
4. The guest reads the answer. The `sync` channel opens. Both stop polling.

The guest makes the offer, not the host. The reason: an offer that waits for minutes until someone joins can stop working, because routers forget address mappings that are not used. With this order, the offer and the answer are created seconds apart.

A browser uses a message only when:
- its `user.id` is not the own user id, so a second tab of the same user is ignored.
- for an `offer` or an `answer`: its `user.id` equals the `user.id` of the `hello` with the same `from`.

Each attempt has its own `RTCPeerConnection`. The old one is closed.

States, shown in the room toolbar next to the other player:

| State | Means | Toolbar text |
|---|---|---|
| `waiting` | The browser polls. The other page is not seen | "Waiting" |
| `connecting` | An offer or an answer is sent | "Connecting" |
| `connected` | The `sync` channel is open | "Connected" |
| `failed` | The answer came, but ICE did not connect. Polls go on | "Could not connect" and **Try again**. The title says: "Could not connect directly. One of the networks blocks peer-to-peer connections." |
| `stopped` | 15 minutes with no message from the other player. No polls | "Not here" and **Try again** |
| `gone` | A poll got 404: the room was deleted | The lobby opens with "The host deleted room K7Q2-M9XD." |

Timeouts:
- An offer with no answer after 15 s: the host's page is gone. The state goes back to `waiting`, and the guest does not offer to that `hello` again.
- Not connected 15 s after the answer, or `connectionState` is `failed`: `failed`. Polls go on, so a new `hello` or offer starts a new attempt.
- 15 minutes with no message from the other player: polls stop, and the state is `stopped`. So a forgotten tab does not make requests forever.
- **Try again** posts a new `hello` and starts the 15 minutes again. The guest also offers again to the latest `hello` of the host.
- Polls stop while the state is `connected`.

A new connection after the other page closes or reloads (step 8): when the `sync` channel closes or `connectionState` is `failed`, the state goes back to `waiting` with the same peer id, and polls start again. The other page posts a new `hello` (as host) or a new offer (as guest). Yjs syncs what changed in between. When the table closes (**← Lobby**, a page close or reload), the browser posts `bye`. On a page close it uses `keepalive`, but this is best effort: in production, a `keepalive` request with an `Authorization` header needs a preflight, which a closing page may not send. Without `bye`, the other browser finds out by the timeouts. A `bye` of the other player ends the attempt in progress, and the state goes to `waiting`.

Step 11 keeps the network cases: a dropped network, a sleeping laptop, the "Reconnecting" message, ICE restart, and the checks for lost changes.

When the host deletes a room, the host is in the lobby, where its room is not open and has no connection. The old plan was that the host's browser tells the guest over the connection. Step 8 replaced it: the guest learns from its poll. While the guest waits, it polls. After the delete, a poll gets 404 within about 32 s (the seat cache of 30 s plus one poll). The guest's browser then opens the lobby with "The host deleted room K7Q2-M9XD." and deletes its local copy. A guest whose polls stopped finds out at its next table write, which gets 404 (`docs/feature-auth.md`, "Rules").

Both `hello` messages carry the app version (the build id). The build id is `import.meta.env.VITE_BUILD_ID`: the Netlify `COMMIT_REF`, or `dev`. If the two versions are different, both players see a warning: "Your opponent uses a different version of the app. Both players should reload the page." The connection still runs. The reason is in [State](#state), category 1.

While the two browsers are connected, only the host writes the table to the server. The guest's writer pauses, and it still writes on **← Lobby** and when its tab is hidden (`docs/feature-auth.md`, "Table on the server").

## Cost and free tier

The question was: how long can we stay in the free tier with Lambda? Answer: **with no time limit**, if we follow the rules below. Lambda is in the AWS "Always Free" group. Its limits are per month and have no end date, for old and new accounts. The Atlas cluster is a Free cluster, so it costs nothing. Signaling must fit its limits (backend doc, "Free cluster limits").

### Use per game

Assumptions: 2 players, the host waits about 3 minutes for the guest, one reconnect.

| Item | Use per game | Always Free per month | Games per month at $0 |
|---|---|---|---|
| Lambda requests | about 100 (most are the host's polls while waiting) | 1,000,000 | about 10,000 |
| Lambda compute | about 1.3 GB-s (256 MB, about 50 ms per request) | 400,000 GB-s | about 300,000 |
| MongoDB Atlas | about 100 reads and 6 writes, documents deleted after 1 h | Free cluster, $0 | The limits are per second and on open connections, not per month: 100 hosts waiting at the same time make about 50 reads per second |
| CloudWatch Logs | about 30 KB | 5 GB | about 150,000 |
| Data out to the internet (browsers and Atlas) | about 50 KB | 100 GB | not a limit |

Requests above the limit cost $0.20 per million. So even 20,000 games in one month cost about $0.20.

### Rules to stay at $0

1. **Account plan.** A new AWS account (created on or after 2025-07-15) on the **Free plan** closes after 6 months or when its credits run out. Before that, upgrade it to the **Paid plan**. Always Free stays on the Paid plan. The Paid plan needs a payment card. An older account already has Always Free.
2. **No API Gateway.** Its free tier lasts 12 months for old accounts, and new accounts get only credits. The function URL has no charge of its own.
3. **No new paid services.** The Atlas Free cluster, no tier upgrade. Secrets in SSM standard parameters, not in Secrets Manager. No VPC and no NAT gateway.
4. **Log retention** of 1 week.
5. **Budget alert** at $1, so we see a mistake or abuse early.

### If we used API Gateway WebSocket instead

The free tier is 1 million messages and 750,000 connection minutes per month, for 12 months, and only for accounts created before 2025-07-15. After that it costs $1.00 per million messages and $0.25 per million connection minutes. A 2-hour game with both sockets open for the whole game uses 240 connection minutes. So 1,000 games cost about $0.06 a month. That is cheap, but not $0, and it has more parts.

## STUN and TURN

- **STUN**: `stun:stun.l.google.com:19302` and `stun:stun.cloudflare.com:3478`. Both are free. Cloudflare says its STUN service is free and unlimited.
- **TURN, phase 1**: none. If the direct connection fails, the app says so: "Could not connect directly. One of the networks blocks peer-to-peer connections."
- **TURN, later**: Cloudflare Realtime TURN. The first 1,000 GB per month are free, then $0.05 per GB. The TURN service and the Cloudflare SFU share these 1,000 GB. Only data from Cloudflare to the browser counts. Data from the browser to Cloudflare is free. There is no charge per minute or per connection. Limits per TURN connection: about 5,000–10,000 packets per second and 50–100 Mbps. The browser must not hold the long-term TURN key. So `GET /ice` asks the Cloudflare API for credentials that expire after a few hours, and returns them. The Cloudflare token is an SSM `SecureString` parameter, like the other secrets (backend doc, "Secrets and config").

### Traffic per game

Only category 4 (see [State](#state)) sends data all the time, so it decides the TURN cost. Each packet has about 90 bytes of headers (IP, UDP, DTLS, SCTP, TURN). One pose in JSON with full number precision would be about 170 bytes. The built packet rounds the numbers, so a model pose is about 70 bytes, and the table below is an upper estimate.

Estimate for one 2-hour game. The numbers are calculated, not measured:

| Item | Assumption | Data |
|---|---|---|
| Models, tokens and tools being moved | 20 minutes in total, 30 packets per second | about 9 MB |
| Dice in the air | 100 rolls of about 8 dice, 3 s each | about 13 MB |
| Cursor | 10 packets per second. The mouse moves over the table for 1 hour per player | about 10 MB |
| Categories 2 and 3, keepalive packets | | about 1 MB |
| **Total** | | **about 35 MB** |

So 1,000 GB is enough for about 28,000 relayed games per month. It is not clear if Cloudflare counts the data twice when both players use the relay. In that case, the number is about 14,000. Only games where the direct connection fails use TURN.

Phase 3 logs the bytes from `pc.getStats()` (`bytesSent` and `bytesReceived` of the selected candidate pair, `net/traffic.js`). The browser reads them every 60 s and logs one `console.info` line every 10 min, when a connection ends, and on **← Lobby**. The line has the bytes sent and received, the minutes, and direct or relayed, for the connection and for all connections of the open table. The measured numbers of a local game are open (check 23 of `docs/plans/implement-backend/09-moving-objects.md`). Then replace this estimate with them. If the traffic is too high, there are three ways to send less: send less often, round the numbers, or use a binary format.

### Other Cloudflare Realtime products

From Cloudflare Realtime we need only TURN and the free STUN server.

| Product | What it is | Why we do not use it |
|---|---|---|
| RealtimeKit | SDK and ready-made UI for video and voice calls: participant grid, media controls, chat, polls, recording. It runs on the Cloudflare SFU | It is made for calls. It costs per participant per minute ($0.002 for audio and video), and the pricing page lists no free amount |
| Realtime SFU | A server that forwards media and data channels from one browser to many (publish and subscribe). It supports reliable and unreliable data channels | All data goes through Cloudflare, not directly between browsers. It still needs our own backend, which holds the app secret and does the signaling. It helps only with many players |

Cloudflare Realtime does not do signaling for direct connections. So with Cloudflare TURN we still need our own signaling service.

## Data channels

One `RTCPeerConnection` per pair of players. It has two data channels:

| Channel | Settings | Carries | Step |
|---|---|---|---|
| `sync` (persistence) | reliable, ordered. `negotiated: true`, `id: 0` | Categories 2 and 3: Yjs sync messages. Yjs awareness messages (`y-protocols`): the claims | 8, 9 |
| `live` | `negotiated: true`, `id: 1`, `ordered: false`, `maxRetransmits: 0` | Category 4: poses of moving pieces, the cursor, and later dice in flight. A lost packet is not sent again, because the next one replaces it | 9 |

Both browsers create both channels before the offer and the answer, as negotiated channels, so there is no `ondatachannel` race. The first design added `live` after the connection. Creating both before the offer is the same code path as `sync` and needs no new rule. `onChannels({ sync, live })` is called once per open, when `sync` opens. `live` may open a moment later, and the live hub sends nothing until it is open.

Claims go over `sync`, not over `live`, although they are not saved. A lost release would lock a piece. A release must also come after the rest pose or the drop. Only a reliable, ordered channel does both.

Names and sides need no awareness. They come from the room and from the `user` of the messages, which the server sets.

On `sync`, each message is a varUint type and then a `y-protocols` message, the same layout as y-websocket. Type `0` is sync and type `1` is awareness. A channel sends sync step 1 and the own awareness state when it opens. A document update from the channel is applied with the channel as origin and is not sent back. When the channel stops, the awareness states that came from it are removed.

The data is encrypted (DTLS), also through TURN. Data channels need no camera or microphone permission.

Message size: the first sync of a long game is about 35 KB. The design was to check `pc.sctp.maxMessageSize` and split. The value depends on both browsers, and Firefox has a different limit than Chrome and Safari. So `syncChannel.js` always splits a message above 16 KB, a size that works in every pair, and does not read the value. Each frame has a first byte: `0` a whole message, `1` a part with more to come, `2` the last part. The channel is ordered and reliable, so the parts arrive in order. Test the first sync of a big game in each browser pair.

## State

The data has four categories. There is also local state, which is not sent.

| # | Category | Examples | Where | Channel |
|---|---|---|---|---|
| 1 | Assets | models, textures, card images, map images | Netlify, or AWS later. Loaded over HTTPS | None. Never through WebRTC |
| 2 | Set-up: changes once per game | rosters, crisis cards, map, deploy line | Yjs document | `sync` |
| 3 | Rare changes | rest poses of models and tools; the places of tokens, cards and markers; card flips; damage and power; healthy or injured side; tokens gained or lost; mat turns; dice results (the shelf) and roll history | Yjs document | `sync` |
| 4 | Presence: what the other player does now | dice in the air (step 10); every piece that a player drags (model, tool, crisis token, character token on the table, pile, tactic card, score marker); cursor | Not stored | `live` |
| | Players | name, side (blue or red), claims (`owns`), the model that the player drags now (`drag`, for the deploy tool), the new token or pile that the player drags now (`spawn`: `{ key, tokenKey }`). the selected character and crisis token (`selection`, piece keys, the last is the tool target), the selected tool kinds (`tools`), and the piece that a turning range tool marks (`mark`: `{ key, mode }`) | Yjs awareness | `sync` |
| | Local | camera, hover, labels, debug mode, open card popup, open dice menu | React state, as today | Not sent |

The same object can be in two categories at different times. While a player drags a model, its pose is category 4. When the model stops, its rest pose goes into the document as category 3. A piece without a body (a token, a card, a marker, a pile) writes its new place into the document at the drop.

**Category 1.** The game state refers to assets and data by id: character keys, crisis card ids, map id. So both players must run the same version of the app. See the version check in [Connect flow](#connect-flow).

**Category 4** only shows each player what the other player does. It does not need to be exact: packets can be lost, and the motion can jump. The final state always comes through category 3. So category 4 uses the unreliable `live` channel, and its send rates are starting values. We measure the traffic (see [Traffic per game](#traffic-per-game)) and change the rates after that.

The cursor is in category 4, not in awareness. Awareness goes over the reliable, ordered `sync` channel. On that channel, a lost packet is sent again, and all messages after it wait. So a fast cursor stream would delay card flips and other Yjs changes.

### Yjs document

Each name is a top-level `Y.Map` of the `Y.Doc`. Step 5 made the first ten. Step 9 added `tools`. Step 10 added `dice`.

| Name | Kind | Content |
|---|---|---|
| `game` | record, depth 1 | `schema`, `mapId`, `matTurns`, `deployLine`, `crisis { secure, extract }`, `scoreMarkers`, `affiliations` |
| `rosters` | record | `blue` and `red`: `null` or `{ code }` (`docs/feature-roster.md`, "State") |
| `setup` | record, depth 1 | the game setup: the fields of `NEW_SETUP` (`docs/feature-setup-game.md`) |
| `terrain` | list | the pieces on the mat: `index` in the map data, `locked` |
| `characters` | list | the fields of `newCharacter` in `App.jsx`: key, figure, base, rotation, side (healthy or injured), damage, power, tokens |
| `poses` | record | model id → `{ x, y, z, qx, qy, qz, qw }`, the rest pose of a body, written when the body falls asleep |
| `tokens` | list | crisis tokens: the fields from `buildMatTokens`, with place, `up`, control, damage |
| `tactics` | list | tactic cards on the table (`docs/feature-team-tactic-cards.md`) |
| `looseTokens` | list | character tokens on the table |
| `tokenPiles` | list | token piles on the table |
| `tools` | record, depth 1 | the tools of both players: `tools.<side>.<kind>`. `side` is `blue` or `red`. `kind` is `range`, `move` or `angle` |
| `dice` | record, depth 2 | the dice trays: `dice.<side>` is `{ critsUsed, dice: { <die id>: { order, place, face?, pose? } } }`. `place` is `air`, `well` or `shelf`. `face` (1 to 8) is only on the shelf. `pose` is only in the air and the well. The room keeps the shelf |

Step 10 adds the roll history (`rolls`).

A tool entry is `{ which, spawn, at?, pose?, turn?, snap?, mode? }`:

| Field | Meaning |
|---|---|
| `which` | The range number (1 to 5), the movement type (`short`, `medium`, `long`), or `true` for `angle` |
| `spawn` | A random id, new at each spawn. A new `spawn` mounts the tool again in both browsers |
| `at` | `{ x, z }`, the point of a free spawn |
| `pose` | `{ x, y, z, yaw }`, the rest pose |
| `turn` | `{ right, left }`, the bend |
| `snap` | `{ kind, id, side, across }` or `null`: the model or token that the tool touches |
| `mode` | `away` or `toward` (the Toward / Away tool) |

Only the owner of a side writes it, so the two players never write the same entry. The owner writes `pose`, `turn`, `snap` and `mode` when none of them changed for 0.3 s. Positions have 3 decimals, yaw and bend 4. Escape and key 0 delete the own entries. Place, Throw, the Bend button and the selection are not stored. An old document has no tools, which is a valid state, so `SCHEMA` did not change.

How the data is stored:

- **List.** A `Y.Map` from the entity id to a nested `Y.Map` of the entity's fields. A field value is plain JSON. A field that is an object (`tokens` of a character, `heldAt`, `transform`) is replaced as a whole. So two players who change different fields of one entity both keep their change.
- **Order.** Each entity of a list has a hidden `order` number. The store sorts by `order`, then by id, and App does not see `order`. The order is the tray row of `characters` and the stack of `tactics`. With equal numbers from two players, the id decides, the same in both browsers.
- **Record.** A `Y.Map` of fields. With depth 0, each value is one plain value. With depth 1, a value that is a plain object becomes a nested `Y.Map` of its fields. `game` and `setup` have depth 1, so each player's squad and Ready in `setup` (`setup.squads.blue`, `setup.ready.red`) merge. `rosters` and `poses` have depth 0. `tools` has depth 1, so each side's entries merge. A score marker position stays one value.
- **Poses by model id.** A character with a second form has two models (`characters/models.js`), so `poses` is a record by model id, not a field of the character. A removed character deletes the poses of its models.
- **Terrain.** `terrain` stores only `index` and `locked`. App adds the placement from the map data (`withPlacements`), so a fix of the map data reaches old rooms.
- **Schema.** `game.schema` is `SCHEMA` (1). A document or a game file with another schema is not used. Before the first release, all data is test data.

`rosters` holds the loaded roster of each player. The order of `tactics` is the stack order of the cards.

React reads the document through three hooks in `net/useY.js`, built on `useSyncExternalStore`: `useYList`, `useYRecord` and `useYField`. Each returns the value and a setter, in the form of a React `useState`. The setter takes a value or an updater function. It compares the new value with the document and writes only the fields that changed. So the handlers in `App.jsx` such as `handleTokenFlip` keep their code. A handler that writes more than one name runs in `table.transact`, so the document has one update. A game with no connection uses the same document, only without a provider. So single-player and multiplayer run the same code.

Each browser stores the document in IndexedDB (`y-indexeddb`), per room, from step 5 on. A single player room uses the database `mcp-assist-3d/room/<code>`. A multiplayer room uses `mcp-assist-3d/multiplayer/<user id>/<code>`, so two users of one browser never share a database. In a multiplayer room, the server also keeps a snapshot of the document (`docs/feature-auth.md`, "Table on the server"). After a page reload, the table comes back at once, and Yjs syncs the changes that the other player made in the meantime. The room record in `localStorage` of a single player room keeps only the setup: map, rosters, owner, dates (`docs/feature-rooms.md`, "Storage"). The Sandbox has the same document without IndexedDB.

## Moving objects (physics)

Both browsers run Rapier for every body. We cannot send only the inputs and let both browsers compute the same result: the Rapier build we use is not deterministic across machines, and both worlds would have to stay exactly equal from the start. Instead, one browser decides the motion of each moving piece.

There are four kinds of pieces:

- **Models**: either player can move them. A model has a physics body. The rules below decide which browser simulates it.
- **Tools**: the tools of one player (see [What each player controls](#what-each-player-controls)). A tool is a sensor body. It pushes nothing and nothing pushes it. Only the owner moves it. The other browser draws it at the live pose. So tools need no claims.
- **Pieces without a body**: crisis tokens, character tokens on the table, piles, tactic cards and score markers. Either player can move them. The piece has no rest pose. The drop writes its new place into the document.

A new token, pile or supply token (from a Give source, a supply pile, a pile or the Library) is live too. The drag makes its id and its piece key at the press (`loose:`, `pile:` or `token:`). The drag claims the key after the 4 px threshold and sets `spawn` in awareness. The other browser does not have the piece yet, so it draws a preview of it at the live pose, with the same look, height and footprint as the own preview. The drop writes the piece with the same id. Then the claim and `spawn` end, in this order, so the real piece shows before the preview goes. Escape and a drop that makes no piece (over a HUD panel, off the table, on a character) end `spawn` too. A drop on a character gives the token to the character, as before.
- **Dice** (step 10) are player bodies. Only the tray's player simulates them. The other browser moves them as kinematic bodies, to the received poses.

Models do not push models. A dragged model passes through other models and through tokens. It does not pass through terrain. Models are in their own collision group, and that group does not collide with itself. Dice do not move models (dominance groups). So no body pushes a resting model, and the first design had a rule for that: the browser that moves a body claims a body it pushes. This rule is gone. There are no pushed bodies to claim and no contact events.

While two models overlap, the one that moved last shows the overlap mark (a red outline and tint). A drag that ends inside another model puts the model back at the last place of the drag where it overlapped nothing. Place, Place 1 and Throw or Push can still end inside a model, and then the mark shows.

### Rules

1. A body at rest has no owner. Its pose is in the Yjs document.
2. A player action in one browser claims the piece. The actions are a drag of any piece, the turn handle of a crisis token, and for models R, Q / E, Throw or Push, Place and Place 1. The claim is in awareness: `owns: [piece keys]`. When the other player owns the piece, the action does nothing. A drag claims its piece when it starts, after the 4 px threshold. A change of the document that both browsers apply (a new character, a tray that moves, a removed terrain piece, a new map, a mat turn) claims nothing. Both browsers simulate that move from the same document.
3. The owner simulates the model as today. It sends the pose on the `live` channel (see [Pose message](#pose-message)).
4. The other browser makes the model a kinematic body with no contact forces (solver groups 0), so it pushes nothing here. It moves the body towards the latest received pose. A pose counts only while the other player claims the piece. A few lost first poses change nothing on the table, because models pass through models.
5. The rest pose of a model has one writer:
   - Claimed by this browser: this browser writes it.
   - Claimed by the other player: this browser never writes it.
   - Not claimed: the host writes it while the other player is present. Alone, this browser writes it.
   - Both browsers simulate an unclaimed move from the same document, so their results are almost equal. One writer is enough.
6. A model claim ends when the body is asleep and dynamic, and at least 0.2 s old. Each browser checks its own claims on every frame, because a lifted model (R) is kinematic and can fall asleep in the air. It writes the rest pose, then removes the claim. Both go over the `sync` channel, which keeps the order. The other browser sets the exact pose, makes the body dynamic, gives back its contact forces and puts it to sleep.
7. A piece without a body keeps its claim until the drop wrote the document, or until the drag is cancelled. Then the claim is removed.
8. If both players claim the same piece at the same time, the player with the lower Yjs client id keeps it. Both browsers apply the same rule, so they agree without more messages. The other browser removes its claim. Its drag of that piece is cancelled: no drop and no write.
9. When a player disconnects, its claims end. A model of the other player becomes dynamic where it stands, gets its contact forces back and stays awake. This browser simulates it and writes its rest pose. A piece without a body shows its place in the document. A browser that stops without closing the channel (a sleeping laptop) keeps its claims on the other screen for up to 30 s, until the awareness times out.

A rest pose from the other browser for a model that nobody claims: when the pose in `poses` changes and the body stands somewhere else, the body gets the exact pose and goes to sleep. A pose that this browser wrote equals the body, so nothing happens.

### The follow

A piece that the other player moves does not jump to each pose. On each frame it goes `1 − e^(−dt / 0.05)` of the way to its latest pose. A model's rotation uses slerp, a yaw uses the shortest turn. The follow needs no clock and hides lost packets and jumps. Packets are unordered, so each piece and the cursor keep the sequence number of their last pose, and an older pose is dropped. If the motion looks bad, a later change can add a delay of about 100 ms and interpolate between poses.

A piece that the other player moves shows a footprint on the table or terrain under it, because it hangs above the table. The tool of the other player goes to its latest pose from the live channel or from the document, whichever came last.

### Bodies moved by the other browser

A model that the other browser moves must not push anything in this browser. Otherwise this browser's physics changes models and tokens that the other browser does not change, and the two tables stay different.

1. While the model is claimed by the other player, its colliders produce no contact forces (Rapier solver groups). A kinematic body pushes everything it touches, with no limit on the force. When a pose jumps, the body could throw a model that lies still, but only in this browser.
2. When the claim ends (rule 6), contact forces come back and the model becomes dynamic again.
3. Dice of the other player (step 10) stay kinematic, so they act as fixed obstacles for this browser's dice. The owner's browser agrees, because there this browser's dice push nothing.
4. Two dice that move at the same time, one per player, pass through each other. This is rare, so we accept it.

TTS does it differently: the host simulates everything, and the other players see their own drags with a delay. With the rules above, each player sees their own drags with no delay.

### Pose message

The live packet is JSON, sent on the `live` channel, at most every 33 ms (about 30 per second). It has only the parts that changed since the last packet:

```
{ s, p?, c? }
```

| Field | Content |
|---|---|
| `s` | A sequence number. It grows with each packet that is sent |
| `p` | Piece key → numbers. A model (`character:<model id>`): `[x, y, z, qx, qy, qz, qw]`. A tool (`tool:<kind>`): `[x, y, z, yaw, right, left]`. A crisis token (`token:<id>`): `[x, z, yaw]`. A character token on the table (`loose:<id>`), a pile (`pile:<id>`), a tactic card (`tactic:<id>`), a marker (`marker:<blue, red or round>`): `[x, z]` |
| `c` | The cursor, see below |

Positions have 3 decimals (0.001"). Rotations, yaw and bend have 4. A model pose is about 70 bytes, not the 170 of the first design. The receiver keeps the last sequence number per piece key and per cursor, and drops an older pose. A bad packet is ignored. It is not logged. Dice from step 10 use the same channel.

### Cursor message

`c` in the live packet: `[x, y, z]`, the table or terrain point under the own pointer, or `null` when the pointer left the table or the canvas. At most every 100 ms (10 per second), and only when it moved. The other browser shows a flat ring in the side color of the other player at the latest received point. The ring hides after `null`, and when the other player is gone. While the own Select squad is on, no cursor is sent: `null` goes out once at the start, then nothing until the pointer moves after the end.

### Dice

- Dice are player bodies. Only the tray's player rolls them, so that player's physics decides the results, as in the single-player app.
- The other browser sees the dice fly. When a die rests, its rest pose comes through the document, so both browsers find the same top face.
- The roller writes the history entry to the document.

So the roller's browser decides the roll, and a changed client could cheat. This does not matter: the app is a free hobby project for friendly games. So the plan has no protection against cheating.

## Room and players

- Players have accounts (step 7, `docs/feature-auth.md`). The name, the avatar and the side come from the room and from the server, not from the player. The peer id is new at each table open and is not stored. The old plan kept it in `sessionStorage` and asked for a typed name. A duplicated tab copies `sessionStorage`, and the account makes the name known, so both are gone.
- The host chooses a side: blue or red. The guest gets the other side. In a multiplayer room where the user has the Red seat, the start view is the Blue view turned 180° around the mat center, so the own side is at the bottom of the screen. Position `[0, 32.5, -42.9]`, target `[0, 0, -10.4]`. Space returns to it. Single player rooms and the Sandbox keep the Blue view, because one player plays both sides there.
- The room toolbar shows both seats: team name in the side color, avatar and name. The own seat says "You". The other seat shows the status of [Connect flow](#connect-flow). When the guest seat was free at open, the name and avatar come from the guest's `hello`, and **Copy link** hides.
- Version 1 has two players. A third peer (a spectator) needs a connection to each other peer. Yjs supports that, but it is not in this plan.
- When the connection drops, both sides show "Reconnecting". The guest runs the connect flow again with the same room code. Yjs syncs what changed. Step 8 does the case of a closed or reloaded page. The "Reconnecting" message and a dropped network come in step 11.

### What each player controls

Each side has its own set of tools and its own dice tray.

| Object | Who can move or use it |
|---|---|
| Own range, movement and Toward / Away tools | Only that player |
| Own dice tray: roll, reroll, add dice for Crits, change a face, clear | Only that player |
| The opponent's tools and tray | Nobody else. Both players see them. The opponent's tool has no buttons or outline, and a click goes to the piece below. The opponent's dice panel shows the results and the history, with its buttons turned off |
| Models, tokens, piles, tactic cards, score markers, crisis cards, map, mat turn, deploy line | Both players. Game effects such as push and throw move enemy models, so both players must be able to move any model |

The other player's selection shows too. A character or crisis token that they select has an outline in their side color (blue or red), under the own selection and range marks. Their selected tool has the green or red footprint against their tool target, calculated from the poses this browser shows. While they turn a snapped range tool, the piece under their pointer has the green or red range outline. A piece that this browser does not have shows nothing. Only the other player's selection and range marks are shared this way, not hover.

A tool can snap to any model or token, also of the opponent, because players measure range to enemy models.

With no connection, the app works as today: one player uses both trays and one set of tools.

## Security and abuse

- The room code is the only secret. It has about 40 bits of randomness, so nobody can guess it. A person with the link can join.
- The signaling endpoint is public, so anyone can call it. Limits: the message size limit, 50 messages per room, the TTL, and CORS for browsers. Lambda reserved concurrency caps how many calls run at the same time, if the account quota allows it. This also caps the Atlas connections, because each Lambda instance opens at most 2. The budget alert shows abuse. To stop all traffic at once, set reserved concurrency to 0.
- Abuse of signaling can use the storage and the connections of the Atlas cluster. The limits above protect it. The cluster is not shared with wuclub, so abuse cannot affect wuclub.
- The Atlas IP access list allows every address. So only the database user and password protect the cluster.
- The SDP contains the local IP addresses of the player. Browsers hide them behind mDNS names (`*.local`) by default. The signaling rows are deleted after 1 hour.

## Local testing

Every part must work on one Mac, with no AWS or Cloudflare account and no second person. Each player is a different browser: Chrome, Safari or Firefox. From phase 2 on, each phase is tested in three pairs: Chrome and Safari, Chrome and Firefox, Safari and Firefox.

`BroadcastChannel` cannot connect the players, because it works only between tabs of one browser. So the local setup uses the same HTTP signaling as production.

| Part | Production | Local |
|---|---|---|
| App | Netlify | `pnpm dev` (web and API), `http://localhost:5173` |
| Signaling | Lambda function URL with the MongoDB store | The same Hono app in a Node process on port 8787, with the memory store. Vite forwards `/api/*` to it |
| MongoDB | Atlas Free cluster, database `assist3d` | Not needed. Only to test the MongoDB store: `mongo` in Docker |
| TURN | Cloudflare (phase 6) | coturn in Docker, from step 8. `pnpm --filter api turn:up` and `turn:down` |

Vite forwards `/api/*` to the API process and removes `/api`. The same Hono app runs in Lambda and in Node, so no code converts requests into Lambda events (backend doc, "Local development"). The client reads the API address from `VITE_API_URL`. In dev, it is `/api`. The memory store loses all rooms when the API process restarts, which is fine for tests.

To test the MongoDB store code before a deploy, start `mongo` in Docker and run the API with `STORE=mongo` and `MONGODB_URI=mongodb://localhost:27017`. Local dev never uses the Atlas cluster. So a bug in local code cannot change production data.

To connect, log in with a dev login in each browser (for example `alice` and `bob`). The first player creates a multiplayer room. The second opens the room link and joins. `README.md` has the steps.

### Browser differences

- Each browser has its own `localStorage` and IndexedDB. So logins and the stored tables do not collide.
- All three browsers treat `http://localhost` as a secure context.
- The maximum message size is different in Firefox. See [Data channels](#data-channels).
- To log bytes per game, the app reads the selected candidate pair from `pc.getStats()`. Chrome and Safari give it through the transport stats (`selectedCandidatePairId`). Firefox has used a `selected` field on the candidate pair instead. The code must support both.
- Risk: all three browsers can hide local addresses behind mDNS names (`*.local`). On one Mac these names should resolve, but this is not tested yet for every pair. This happened on 2026-10-09: the browsers had only a `srflx` candidate (the public router address), and most home routers do not send such packets back. So every dev build has the local coturn server in its ICE list (`net/ice.js`, `iceConfig`). Start it with `turn:up`. Add `?relay` to test the relay path.

### Debug flags

Flags in the page URL. They work only in dev builds (`import.meta.env.DEV`), so a player cannot turn them on by mistake.

| Flag | Does |
|---|---|
| `?relay` | Built in step 8. Sets `iceTransportPolicy: 'relay'`, so all data goes through the TURN server. Tests the relay path before Cloudflare |
| `?drop=<percent>` | Built in step 9. Drops that percent of the packets on the `live` channel. The receiving browser drops them, so the browser with the flag shows the effect. Localhost loses no packets, so without this flag the follow and the rest pose rules are not tested |
| `?delay=<ms>` | Built in step 9. Delays each packet of the `live` channel by that many ms, in the receiving browser. The delay can reorder packets as the network would. `?drop=10&delay=100` is a usual pair |
| `?build=test` | Built in step 8. Sends a fake app version in `hello`, to test the version warning |

## Code layout

```
apps/web/src/
  Table.jsx       opens the document of a room or the Sandbox, then mounts App. Multiplayer rooms: reads the table from the server, runs the table writer, starts the connection, pauses the guest's writer while connected
  rooms/tableDoc.js  openTableDoc (IndexedDB, timeout, memory fallback), watchRoomRecord
apps/web/src/net/
  doc.js          the layout of the Y.Doc, SCHEMA, createTable, fillTable, encodeTable. No React
  collections.js  the list and record stores over a Y.Map: diff writes, order, snapshots. No React
  useY.js         React hooks: useYList, useYRecord, useYField
  ice.js          the STUN list (step 8). Step 13: GET /ice
  signaling.js    createSignaling: hello, offer, answer, bye, poll with x-after
  peer.js         connectRoom: roles, timeouts, states, RTCPeerConnection (built in step 8)
  syncChannel.js  Yjs sync and awareness over the sync channel, frames of 16 KB
  debugFlags.js   ?build, ?relay, ?drop, ?delay (dev builds only)
  ownership.js    claims, owner, the writer of a rest pose (step 9)
  live.js         the live hub: packets, sequence per key, rounding, ?drop, ?delay (step 9)
  livePose.js     the number layout of each piece kind, the follow step (step 9)
  traffic.js      bytes of the selected candidate pair from getStats (step 9)
apps/web/src/drag/
  pointerDrag.js  startPointerDrag: the gesture of every drag, claims, cancel (step 9)
  tablePoint.js   the table, board or terrain point under a screen point (step 9)
apps/web/src/components/
  RoomPlayers.jsx  the seats and the connection status in the room toolbar
  LiveSync.jsx     sends the own live poses and the cursor, keeps the received ones (step 9)
  RemoteCursor.jsx the other player's cursor (step 9)
  DragFootprint.jsx the footprint of a dragged piece (step 9)
  storedTool.js    the tool entry: rounding, equality, free spawn per side (step 9)
  useLiveFollow.js the follow of a piece without a body (step 9)
apps/web/src/characters/
  overlap.js       which models show the overlap mark (step 9)
  claims.js        when a model claim keeps, rests or ends (step 9)
apps/api/
  src/routes/signal.ts  signaling routes: messages (step 8). ICE servers in step 13
  src/middleware/session.ts  requireSession: checks the token, reads no user
  src/rooms/seats.ts    the seat cache, 30 s per room
  src/stores/           messages store: memory and MongoDB. The MongoDB store creates the indexes
  README.md             local mongo and coturn in Docker
infra/
  README.md             deploy steps, Atlas CLI commands for the database user and the access list
```

The rest of `apps/api` and `infra/` is in the backend doc ("Code", "Infrastructure").

New packages in `apps/web`: `yjs` and `y-indexeddb` (step 5), `y-protocols` and `lib0` (step 8).

## Phases

Each phase ends with a working app. Do not open the app in a browser. Check with type checks, tests and `pnpm --filter web build`. The user checks the result in the browser. From phase 2 on, the user tests in the three browser pairs of [Local testing](#local-testing).

The plan `docs/plans/implement-backend.md` gives the order of the phases and their steps. The API, the AWS parts and the deploy come first, in its steps 2 to 4. From step 3 on, each backend change is deployed when its step is done.

1. **Shared state in a local Yjs document.** Move the table state from `useState` into the document: map, mat turns, deploy line, crisis, tokens, the character list, terrain, setup and the rosters. Write rest poses when bodies sleep. A room stores its document in IndexedDB. Save and load a game as a file. No network. The app works as before. The tools stay in React state until phase 3 (step 5, decision 1).
2. **Two browsers, one Mac.** Signaling routes in `apps/api`, with the memory store and the MongoDB store. The room link and the players in the room toolbar. `peer.js` and Yjs sync (step 8). Awareness comes in step 9. App version check in `hello`, and the `?build` flag. Discrete changes sync: map, crisis cards, token flips and markers, new characters, damage and power. If a browser pair cannot connect directly, add the local coturn server and `?relay` here instead of in phase 6.
3. **Moving objects. Done (step 9).** Models pass through models. Claims in awareness, one writer of each rest pose. The `live` channel and the cursor. The tools (range, move, Toward/Away) are in the document, per side. Bodies moved by the other browser push nothing. Both players drag models, tokens, piles, cards and markers. Each player uses only their own tools. The `?drop` and `?delay` flags. The bytes of each connection in the console.
4. **Dice.** Dice and roll history move into the document. Dice are player bodies on the `live` channel. Only the tray's player can use its dice panel.
5. **Reconnect.** Reconnect after a reload or a dropped connection. The IndexedDB copy of the Yjs document was done in phase 1. It is tested locally first. The AWS parts of this phase (CDK stacks, Atlas database user, budget alert) moved to steps 3 and 4 of the plan.
6. **TURN.** Local coturn and `?relay` first (if not done in phase 2), then Cloudflare TURN through `GET /ice`. The app shows the connection type (direct or relayed). Cloudflare only if the first real games (plan step 12) show that direct connections fail too often.

## Open questions

1. **Signaling vendor.** AWS Lambda (this plan) or a Cloudflare Worker with a Durable Object? The Worker gives a WebSocket, so no polling and faster reconnects. It is also free with no end date, and it could also make the TURN credentials. The cost is a second vendor. Hono also runs on Cloudflare Workers, so a later move is smaller.
2. **Cloudflare TURN account.** No paid plan is needed: the TURN FAQ says the free 1,000 GB come before any charges. A search result says no payment card is needed to start, but no official page confirms it. Check when we create the account.
3. **AWS account.** Answered in `docs/feature-backend.md`: the existing personal account.
4. **Spectators.** Needed later?
5. **Atlas cluster tier and region.** Answered in `docs/feature-backend.md`: a new Atlas Free cluster in its own Atlas project, on AWS `eu-central-1`. Its limits are in "Free cluster limits".
6. **Atlas access list.** Answered in `docs/feature-backend.md`: the Atlas CLI sets `0.0.0.0/0` on the new cluster.
7. **Shared cluster.** Answered in `docs/feature-backend.md`: the cluster is not shared with wuclub. So a change of the wuclub cluster cannot stop signaling.

## Sources

- [AWS Free Tier plans](https://aws.amazon.com/free/): Free plan closes after 6 months; Always Free applies on both plans.
- [AWS Lambda pricing](https://aws.amazon.com/lambda/pricing/): 1M requests and 400,000 GB-s per month; $0.20 per 1M requests.
- [Lambda: function URLs vs API Gateway](https://docs.aws.amazon.com/lambda/latest/dg/furls-http-invoke-decision.html): "There are no additional charges for the URL endpoint itself."
- [DynamoDB pricing](https://aws.amazon.com/dynamodb/pricing/): 25 GB, 25 WCU, 25 RCU; provisioned capacity only. For the DynamoDB fallback.
- [MongoDB TTL indexes](https://www.mongodb.com/docs/manual/core/index-ttl/): a background task deletes expired documents about every 60 seconds.
- [Atlas free cluster limits](https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/): connection and operation limits of M0.
- wuclub `apps/apiv2/src/dal/client.ts`: the `MongoClient` cached in module scope that this plan copies.
- [API Gateway pricing](https://aws.amazon.com/api-gateway/pricing/): WebSocket free tier for 12 months; $1.00 per 1M messages, $0.25 per 1M connection minutes.
- [CloudWatch pricing](https://aws.amazon.com/cloudwatch/pricing/): 5 GB of logs per month.
- [AWS free data transfer out, 100 GB per month](https://aws.amazon.com/blogs/aws/aws-free-tier-data-transfer-expansion-100-gb-from-regions-and-1-tb-from-amazon-cloudfront-per-month/)
- [Cloudflare Realtime pricing](https://developers.cloudflare.com/realtime/sfu/platform/pricing/): first 1,000 GB per month free, shared by SFU and TURN.
- [Cloudflare TURN FAQ](https://developers.cloudflare.com/realtime/turn/faq/): $0.05 per GB after 1,000 GB free; only Cloudflare-to-client data counts; STUN free and unlimited.
- [Cloudflare TURN overview](https://developers.cloudflare.com/realtime/turn/): limits per TURN connection; TURN free when used with the SFU.
- [Cloudflare TURN credentials](https://developers.cloudflare.com/realtime/turn/generate-credentials/): generated by a backend with an API token.
- [Cloudflare RealtimeKit](https://developers.cloudflare.com/realtime/realtimekit/) and [its pricing](https://developers.cloudflare.com/realtime/realtimekit/pricing/): video and voice calls; price per participant minute.
- [Cloudflare Realtime SFU](https://developers.cloudflare.com/realtime/sfu/) and [its data channels](https://developers.cloudflare.com/realtime/sfu/datachannels/): needs your own backend; publish and subscribe.
- [Cloudflare Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing): available on the Workers Free plan.
- [y-webrtc public signaling server status](https://discuss.yjs.dev/t/is-the-public-signaling-server-that-ships-by-default-with-y-webrtc-still-working/1979)
- [Trystero](https://github.com/dmotz/trystero)
