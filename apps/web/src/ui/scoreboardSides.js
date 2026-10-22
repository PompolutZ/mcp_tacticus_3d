import { TEAMS, otherTeam } from '../setup/setup.js'
import { playerName } from '../setup/names.js'
import { STATUS } from '../rooms/connectionStatus.js'

// The two sides of the scoreboard (Scoreboard.jsx, docs/features/table-tools.md, "Scoreboard"), left then right.
// The left side is the same as the left Streamer column: the own side in a multiplayer room, else the host.
// ctx: the name context of the table (setup/names.js, nameCtx). colors: { host, guest } → 'blue' | 'red'.
// state: the connection state of the room (net/peer.js), or undefined without a connection.
// → [{ team, color, name, tag }]. tag is { kind, text } or null: "You" for the own side, the connection state for
// the other player once one is there, nothing in the Sandbox and a single player room.
export function scoreboardSides(ctx, colors, state) {
  const left = ctx.mySide ?? TEAMS[0]
  return [left, otherTeam(left)].map((team) => {
    const own = Boolean(ctx.mySide) && team === ctx.mySide
    const player = own ? ctx.players?.[team] : (ctx.players?.[team] ?? ctx.peer)
    let name = playerName(team, ctx)
    // The own side shows the account name, "You" is its tag
    if (own) name = player?.name || name
    let tag = null
    if (own) tag = { kind: 'you', text: 'You' }
    else if (ctx.mySide && player && !player.gone && state) {
      tag = { kind: state, text: STATUS[state] }
    }
    return { team, color: colors[team], name, tag }
  })
}
