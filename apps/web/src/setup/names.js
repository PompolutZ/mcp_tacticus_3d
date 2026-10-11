// The names of the players in the setup texts (docs/features/setup-game.md, "Names"). No imports, so a Node
// test can run it. A team is a side key, a seat at the table (not a color).
//
// ctx: { mySide, players, peer, colors }
// - mySide: the seat of this user in a multiplayer room, or null in the Sandbox and a single player room.
// - players: { blue, red } of the room, each a user ({ name }), { gone: true } or null. Multiplayer only.
// - peer: the player from the hello of the other browser ({ name }), for a seat that is not filled yet.
// - colors: { blue: 'Blue' | 'Red', red: ... }, the color name of each side (sideColors.js). It follows Priority
//   in a single player room, so the Sandbox and the single player room name a player by color.

export const FALLBACK_NAME = 'Opponent'
export const GONE_NAME = 'Deleted player'

// True when `team` is the user of this browser in a multiplayer room
export const isYou = (team, ctx) => Boolean(ctx.mySide) && ctx.mySide === team

// "You" for the own side in a multiplayer room, the Discord name of the other player, or the color name
// ("Blue" / "Red") in the Sandbox and a single player room.
export function playerName(team, ctx) {
  if (!ctx.mySide) return ctx.colors[team]
  if (isYou(team, ctx)) return 'You'
  const player = ctx.players?.[team] ?? ctx.peer
  if (player?.gone) return GONE_NAME
  return player?.name || FALLBACK_NAME
}

// "my" for the own side in a multiplayer room, else "Nelly's" / "Blue's"
export function possessive(team, ctx) {
  return isYou(team, ctx) ? 'my' : `${playerName(team, ctx)}'s`
}

// The verb for the name: "choose" → "You choose" / "Nelly chooses". The own side takes the base form.
export function verbFor(team, ctx, base) {
  if (isYou(team, ctx)) return base
  if (base === 'have') return 'has'
  if (/(s|sh|ch|x|z)$/.test(base)) return `${base}es`
  if (/[^aeiou]y$/.test(base)) return `${base.slice(0, -1)}ies`
  return `${base}s`
}

// The name and "chose": chose('red', ctx) → "Nelly chose" or "You chose"
export const chose = (team, ctx) => `${playerName(team, ctx)} chose`

// The name and the verb: says('red', ctx, 'choose') → "Nelly chooses" or "You choose"
export function says(team, ctx, base) {
  return `${playerName(team, ctx)} ${verbFor(team, ctx, base)}`
}

// The first letter in upper case, for a possessive at the start of a sentence ("my" → "My")
export const capital = (text) => text.charAt(0).toUpperCase() + text.slice(1)
