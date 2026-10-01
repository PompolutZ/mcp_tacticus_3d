# Feature: Peer-to-peer play

Status: plan. Not started. See [Open questions](#open-questions) at the end.

## Goal

Two players play one game from two browsers. Both see the same table: map, mat turn, crisis cards, tokens, models, tools and dice. A move by one player shows on the other screen within a fraction of a second.

The game data goes directly from browser to browser over WebRTC. We run no game server. We run only a small service that helps the two browsers find each other (signaling). It must cost nothing.

## Summary

| Part | Choice |
|---|---|
| Transport | WebRTC data channels, browser to browser |
| Signaling | One AWS Lambda with a function URL, plus one DynamoDB table. HTTP polling, no WebSocket |
| NAT traversal | Public STUN servers first. Cloudflare TURN later, only if direct connections fail too often |
| Shared state | Yjs document, synced over a reliable data channel, the same way as the whiteboard at work |
| Moving objects | The player who moves an object simulates it and streams its pose over an unreliable data channel. The rest pose goes into the Yjs document |
| Cost | $0. Lambda and DynamoDB "Always Free" limits have no end date. See [Cost and free tier](#cost-and-free-tier) |

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
| **AWS Lambda function URL + DynamoDB, HTTP polling** | One function, one table | $0 (Always Free) | Polling adds about 1 s to the connect time |
| AWS API Gateway WebSocket + Lambda + DynamoDB | One API, functions, a table | Free for 12 months (old accounts) or while credits last (new accounts), then a few cents a month | More parts. Must track open connections |
| Cloudflare Worker + Durable Object (WebSocket) | One Worker | $0 (Workers Free plan) | A second cloud vendor. Otherwise a good choice, see [Open questions](#open-questions) |

**Choice: Lambda function URL + DynamoDB.** It is the only option that is under our control and stays free with no end date. Signaling needs few messages, because we send the offer and the answer only after the browser has found all its addresses (non-trickle ICE). So polling is cheap and simple.

The client code uses a small `Signaling` interface, so we can change the option later without touching the rest. For development there is a second implementation over `BroadcastChannel`. It connects two tabs of the same browser with no server.

## Signaling service

### Parts

- **Lambda function**, Node.js, about 100 lines. It uses only the AWS SDK that the Lambda runtime already has. Memory 128 MB.
- **Function URL** with auth type `NONE`. CORS allows only the site origin and `http://localhost:5173`. A function URL has no cost of its own. We pay only for Lambda requests and compute.
- **DynamoDB table** `signal` in **provisioned** mode (the free tier does not cover on-demand mode). Read and write capacity at most 25 units each. Time to live (TTL) deletes rows after 1 hour. TTL deletes are free.
- **CloudWatch log group** with 7 days retention, so logs do not grow forever.
- **AWS Budgets** alert by email at $1.

A SAM template in `infra/signal/` creates all of this. One `sam deploy` command deploys it.

### Data

The table is a mailbox per room. Partition key `room`, sort key `id` (time + random, so it sorts by time).

| Field | Meaning |
|---|---|
| `room` | Room code, for example `K7Q2-M9XD` |
| `id` | Message id, sorts by time |
| `from`, `to` | Peer ids. `to` is `*` for a message to every peer in the room |
| `type` | `hello`, `offer`, `answer`, `bye` |
| `data` | The SDP text. At most 8 KB |
| `ttl` | Unix time 1 hour from now |

### Endpoints

| Request | Does |
|---|---|
| `POST /rooms/{room}/messages` | Stores one message. Rejects unknown types and big bodies |
| `GET /rooms/{room}/messages?to={peer}&after={id}` | Returns the messages for this peer (or for `*`) after `id` |
| `GET /ice` | Returns the ICE server list. Later also short-lived TURN credentials, see [STUN and TURN](#stun-and-turn) |

### Connect flow

1. The host presses **Host game**. The browser makes a random room code and a link: `https://<site>/#room=K7Q2-M9XD`. The code is in the URL hash, so Netlify never receives it. The host posts `hello` and polls every 2 s.
2. The host sends the link to the other player (chat, email).
3. The guest opens the link. The guest posts `hello`, reads the host's `hello`, creates the offer, waits until ICE gathering ends (at most 3 s), and posts the `offer`.
4. The host reads the offer, creates the answer the same way, and posts the `answer`.
5. The guest reads the answer. The data channels open. Both stop polling.

The guest makes the offer, not the host. The reason: an offer that waits for minutes until someone joins can stop working, because routers forget address mappings that are not used. With this order, the offer and the answer are created seconds apart.

Polling stops after 15 minutes with no guest. So a forgotten tab does not make requests forever.

## Cost and free tier

The question was: how long can we stay in the free tier with Lambda? Answer: **with no time limit**, if we follow the rules below. Lambda and DynamoDB are in the AWS "Always Free" group. Its limits are per month and have no end date, for old and new accounts.

### Use per game

Assumptions: 2 players, the host waits about 3 minutes for the guest, one reconnect.

| Item | Use per game | Always Free per month | Games per month at $0 |
|---|---|---|---|
| Lambda requests | about 100 (most are the host's polls while waiting) | 1,000,000 | about 10,000 |
| Lambda compute | about 0.4 GB-s (128 MB, about 30 ms per request) | 400,000 GB-s | about 1,000,000 |
| DynamoDB | about 100 reads and 6 writes, rows deleted after 1 h | 25 read units, 25 write units, 25 GB | The limit is per second, not per month: about 100 hosts can wait at the same time |
| CloudWatch Logs | about 30 KB | 5 GB | about 150,000 |
| Data out to the internet | about 20 KB | 100 GB | not a limit |

Requests above the limit cost $0.20 per million. So even 20,000 games in one month cost about $0.20.

### Rules to stay at $0

1. **Account plan.** A new AWS account (created on or after 2025-07-15) on the **Free plan** closes after 6 months or when its credits run out. Before that, upgrade it to the **Paid plan**. Always Free stays on the Paid plan. The Paid plan needs a payment card. An older account already has Always Free.
2. **No API Gateway.** Its free tier lasts 12 months for old accounts, and new accounts get only credits. The function URL has no charge of its own.
3. **DynamoDB in provisioned mode**, at most 25 read and 25 write units in total. On-demand mode is not in the free tier.
4. **Log retention** of 7 days.
5. **Budget alert** at $1, so we see a mistake or abuse early.

### If we used API Gateway WebSocket instead

The free tier is 1 million messages and 750,000 connection minutes per month, for 12 months, and only for accounts created before 2025-07-15. After that it costs $1.00 per million messages and $0.25 per million connection minutes. A 2-hour game with both sockets open for the whole game uses 240 connection minutes. So 1,000 games cost about $0.06 a month. That is cheap, but not $0, and it has more parts.

## STUN and TURN

- **STUN**: `stun:stun.l.google.com:19302` and `stun:stun.cloudflare.com:3478`. Both are free. Cloudflare says its STUN service is free and unlimited.
- **TURN, phase 1**: none. If the direct connection fails, the app says so: "Could not connect directly. One of the networks blocks peer-to-peer connections."
- **TURN, later**: Cloudflare Realtime TURN. The first 1,000 GB per month are free, then $0.05 per GB. Only data from Cloudflare to the browser counts. Data from the browser to Cloudflare is free. The browser must not hold the long-term TURN key. So `GET /ice` asks the Cloudflare API for credentials that expire after a few hours, and returns them. The Cloudflare token is in a Lambda environment variable.

Traffic of one game, rough estimate: Yjs changes are less than 1 MB. A moving object sends about 1 KB/s. If objects move for 20 minutes of a 2-hour game, the game sends about 5–10 MB. So 1,000 GB is enough for about 100,000 relayed games.

## Data channels

One `RTCPeerConnection` per pair of players, with two data channels:

| Channel | Settings | Carries |
|---|---|---|
| `sync` | reliable, ordered (the default) | Yjs sync messages and Yjs awareness messages (`y-protocols`) |
| `poses` | `ordered: false`, `maxRetransmits: 0` | Poses of moving objects, 30 times per second. A lost packet is not sent again, because the next one replaces it |

The data is encrypted (DTLS), also through TURN. Data channels need no camera or microphone permission.

Message size: before sending a big Yjs update (the first sync of a game), check `pc.sctp.maxMessageSize`. Split the message if it is bigger.

## State

The app state has three groups:

| Group | Where | Examples |
|---|---|---|
| Shared, lasting | Yjs document | map, mat turns, deploy line, crisis cards, tokens, characters on the table and their rest poses, tools on the table, dice and roll history |
| Shared, short-lived | Yjs awareness | player name, side (blue or red), which objects this player moves now, pointer position on the table, selection |
| Local | React state, as today | camera, hover, labels, debug mode, open card popup, open dice menu |

### Yjs document

```
Y.Doc
  game: Y.Map      mapId, matTurns, deployLine, crisis { secure, extract }
  characters: Y.Map<id, Y.Map>   key, figure, base, rotation, teamColor, slot, pose
  tokens: Y.Map<id, Y.Map>       the token fields from buildMatTokens, with x, z, yaw, up, control, damage
  tools: Y.Map<side, Y.Map<kind, Y.Map>>   per side: range and move tool, which one, pose, bend, snap target
  dice: Y.Map<trayKey, Y.Map>    dice (id -> pose, face, place), history (Y.Array), critsUsed
```

`pose` is `{ x, y, z, qx, qy, qz, qw }`: the rest pose of a body, written when the body falls asleep.

React reads the document through one hook, `useY(type)`, built on `useSyncExternalStore`. Handlers in `App.jsx` such as `handleTokenFlip` write to the document instead of calling `setTokens`. A game with no connection uses the same document, only without a provider. So single-player and multiplayer run the same code.

Each browser also stores the document in IndexedDB (`y-indexeddb`), per room. After a page reload, the table comes back at once, and Yjs syncs the changes that the other player made in the meantime.

## Moving objects (physics)

Both browsers run Rapier for every body. We cannot send only the inputs and let both browsers compute the same result: the Rapier build we use is not deterministic across machines, and both worlds would have to stay exactly equal from the start. Instead, one browser decides the motion of each moving object.

There are two kinds of bodies:

- **Player bodies**: the tools and the dice of one player (see [What each player controls](#what-each-player-controls)). Only that player's browser simulates them, always. The other browser always moves them as kinematic bodies, to the received poses (rule 4). So player bodies need no claims, and two players never fight over them.
- **Shared bodies**: models and tokens. Either player can move them. The rules below decide which browser simulates a moving shared body.

### Rules

1. A body at rest has no owner. Its pose is in the Yjs document.
2. When a player starts to drag a model or a token, that player's browser **claims** the body. The claim is in awareness: `owns: [ids]`.
3. The owner simulates the body as today. It sends the body's pose on the `poses` channel 30 times per second. A player body works the same way, but its player is always the owner.
4. The other browser switches the body to `kinematicPosition` and moves it to the received poses. It shows the poses about 100 ms late and interpolates between them, so the motion is smooth even when packets arrive unevenly.
5. When the owner's body falls asleep, the owner writes the rest pose to the document and then removes the claim. Both go over the `sync` channel, which keeps the order. The other browser sets the exact rest pose, switches the body back to dynamic and puts it to sleep. A player body stays kinematic in the other browser.
6. A shared body that is not owned can be pushed by a moving body, for example a die that hits a model. The browser that simulates the moving body claims the pushed body. It finds this with Rapier contact events.
7. If both players claim the same shared body at the same time, the player with the lower Yjs client id keeps it. Both browsers apply the same rule, so they agree without more messages.
8. When a player disconnects, its claims end. The other browser simulates the shared bodies from where they are. The player bodies of the disconnected player stop where they are until that player comes back.

TTS does it differently: the host simulates everything, and the other players see their own drags with a delay. With the rules above, each player sees their own drags with no delay.

### Pose message

One packet per physics step with every body this browser owns and that moved: object id, step number, position (3 numbers), rotation (4 numbers). Start with JSON. Change to a binary format only if we measure that it is too big.

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
- The signaling endpoint is public, so anyone can call it. Limits: the message size limit, the TTL, CORS for browsers, and the provisioned DynamoDB capacity (too many requests are throttled, they do not cost more). Lambda reserved concurrency can cap the request rate, if the account quota allows it. The budget alert shows abuse. To stop all traffic at once, set reserved concurrency to 0.
- The SDP contains the local IP addresses of the player. Browsers hide them behind mDNS names (`*.local`) by default. The signaling rows are deleted after 1 hour.

## Code layout

```
src/net/
  doc.js          the Y.Doc and its maps, read and write helpers. No React
  useY.js         React hook that reads a Y type
  signaling.js    Signaling interface: http (Lambda) and broadcast (two tabs) versions
  peer.js         RTCPeerConnection, data channels, ICE servers, reconnect
  syncChannel.js  Yjs sync and awareness over the sync channel (y-protocols)
  poses.js        sends poses of owned bodies, receives and interpolates
  ownership.js    claim and release rules
infra/signal/
  handler.mjs     the Lambda
  template.yaml   SAM template: function, function URL, table, log group
  README.md       deploy steps
```

New packages: `yjs`, `y-protocols`, `y-indexeddb`.

## Phases

Each phase ends with a working app. Do not open the app in a browser. Check with `npx vite build`. The user checks the result in the browser.

1. **Shared state in a local Yjs document.** Move map, mat turns, deploy line, crisis, tokens, the character list and the tools from `useState` into the document. Tools are stored per side. Write rest poses when bodies sleep. No network. The app works as before.
2. **Two tabs, one browser.** `BroadcastChannel` signaling, `peer.js`, Yjs sync and awareness. Name and side. Discrete changes sync: map, crisis cards, token flips and markers, new characters.
3. **Moving objects.** Player bodies and shared bodies, ownership, the pose channel, interpolation. Drag of models and tokens by both players. Each player uses only their own tools.
4. **Dice.** Dice and roll history move into the document. Dice are player bodies. Only the tray's player can use its dice panel.
5. **Signaling service.** Lambda, table, SAM template, AWS budget alert. Host and join UI, the room link, reconnect, IndexedDB.
6. **TURN.** Cloudflare TURN through `GET /ice`. The app shows the connection type (direct or relayed). Only if phase 5 shows that direct connections fail too often.

## Open questions

1. **Signaling vendor.** AWS Lambda (this plan) or a Cloudflare Worker with a Durable Object? The Worker gives a WebSocket, so no polling and faster reconnects. It is also free with no end date, and it could also make the TURN credentials. The cost is a second vendor.
2. **Cloudflare TURN account.** Check if the free 1,000 GB needs a payment card or a paid plan.
3. **AWS account.** Use an existing account or a new one? A new one must move to the Paid plan within 6 months.
4. **Spectators.** Needed later?

## Sources

- [AWS Free Tier plans](https://aws.amazon.com/free/): Free plan closes after 6 months; Always Free applies on both plans.
- [AWS Lambda pricing](https://aws.amazon.com/lambda/pricing/): 1M requests and 400,000 GB-s per month; $0.20 per 1M requests.
- [Lambda: function URLs vs API Gateway](https://docs.aws.amazon.com/lambda/latest/dg/furls-http-invoke-decision.html): "There are no additional charges for the URL endpoint itself."
- [DynamoDB pricing](https://aws.amazon.com/dynamodb/pricing/): 25 GB, 25 WCU, 25 RCU; provisioned capacity only.
- [API Gateway pricing](https://aws.amazon.com/api-gateway/pricing/): WebSocket free tier for 12 months; $1.00 per 1M messages, $0.25 per 1M connection minutes.
- [CloudWatch pricing](https://aws.amazon.com/cloudwatch/pricing/): 5 GB of logs per month.
- [AWS free data transfer out, 100 GB per month](https://aws.amazon.com/blogs/aws/aws-free-tier-data-transfer-expansion-100-gb-from-regions-and-1-tb-from-amazon-cloudfront-per-month/)
- [Cloudflare Realtime pricing](https://developers.cloudflare.com/realtime/sfu/platform/pricing/): first 1,000 GB per month free, shared by SFU and TURN.
- [Cloudflare TURN credentials](https://developers.cloudflare.com/realtime/turn/generate-credentials/): generated by a backend with an API token.
- [Cloudflare Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing): available on the Workers Free plan.
- [y-webrtc public signaling server status](https://discuss.yjs.dev/t/is-the-public-signaling-server-that-ships-by-default-with-y-webrtc-still-working/1979)
- [Trystero](https://github.com/dmotz/trystero)
