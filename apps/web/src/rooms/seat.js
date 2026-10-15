// The seat of this browser at a table. No React.
// room: the room record (rooms/store.js), or null for the Sandbox.
//
// - multiplayer: a multiplayer room.
// - isGuest: the Red seat of a multiplayer room. A single player room and the Sandbox are the host.
// - ownSide: the side of this browser. It writes the tools of that side only (net/doc.js, `tools`). The Sandbox and
//   a single player room are the host, because one player plays both sides there.
// - playedSides: the sides this browser plays: its own in a multiplayer room, both in the Sandbox and a single
//   player room.
// - hiddenSquads: in a multiplayer room, the squad that the player chooses is not in the document until both
//   players are Ready. It is in this browser (rooms/store.js, squad). A single player room and the Sandbox keep
//   the squads in the document. See docs/features/setup-game.md, "Squads". Never derive it from mySide: a
//   multiplayer room with `side: null` has hiddenSquads true and mySide null.
// - mySide: the side in a multiplayer room (can be null), null in the Sandbox and a single player room.
import { TEAMS } from '../setup/setup.js'

// Fixed arrays, so playedSides keeps its identity between renders (it is an effect dependency)
const OWN_ONLY = { host: ['host'], guest: ['guest'] }

export function tableSeat(room) {
  const multiplayer = Boolean(room?.multiplayer)
  const isGuest = Boolean(room?.multiplayer && room.side === 'guest')
  const ownSide = isGuest ? 'guest' : 'host'
  const playedSides = room?.multiplayer ? OWN_ONLY[ownSide] : TEAMS
  const hiddenSquads = Boolean(room?.multiplayer)
  const mySide = hiddenSquads ? room.side : null
  return { multiplayer, isGuest, ownSide, playedSides, hiddenSquads, mySide }
}
