// Objective tokens that wait for their place (docs/features/character-trays.md, "Hold and drop"). A dropped token
// has `placeBy` (the side that places it) and `placeFrom` { characterId, x, z, radius, offBoard } while it waits.
// Plain module, no React.
import { RANGE_TIP } from '../tabletools/toolTips.js'
import { playerName } from '../setup/names.js'

// A crisis token is a 1" circle (CrisisToken.jsx, RADIUS). Drop places it just clear of the base.
const TOKEN_RADIUS = 0.5
const DROP_GAP = 0.1
// Several tokens dropped at once (handleDropCharacterTokens) are spread along a row next to the
// base, one TOKEN_RADIUS*2 (diameter) apart plus a gap, so they do not overlap.
const TOKEN_ROW_SPACING = TOKEN_RADIUS * 2 + DROP_GAP * 2

// The side that places a token that a character of `team` drops. placer: 'opponent' or 'controller'
// (characters/dropPlacer.js).
export function placerSide(team, placer) {
  return placer === 'controller' ? team : team === 'host' ? 'guest' : 'host'
}

// The tokens that wait for their place
export const waitingTokens = (tokens) => tokens.filter((t) => t.placeBy)

// The waiting tokens of one character, grouped for the notice: [{ characterId, placeBy, tokens }], in the order
// of the first token of each character.
export function waitGroups(tokens) {
  const groups = []
  for (const token of waitingTokens(tokens)) {
    const characterId = token.placeFrom?.characterId ?? null
    let group = groups.find((g) => g.characterId === characterId)
    if (!group) {
      group = { characterId, placeBy: token.placeBy, tokens: [] }
      groups.push(group)
    }
    group.tokens.push(token)
  }
  return groups
}

// "Asset", "Asset and Civilian", "Asset, Civilian and Asset"
export function joinNames(names) {
  if (names.length < 2) return names.join('')
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

// One line of the notice, and the title of the disabled Remove. mine: this browser plays the side that places.
// name: the character. tokenNames: the names of its waiting tokens. placer: the name of the placing player.
export function waitText({ mine, name, tokenNames, placer }) {
  const what = `${name}'s ${joinNames(tokenNames)}`
  return mine ? `Place ${what} within Range 2` : `Waiting for ${placer} to place ${what}`
}

// The characters whose models go back on their cards when the tokens `placedIds` are placed: the character had
// **Remove** (`placeFrom.offBoard`) and no other token of it waits. tokens: the table before the placing.
export function modelsToReturn(tokens, placedIds) {
  const placed = tokens.filter((t) => placedIds.includes(t.id) && t.placeBy)
  const ids = [
    ...new Set(placed.filter((t) => t.placeFrom?.offBoard).map((t) => t.placeFrom.characterId)),
  ]
  return ids.filter(
    (id) =>
      !tokens.some(
        (t) => t.placeBy && !placedIds.includes(t.id) && t.placeFrom?.characterId === id,
      ),
  )
}

// The token after it is placed at (x, z), or where it lies when point is null. Clears the wait.
export function placedToken(token, point) {
  return { ...token, ...point, heldBy: null, heldAt: null, placeBy: null, placeFrom: null }
}

// Reach of the Range 2 tool from the base edge, in inches. The tool snaps with its end on the base edge
// (snapPose in toolGeometry.js), so its far end is a whole tool length (2 × RANGE_TIP[2]) from the edge.
export const RANGE_2 = 2 * RANGE_TIP[2]

// The point nearest to `point` that is at most `maxDistance` from `centre`. Both are { x, z }.
export function clampToRange(point, centre, maxDistance) {
  const dx = point.x - centre.x
  const dz = point.z - centre.z
  const distance = Math.hypot(dx, dz)
  if (distance <= maxDistance) return point
  const k = maxDistance / distance
  return { ...point, x: centre.x + dx * k, z: centre.z + dz * k }
}

// The drag limit of a waiting token (decision: some part of the token stays within Range 2 of the base edge):
// the point where it may be, or the point itself when the token has no place to measure from.
export function clampWaiting(token, point, tokenRadius) {
  const from = token.placeFrom
  if (!token.placeBy || !from) return point
  return clampToRange(point, from, from.radius + RANGE_2 + tokenRadius)
}

// The offset along the row of token i of n dropped together (handleDropCharacterTokens): the row is centred on the base.
export const dropRowOffset = (i, n) => (i - (n - 1) / 2) * TOKEN_ROW_SPACING

// The token after its holder drops it, next to the base of the holder (the live position `pos` { x, z } or null, then
// where the token last sat). rowOffset moves it along the base's edge. wait: { placeBy, offBoard } or null; the token
// then waits for its place and placeFrom keeps the base it dropped from.
export function droppedToken(token, { pos, baseRadius, rowOffset, wait }) {
  const x = (pos?.x ?? token.x) + baseRadius + TOKEN_RADIUS + DROP_GAP
  const z = (pos?.z ?? token.z) + rowOffset
  const dropped = { ...token, heldBy: null, heldAt: null, x, z }
  if (wait) {
    dropped.placeBy = wait.placeBy
    dropped.placeFrom = {
      characterId: token.heldBy,
      x: pos?.x ?? token.x,
      z: pos?.z ?? token.z,
      radius: baseRadius,
      offBoard: wait.offBoard,
    }
  }
  return dropped
}

// The lines of the notice, one for each character that has waiting tokens. nameOf(characterKey) and
// tokenNameOf(frontKey) give the names. playedSides: the sides this browser plays. nameCtx: see setup/names.js.
export function waitLinesOf(tokens, characters, { playedSides, nameCtx, nameOf, tokenNameOf }) {
  return waitGroups(tokens).map((group) => {
    const ch = characters.find((c) => c.id === group.characterId)
    const mine = playedSides.includes(group.placeBy)
    const tokenNames = group.tokens.map((t) => tokenNameOf(t.frontKey))
    const name = ch ? nameOf(ch.key) : 'A character'
    const placer = playerName(group.placeBy, nameCtx)
    return {
      id: group.characterId ?? group.tokens[0].id,
      characterId: group.characterId,
      tokenId: group.tokens[0].id,
      ids: group.tokens.map((t) => t.id),
      mine,
      text: waitText({ mine, name, tokenNames, placer }),
    }
  })
}
