# Feature: Peer-to-peer play

Status: plan. Not started. See [Open questions](#open-questions) at the end.

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
| Moving objects | The player who moves an object simulates it and streams its pose over an unreliable data channel. The rest pose goes into the Yjs document |
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
| `GET /ice` | Returns the ICE server list. Later also short-lived TURN credentials, see [STUN and TURN](#stun-and-turn) |

The poll sends `after` in the `x-after` header, not in the query. So the poll URL stays the same between polls, and the browser sends one CORS preflight for it, not one per poll (backend doc, "Preflight per URL"). The CORS config of the function URL allows this header.

### Connect flow

1. The host presses **Host game**. The browser makes a random room code and a link: `https://<site>/#room=K7Q2-M9XD`. The code is in the URL hash, so Netlify never receives it. The host posts `hello` and polls every 2 s.
   Rooms exist already in one browser (`docs/feature-rooms.md`). A single player room has a code of this format, and its page is this link. A multiplayer room (step 7, `docs/feature-auth.md`) is on the server, and its link opens the join page for a guest. So the host shares the link of a multiplayer room they created. A single player room never connects.
2. The host sends the link to the other player (chat, email).
3. The guest opens the link. The guest posts `hello`, reads the host's `hello`, creates the offer, waits until ICE gathering ends (at most 3 s), and posts the `offer`.
4. The host reads the offer, creates the answer the same way, and posts the `answer`.
5. The guest reads the answer. The data channels open. Both stop polling.

When the host deletes the room while the guest is connected, the host's browser tells the guest's browser over the connection. The guest then leaves the room at once, with "The host deleted room K7Q2-M9XD.", and the browser deletes its local copy. This needs no server request. Until step 8, the guest finds out at their next table write, which gets 404 (`docs/feature-auth.md`, "Rules").

Both `hello` messages carry the app version (the build id). If the two versions are different, both players see a warning: "Your opponent uses a different version of the app. Both players should reload the page." The reason is in [State](#state), category 1.

The guest makes the offer, not the host. The reason: an offer that waits for minutes until someone joins can stop working, because routers forget address mappings that are not used. With this order, the offer and the answer are created seconds apart.

Polling stops after 15 minutes with no guest. So a forgotten tab does not make requests forever.

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

Only category 4 (see [State](#state)) sends data all the time, so it decides the TURN cost. Each packet has about 90 bytes of headers (IP, UDP, DTLS, SCTP, TURN). One pose in JSON with full number precision is about 170 bytes.

Estimate for one 2-hour game. The numbers are calculated, not measured:

| Item | Assumption | Data |
|---|---|---|
| Models, tokens and tools being moved | 20 minutes in total, 30 packets per second | about 9 MB |
| Dice in the air | 100 rolls of about 8 dice, 3 s each | about 13 MB |
| Cursor | 10 packets per second. The mouse moves over the table for 1 hour per player | about 10 MB |
| Categories 2 and 3, keepalive packets | | about 1 MB |
| **Total** | | **about 35 MB** |

So 1,000 GB is enough for about 28,000 relayed games per month. It is not clear if Cloudflare counts the data twice when both players use the relay. In that case, the number is about 14,000. Only games where the direct connection fails use TURN.

From phase 3, log the bytes of each game from `pc.getStats()` (`bytesSent` and `bytesReceived` of the selected candidate pair). Then replace this estimate with the measured numbers. If the traffic is too high, there are three ways to send less: send less often, round the numbers, or use a binary format.

### Other Cloudflare Realtime products

From Cloudflare Realtime we need only TURN and the free STUN server.

| Product | What it is | Why we do not use it |
|---|---|---|
| RealtimeKit | SDK and ready-made UI for video and voice calls: participant grid, media controls, chat, polls, recording. It runs on the Cloudflare SFU | It is made for calls. It costs per participant per minute ($0.002 for audio and video), and the pricing page lists no free amount |
| Realtime SFU | A server that forwards media and data channels from one browser to many (publish and subscribe). It supports reliable and unreliable data channels | All data goes through Cloudflare, not directly between browsers. It still needs our own backend, which holds the app secret and does the signaling. It helps only with many players |

Cloudflare Realtime does not do signaling for direct connections. So with Cloudflare TURN we still need our own signaling service.

## Data channels

One `RTCPeerConnection` per pair of players, with two data channels:

| Channel | Settings | Carries |
|---|---|---|
| `sync` | reliable, ordered (the default) | Categories 2 and 3: Yjs sync messages. Also Yjs awareness messages (`y-protocols`) |
| `poses` | `ordered: false`, `maxRetransmits: 0` | Category 4: poses of moving objects and dice, cursor positions. A lost packet is not sent again, because the next one replaces it |

The data is encrypted (DTLS), also through TURN. Data channels need no camera or microphone permission.

Message size: before sending a big Yjs update (the first sync of a game), check `pc.sctp.maxMessageSize`. Split the message if it is bigger. The value depends on both browsers, because each browser states in the SDP how big a message it can receive. Firefox has a different limit than Chrome and Safari. So test the first sync of a big game in each browser pair.

## State

The data has four categories. There is also local state, which is not sent.

| # | Category | Examples | Where | Channel |
|---|---|---|---|---|
| 1 | Assets | models, textures, card images, map images | Netlify, or AWS later. Loaded over HTTPS | None. Never through WebRTC |
| 2 | Set-up: changes once per game | rosters, crisis cards, map, deploy line | Yjs document | `sync` |
| 3 | Rare changes | rest poses of models, tokens and tools; card flips; damage and power; healthy or injured side; tokens gained or lost; mat turns; dice results and roll history | Yjs document | `sync` |
| 4 | Presence: what the other player does now | dice in the air; a model, token or tool being moved; cursor | Not stored | `poses` |
| | Players | name, side (blue or red), claims (`owns`), selection | Yjs awareness | `sync` |
| | Local | camera, hover, labels, debug mode, open card popup, open dice menu | React state, as today | Not sent |

The same object can be in two categories at different times. While a player drags a model, its pose is category 4. When the model stops, its rest pose goes into the document as category 3.

**Category 1.** The game state refers to assets and data by id: character keys, crisis card ids, map id. So both players must run the same version of the app. See the version check in [Connect flow](#connect-flow).

**Category 4** only shows each player what the other player does. It does not need to be exact: packets can be lost, and the motion can jump. The final state always comes through category 3. So category 4 uses the unreliable `poses` channel, and its send rates are starting values. We measure the traffic (see [Traffic per game](#traffic-per-game)) and change the rates after that.

The cursor is in category 4, not in awareness. Awareness goes over the reliable, ordered `sync` channel. On that channel, a lost packet is sent again, and all messages after it wait. So a fast cursor stream would delay card flips and other Yjs changes.

### Yjs document

Each name is a top-level `Y.Map` of the `Y.Doc`. Step 5 made the first ten. The tools come in step 9 and the dice in step 10.

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

Later steps add:

```
  tools: Y.Map<side, Y.Map<kind, Y.Map>>   step 9: per side, range and move tool: which one, pose, bend, snap target
  dice: Y.Map<trayKey, Y.Map>              step 10: dice (id -> pose, face, place), history (Y.Array), critsUsed
```

How the data is stored:

- **List.** A `Y.Map` from the entity id to a nested `Y.Map` of the entity's fields. A field value is plain JSON. A field that is an object (`tokens` of a character, `heldAt`, `transform`) is replaced as a whole. So two players who change different fields of one entity both keep their change.
- **Order.** Each entity of a list has a hidden `order` number. The store sorts by `order`, then by id, and App does not see `order`. The order is the tray row of `characters` and the stack of `tactics`. With equal numbers from two players, the id decides, the same in both browsers.
- **Record.** A `Y.Map` of fields. With depth 0, each value is one plain value. With depth 1, a value that is a plain object becomes a nested `Y.Map` of its fields. `game` and `setup` have depth 1, so each player's squad and Ready in `setup` (`setup.squads.blue`, `setup.ready.red`) merge. `rosters` and `poses` have depth 0. A score marker position stays one value.
- **Poses by model id.** A character with a second form has two models (`characters/models.js`), so `poses` is a record by model id, not a field of the character. A removed character deletes the poses of its models.
- **Terrain.** `terrain` stores only `index` and `locked`. App adds the placement from the map data (`withPlacements`), so a fix of the map data reaches old rooms.
- **Schema.** `game.schema` is `SCHEMA` (1). A document or a game file with another schema is not used. Before the first release, all data is test data.

`rosters` holds the loaded roster of each player. The order of `tactics` is the stack order of the cards.

React reads the document through three hooks in `net/useY.js`, built on `useSyncExternalStore`: `useYList`, `useYRecord` and `useYField`. Each returns the value and a setter, in the form of a React `useState`. The setter takes a value or an updater function. It compares the new value with the document and writes only the fields that changed. So the handlers in `App.jsx` such as `handleTokenFlip` keep their code. A handler that writes more than one name runs in `table.transact`, so the document has one update. A game with no connection uses the same document, only without a provider. So single-player and multiplayer run the same code.

Each browser stores the document in IndexedDB (`y-indexeddb`), per room, from step 5 on. A single player room uses the database `mcp-assist-3d/room/<code>`. A multiplayer room uses `mcp-assist-3d/multiplayer/<user id>/<code>`, so two users of one browser never share a database. In a multiplayer room, the server also keeps a snapshot of the document (`docs/feature-auth.md`, "Table on the server"). After a page reload, the table comes back at once, and Yjs syncs the changes that the other player made in the meantime. The room record in `localStorage` of a single player room keeps only the setup: map, rosters, owner, dates (`docs/feature-rooms.md`, "Storage"). The Sandbox has the same document without IndexedDB.

## Moving objects (physics)

Both browsers run Rapier for every body. We cannot send only the inputs and let both browsers compute the same result: the Rapier build we use is not deterministic across machines, and both worlds would have to stay exactly equal from the start. Instead, one browser decides the motion of each moving object.

There are two kinds of bodies:

- **Player bodies**: the tools and the dice of one player (see [What each player controls](#what-each-player-controls)). Only that player's browser simulates them, always. The other browser always moves them as kinematic bodies, to the received poses (rule 4). So player bodies need no claims, and two players never fight over them.
- **Shared bodies**: models and tokens. Either player can move them. The rules below decide which browser simulates a moving shared body.

### Rules

1. A body at rest has no owner. Its pose is in the Yjs document.
2. When a player starts to drag a model or a token, that player's browser **claims** the body. The claim is in awareness: `owns: [ids]`.
3. The owner simulates the body as today. It sends the body's pose on the `poses` channel about 30 times per second: every 4th physics step, because the step is 1/120 s. A player body works the same way, but its player is always the owner.
4. The other browser switches the body to `kinematicPosition` and moves it to the latest received pose. Lost packets and jumps are acceptable (category 4). If the motion looks bad, add a delay of about 100 ms and interpolate between poses.
5. When the owner's body falls asleep, the owner writes the rest pose to the document and then removes the claim. Both go over the `sync` channel, which keeps the order. The other browser sets the exact rest pose, switches the body back to dynamic and puts it to sleep. A player body stays kinematic in the other browser.
6. A shared body that is not owned can be pushed by a moving body, for example a die that hits a model. The browser that simulates the moving body claims the pushed body. It finds this with Rapier contact events.
7. If both players claim the same shared body at the same time, the player with the lower Yjs client id keeps it. Both browsers apply the same rule, so they agree without more messages.
8. When a player disconnects, its claims end. The other browser simulates the shared bodies from where they are. The player bodies of the disconnected player stop where they are until that player comes back.

### Bodies moved by the other browser

A body that the other browser moves must not push anything in this browser. Otherwise this browser's physics changes models and tokens that the other browser does not change, and the two tables stay different.

1. While the body moves, it pushes nothing: its colliders produce no contact forces (Rapier solver groups). This starts with the first pose or claim that arrives, whichever comes first. The reason: a kinematic body pushes everything it touches, with no limit on the force. When a pose jumps, for example 10 cm in one step, the body can throw a model that lies still, but only in this browser. Only the owner's physics decides what a moving body hits. Pushed shared bodies reach this browser through rule 6.
2. When the body rests (rule 5), contact forces come back. A shared body becomes dynamic again. A player body stays kinematic, so it acts as a fixed obstacle: this browser's dice bounce off the other player's tool, but cannot move it. The owner's browser agrees, because there this browser's dice push nothing (point 1).
3. Two bodies that move at the same time, one per player, pass through each other. Example: dice from both trays meet in the air. This is rare, so we accept it.

TTS does it differently: the host simulates everything, and the other players see their own drags with a delay. With the rules above, each player sees their own drags with no delay.

### Pose message

One packet every 4th physics step (about 30 per second), with every body this browser owns that moved since the last packet: object id, step number, position (3 numbers), rotation (4 numbers). Start with JSON. Change to a binary format only if we measure that it is too big.

### Cursor message

The cursor position on the table (x, z), at most 10 times per second, and only when it moved. It goes on the `poses` channel. The other browser shows the cursor at the latest received position.

### Dice

- Dice are player bodies. Only the tray's player rolls them, so that player's physics decides the results, as in the single-player app.
- The other browser sees the dice fly. When a die rests, its rest pose comes through the document, so both browsers find the same top face.
- The roller writes the history entry to the document.

So the roller's browser decides the roll, and a changed client could cheat. This does not matter: the app is a free hobby project for friendly games. So the plan has no protection against cheating.

## Room and players

- No accounts. Each browser makes a random peer id and keeps it in `sessionStorage`. The player types a name once (kept in `localStorage`).
- The host chooses a side: blue or red. The guest gets the other side. The default camera turns 180° for the red player, so the own side is at the bottom of the screen.
- Version 1 has two players. A third peer (a spectator) needs a connection to each other peer. Yjs supports that, but it is not in this plan.
- When the connection drops, both sides show "Reconnecting". The guest runs the connect flow again with the same room code. Yjs syncs what changed.

### What each player controls

Each side has its own set of tools and its own dice tray.

| Object | Who can move or use it |
|---|---|
| Own range and movement tools | Only that player |
| Own dice tray: roll, reroll, add dice for Crits, change a face, clear | Only that player |
| The opponent's tools and tray | Nobody else. Both players see them. The opponent's dice panel shows the results and the history, with its buttons turned off |
| Models, tokens, crisis cards, map, mat turn, deploy line | Both players. Game effects such as push and throw move enemy models, so both players must be able to move any model |

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
| TURN | Cloudflare (phase 6) | coturn in Docker |

Vite forwards `/api/*` to the API process and removes `/api`. The same Hono app runs in Lambda and in Node, so no code converts requests into Lambda events (backend doc, "Local development"). The client reads the API address from `VITE_API_URL`. In dev, it is `/api`. The memory store loses all rooms when the API process restarts, which is fine for tests.

To test the MongoDB store code before a deploy, start `mongo` in Docker and run the API with `STORE=mongo` and `MONGODB_URI=mongodb://localhost:27017`. Local dev never uses the Atlas cluster. So a bug in local code cannot change production data.

To connect, open `http://localhost:5173` in one browser and press **Host game**. Copy the room link into the other browser.

### Browser differences

- Each browser has its own `sessionStorage`, `localStorage` and IndexedDB. So peer ids, player names and the stored tables do not collide.
- All three browsers treat `http://localhost` as a secure context.
- The maximum message size is different in Firefox. See [Data channels](#data-channels).
- To log bytes per game, the app reads the selected candidate pair from `pc.getStats()`. Chrome and Safari give it through the transport stats (`selectedCandidatePairId`). Firefox has used a `selected` field on the candidate pair instead. The code must support both.
- Risk: all three browsers can hide local addresses behind mDNS names (`*.local`). On one Mac these names should resolve, but this is not tested yet for every pair. If a pair cannot connect, use the local coturn server with `?relay`.

### Debug flags

Flags in the page URL. They work only in dev builds (`import.meta.env.DEV`), so a player cannot turn them on by mistake.

| Flag | Does |
|---|---|
| `?relay` | Sets `iceTransportPolicy: 'relay'`, so all data goes through the TURN server. Tests the relay path before Cloudflare |
| `?drop=10&delay=100` | Drops 10 % of the packets on the `poses` channel and delays the rest by 100 ms. Localhost loses no packets, so without this flag the interpolation and the rest pose rules are not tested |
| `?build=test` | Sends a fake app version in `hello`, to test the version warning |

## Code layout

```
apps/web/src/
  Table.jsx       opens the document of a room or the Sandbox, then mounts App. Multiplayer rooms: reads the table from the server and runs the table writer
  rooms/tableDoc.js  openTableDoc (IndexedDB, timeout, memory fallback), watchRoomRecord
apps/web/src/net/
  doc.js          the layout of the Y.Doc, SCHEMA, createTable, fillTable, encodeTable. No React
  collections.js  the list and record stores over a Y.Map: diff writes, order, snapshots. No React
  useY.js         React hooks: useYList, useYRecord, useYField
  signaling.js    Signaling interface and its HTTP version (local API and Lambda)
  peer.js         RTCPeerConnection, data channels, ICE servers, reconnect
  syncChannel.js  Yjs sync and awareness over the sync channel (y-protocols)
  poses.js        sends poses of owned bodies, receives and interpolates
  ownership.js    claim and release rules
  debugFlags.js   ?relay, ?drop, ?delay, ?build (dev builds only)
apps/api/
  src/routes/signal.ts  signaling routes: messages, ICE servers
  src/stores/           messages store: memory and MongoDB. The MongoDB store creates the indexes
  README.md             local mongo and coturn in Docker
infra/
  README.md             deploy steps, Atlas CLI commands for the database user and the access list
```

The rest of `apps/api` and `infra/` is in the backend doc ("Code", "Infrastructure").

New packages in `apps/web`: `yjs` and `y-indexeddb` (step 5), `y-protocols` (step 8).

## Phases

Each phase ends with a working app. Do not open the app in a browser. Check with type checks, tests and `pnpm --filter web build`. The user checks the result in the browser. From phase 2 on, the user tests in the three browser pairs of [Local testing](#local-testing).

The plan `docs/plans/implement-backend.md` gives the order of the phases and their steps. The API, the AWS parts and the deploy come first, in its steps 2 to 4. From step 3 on, each backend change is deployed when its step is done.

1. **Shared state in a local Yjs document.** Move the table state from `useState` into the document: map, mat turns, deploy line, crisis, tokens, the character list, terrain, setup and the rosters. Write rest poses when bodies sleep. A room stores its document in IndexedDB. Save and load a game as a file. No network. The app works as before. The tools stay in React state until phase 3 (step 5, decision 1).
2. **Two browsers, one Mac.** Signaling routes in `apps/api`, with the memory store and the MongoDB store. Host and join UI, the room link. `peer.js`, Yjs sync and awareness. Name and side. App version check in `hello`, and the `?build` flag. Discrete changes sync: map, crisis cards, token flips and markers, new characters, damage and power. If a browser pair cannot connect directly, add the local coturn server and `?relay` here instead of in phase 6.
3. **Moving objects.** Player bodies and shared bodies, ownership, the pose channel, the cursor. The tools (range, move, Toward/Away) move into the document, per side. Bodies moved by the other browser push nothing. Drag of models and tokens by both players. Each player uses only their own tools. The `?drop` and `?delay` flags. Log the bytes of each game from `pc.getStats()`.
4. **Dice.** Dice and roll history move into the document. Dice are player bodies. Only the tray's player can use its dice panel.
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
