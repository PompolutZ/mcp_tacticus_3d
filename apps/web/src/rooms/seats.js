// TEMPORARY until the API step (docs/plans/setup-round-2.md, step 9): the API still names the seats of a room
// `blue` / `red`. The web app names the sides `host` (+z) / `guest` (-z). The room of the API is mapped to
// sides here, by the host id: the seat of the host is `host`, the other seat is `guest`. Step 9 deletes this
// file and the calls in serverStore.js. Plain, no React.

// The seat that a new room gives to its host (POST /rooms still takes a side)
export const API_HOST_SEAT = 'blue'

const OTHER_SEAT = { blue: 'red', red: 'blue' }

// The API seat of the host of `room`. A room with no player at a seat has the host at the other one.
export function hostSeat(room) {
  if (room.players.blue?.id === room.host) return 'blue'
  if (room.players.red?.id === room.host) return 'red'
  return room.players.blue ? 'red' : 'blue'
}

// The API room with `players` and `rosters` keyed by side
export function withSides(room) {
  const seat = hostSeat(room)
  const other = OTHER_SEAT[seat]
  return {
    ...room,
    players: { host: room.players[seat], guest: room.players[other] },
    rosters: { host: room.rosters[seat], guest: room.rosters[other] },
  }
}
