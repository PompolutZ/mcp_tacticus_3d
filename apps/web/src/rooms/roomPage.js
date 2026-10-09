// Which page a room link opens (docs/plans/implement-backend/07-multiplayer-rooms.md, decision 17). Pure:
// Root.jsx makes the calls and passes the results in.

// The side where this user has a seat, or null
export function seatOf(room, userId) {
  if (!userId) return null
  if (room.players.blue?.id === userId) return 'blue'
  if (room.players.red?.id === userId) return 'red'
  return null
}

// The room prop of App and Table for a multiplayer room (decision 22). room: the API room.
export function multiplayerRoom(room, userId) {
  return {
    id: room.code,
    multiplayer: true,
    side: seatOf(room, userId),
    host: room.host,
    mapId: room.mapId,
    rosters: room.rosters,
    players: room.players,
  }
}

// code: the code in the link. singleRoom: the single player room of this browser with that code, or null.
// authOn: login is on. session: { status, user }. room: the answer of GET /rooms/{code}: undefined (not asked
// yet), { notFound: true }, { failed: true } (no answer), or the room.
// Returns one of:
//   { page: 'single' }               the single player room
//   { page: 'wait' }                 the session is loading
//   { page: 'fetch' }                the caller asks GET /rooms/{code}
//   { page: 'multiplayer' }          the user has a seat
//   { page: 'join', loggedIn }       a free seat
//   { page: 'lobby', notice }        the lobby with a message
export function roomPage({ code, singleRoom, authOn, session, room }) {
  if (singleRoom) return { page: 'single' }
  if (!authOn) return { page: 'lobby', notice: `Room ${code} is not in this browser.` }
  if (session.status === 'loading') return { page: 'wait' }
  if (room === undefined) return { page: 'fetch' }
  if (room.notFound) return { page: 'lobby', notice: `Room ${code} not found.` }
  if (room.failed)
    return {
      page: 'lobby',
      notice: `Could not load room ${code}: the server does not answer.`,
    }
  const loggedIn = session.status === 'in'
  if (loggedIn && seatOf(room, session.user.id)) return { page: 'multiplayer' }
  if (!room.players.blue || !room.players.red) return { page: 'join', loggedIn }
  return { page: 'lobby', notice: 'This room has two players already.' }
}
