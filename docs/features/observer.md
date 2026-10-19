# Feature: Observer

Status: not started.

## Goal

A third person watches a multiplayer game live. The observer sees the same table as the players: the map, models, tokens, cards, tools, dice in the air and both cursors. The observer cannot change anything.

The observer is read-only: the observer's browser receives all game state and motion from the players and sends no state back.

## Terms

| Term | Meaning |
|---|---|
| Player | The host or the guest of a room (`docs/features/auth.md`, "Multiplayer rooms") |
| Observer | A logged-in user who watches a room and has no player seat |
| Observer connection | The WebRTC connection between the host and one observer |

## Who can watch

- Only a logged-in user can watch, the same as for a player seat. The signaling routes and the table snapshot already need a session and a seat (`docs/features/auth.md`, "Endpoints"). An observer gets a third kind of seat, so these checks stay as they are and only learn the new seat.
- The link is the secret, the same as for players. Anyone logged in with the link can watch.
- The join page of a room shows **Watch** next to **Join the fight!**. When both player seats are taken, it shows only **Watch**, instead of the message "This room has two players already".
- A player of the room never becomes an observer of it. A player who opens the link opens the room as a player.
- A room has a limit of observers. The number is in the API code (`apps/api`), because each observer adds upload for the host (see [Cost of an observer](#cost-of-an-observer)).
- The lobby lists the rooms that the user watches, with a **Watching** tag. **Stop watching** on the tile removes the user from the observers of that room.

## What the observer sees

Everything that the players share:

- The Yjs document: map, terrain, characters, poses at rest, tokens, cards, trays, dice results, the roll history and the game log.
- The awareness of both players: claims, selections, selected tools, range marks and pings, each in the color of its player.
- The live motion of both players: dragged pieces, dice in the air and both cursors.

The squad that a player chooses during the setup is not in the document until both players are Ready (`docs/features/setup-game.md`, "Squads"). So the observer sees it at the same time as the other player does.

## What the observer can do

Only actions that change nothing for the players:

- Move the camera.
- Open the card popups, the tray popups, the Log panel, the Settings and **Streamer** (`docs/features/spectator-view.md`).
- Open the roster of each player at any time, see [Rosters](#rosters).
- Use the Library to read cards and tokens, see [Library](#library).

Every control that writes the table is hidden: the setup actions, the dice tray actions, the tools, the tray buttons (damage, power, tokens), the deploy line, the mat turn, the ping. A drag of a piece does nothing. Keys that change the table do nothing.

## Camera

The observer sits at the side of the table, at right angles to the two players. The start view looks across the table from the host's left side. So the host's edge is on the right of the screen and the guest's edge is on the left. Space returns to this view, the same as for the players. The view is a constant in `src/camera.js`, next to the host and the guest view.

## Rosters

The toolbar of the observer has two roster buttons, one per player. Each one is a plate in the side color with the player's name. A click opens the Roster popup (`docs/features/roster.md`, "Roster popup") of that player, with the Characters, Tactic cards and Crisis cards tabs. The buttons are there at any time, also during the game. The popup has no Breakdown tab and no squad buttons, because the observer chooses no squad.

## Library

The observer can open the Library (`docs/features/library.md`) to read cards and tokens that are not on the table now. A click never adds anything to the table. Instead it opens an overlay:

| Click on | Shows |
|---|---|
| A character | The character card in the card popup, with **Flip!** for the Injured side |
| A Team Tactic card | The card face in the card popup, the same as an Infinity Gem today |
| A token | The token face at a large size, with its name and description |

The Library of the observer has no **For** choice and no **Single / Pile** switch, and a token cannot be dragged.

## How it works

The observer is the third browser in the room. The design of the two-player connection is in `docs/features/peer-to-peer.md`. This section names what is different for an observer.

### Connections

```
guest ──── pair connection ──── host ──── observer connection ──── observer
           sync, live                     sync, live, live-relay
```

- The observer connects only to the host. The guest does not connect to observers, so the guest's upload does not change.
- The guest ignores the `hello` and the offers of observers. The host answers each observer's offer with its own observer connection. The server writes the seat of the sender into each signaling message, so the browsers do not trust what the sender says about itself.
- When the host is not connected, the observer sees the table snapshot from the server and the status "Waiting for the host". The observer does not see the guest's motion without the host.

### Read-only

The rule is enforced in two places, so a changed or broken observer client cannot change the game:

1. **The host's browser** accepts only sync step 1 on an observer connection. Step 1 is the observer's state vector: "this is what I have". The host answers with the changes the observer is missing. The host ignores every document update, sync step 2 reply and awareness message that comes from the observer.
2. **The observer's browser** writes nothing:
   - The table stores of the observer are read-only. A write through a store does nothing.
   - Every claim fails, so a drag never starts.
   - It sends no awareness state and no live packets.
   - It does not write the table to the server, does not fill a start table and does not migrate an older schema.

The server refuses `PUT /rooms/{code}/table` from an observer.

### Document and awareness

The host runs the same Yjs sync on each connection. A change from the guest reaches the host with the guest's channel as origin. The observer connection sends every change whose origin is not the observer channel, so the host forwards the guest's changes to the observer with no extra code. Awareness works the same way.

Each player's awareness state has its side, so the observer can tell the two players apart. A player sees only one other player, so it does not need the side. The observer sees two.

### Live motion

The `live` channel carries only the motion of the browser that sends it. So the observer connection has a third negotiated channel, `live-relay`:

| Channel | Carries |
|---|---|
| `sync` | The document and awareness, read-only for the observer |
| `live` | The host's own motion |
| `live-relay` | The guest's motion, forwarded by the host |

- `live-relay` has the same settings as `live`: unordered and no resend. A lost packet must not hold back the packets after it.
- The host forwards each packet from the guest as raw bytes, in the message handler of the guest's `live` channel. The forward does not wait for the 33 ms send loop, and it works when the host's tab is hidden, because a hidden tab still gets message events.
- Each channel carries the packets of one sender. So the observer keeps the sequence numbers per channel, and the packet format does not change.

### Delay

The guest's motion and the guest's document changes reach the observer one hop later than the host's: about one more one-way trip, usually 10–50 ms on a direct connection. The follow smoothing (`docs/features/peer-to-peer.md`, "The follow") already lags by about this much. An observer only watches, so this delay does not matter.

Both kinds of guest data take the same path through the host. So the guest's final pose at rest still comes after the guest's live motion, as on the host.

### Cost of an observer

The host uploads one more copy of the document changes and of both live streams for each observer. With one or two observers this is small (`docs/features/peer-to-peer.md`, "Traffic per game"). With many observers, the host's upload is the limit. This is the reason for the observer limit per room.

## Not in the first version

- The players do not see who watches.
- A watch link that works without login.
- A relay through a server for many observers.
- Observer chat or pings.
