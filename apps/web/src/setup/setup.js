// Game setup: the steps from two loaded rosters to the start of round 1. Plain module with no imports, the
// same as rosters/mct.js, so a Node script can check it. The state is plain JSON, so a room saves it. See
// docs/features/setup-game.md.

export const TEAMS = ['blue', 'red']
export const CRISIS_TYPES = ['secure', 'extract']

export const otherTeam = (team) => (team === 'blue' ? 'red' : 'blue')
export const otherType = (type) => (type === 'secure' ? 'extract' : 'secure')

// The cards that a player chose for the squad: places in the `characters` and `tactics` lists of the
// parsed roster (rosters/mct.js, parseRoster), in roster order. A place and not a code, because a roster
// can list a code twice.
const NO_SQUAD = { characters: [], tactics: [] }

// id: random, made with each new setup (newSetup). A squad that a player keeps in their browser counts only
// for the setup with its id (rooms/store.js, squad). deck: the roll-off winner, who has Priority, and the
// crisis type of the deck they use: { team, type } | null. draws: the codes of the 2 cards drawn from each
// deck. picks: the code of the card of each type that the mission uses. threat: the Maximum Threat value.
// edge: the Priority player chose the deployment edge. squads: see NO_SQUAD. In a multiplayer room, a
// squad is in the document only after the reveal. ready: the player clicked Ready. When both players are
// Ready, each squad is revealed and goes on the table (revealPlan). placed: per team, the ids of the
// characters and Team Tactic cards that the squad put on the table, or null before. A restart removes them.
// A setup saved before the reveal has placed: { characters, tactics } for both teams (placedSides).
// affiliation: per team, the affiliation token key of the squad for the scoring board, or null before the
// squad is placed or while the player still chooses (scoreboard/affiliations.js). A setup saved before
// the affiliation step has no affiliation field.
export const NEW_SETUP = {
  id: null,
  deck: null,
  draws: { secure: [], extract: [] },
  picks: { secure: null, extract: null },
  threat: null,
  edge: false,
  squads: { blue: NO_SQUAD, red: NO_SQUAD },
  ready: { blue: false, red: false },
  placed: { blue: null, red: null },
  affiliation: { blue: null, red: null },
}

// A new setup. The id is random, so it is made here and not in NEW_SETUP.
export function newSetup() {
  return { ...NEW_SETUP, id: crypto.randomUUID() }
}

const NO_PLACED = { characters: [], tactics: [] }

// setup.placed as { blue, red }, each null | { characters, tactics }. The old shape { characters, tactics }
// belongs to Blue, and Red gets an empty list, but only when both players are Ready: then the old setup
// was done. Before that the old lists are empty.
export function placedSides(setup) {
  const { placed } = setup
  if (!Array.isArray(placed.characters))
    return { blue: placed.blue ?? null, red: placed.red ?? null }
  const done = setup.ready.blue && setup.ready.red
  return { blue: done ? placed : null, red: done ? NO_PLACED : null }
}

// 'deck': players roll off, and the winner chooses a deck. 'first': the other player uses 1 of the 2
// drawn cards. 'second': the winner uses 1 of the 2 cards drawn from the other deck of the other player.
// 'threat': the other player chooses the Maximum Threat. 'edge': the winner turns the mat and chooses the
// deployment edge. 'squads': each player chooses a squad and clicks Ready. 'reveal': both players are
// Ready, but a squad is not on the table yet, for example while the other player's page is closed.
// 'affiliation': both squads are on the table, but a side has no affiliation yet. 'done': both squads are
// on the table and have an affiliation (a setup with no affiliation field is done as soon as both are on
// the table).
export function setupStep(setup) {
  if (!setup.deck) return 'deck'
  const first = setup.deck.type
  if (!setup.picks[first]) return 'first'
  if (!setup.picks[otherType(first)]) return 'second'
  if (setup.threat === null) return 'threat'
  if (!setup.edge) return 'edge'
  if (!setup.ready.blue || !setup.ready.red) return 'squads'
  const placed = placedSides(setup)
  if (!placed.blue || !placed.red) return 'reveal'
  if (setup.affiliation && TEAMS.some((team) => !setup.affiliation[team])) return 'affiliation'
  return 'done'
}

// The sides that this browser reveals now. Both players are Ready, and the side is not placed yet. sides:
// the teams this browser plays. stored: null when the squads are in the document (single player room,
// Sandbox), else { blue, red } → the squad record of this browser { setupId, squad } | null. Returns
// { reveal: [{ side, squad }], missing: [side] }. missing: the browser has no squad of this setup for the
// side, for example after a restart in the other browser, or on another device.
export function revealPlan(setup, sides, stored) {
  const plan = { reveal: [], missing: [] }
  if (!setup.ready.blue || !setup.ready.red) return plan
  const placed = placedSides(setup)
  for (const side of sides) {
    if (placed[side]) continue
    if (!stored) {
      plan.reveal.push({ side, squad: setup.squads[side] })
      continue
    }
    const record = stored[side]
    if (record && record.setupId === (setup.id ?? null)) {
      plan.reveal.push({ side, squad: record.squad })
    } else plan.missing.push(side)
  }
  return plan
}

// 2 different cards of `codes` at random, in roster order. All cards when there are fewer. random()
// gives a number in [0, 1), the same as Math.random.
function drawTwo(codes, random) {
  const places = codes.map((_, i) => i)
  const count = Math.min(2, places.length)
  for (let i = 0; i < count; i++) {
    const j = i + Math.floor(random() * (places.length - i))
    ;[places[i], places[j]] = [places[j], places[i]]
  }
  return places
    .slice(0, count)
    .sort((a, b) => a - b)
    .map((i) => codes[i])
}

// The roll-off winner `team` uses their deck of `type`, with the card codes `codes`. 2 cards are drawn.
export function chooseDeck(setup, team, type, codes, random = Math.random) {
  return {
    ...setup,
    deck: { team, type },
    draws: { ...setup.draws, [type]: drawTwo(codes, random) },
  }
}

// A Use button: the card `code` of the drawn cards. After the first card, 2 cards are drawn from
// `otherCodes`, the deck of the other type of the other player.
export function pickCard(setup, code, otherCodes, random = Math.random) {
  const first = setup.deck.type
  const second = otherType(first)
  if (!setup.picks[first]) {
    return {
      ...setup,
      picks: { ...setup.picks, [first]: code },
      draws: { ...setup.draws, [second]: drawTwo(otherCodes, random) },
    }
  }
  return { ...setup, picks: { ...setup.picks, [second]: code } }
}

export function chooseThreat(setup, threat) {
  return { ...setup, threat }
}

export function chooseEdge(setup) {
  return { ...setup, edge: true }
}

// Adds the card at `place` of `list` ('characters' | 'tactics') to the squad of `team`, or removes it
export function toggleSquadCard(setup, team, list, place) {
  const squad = setup.squads[team]
  const places = squad[list].includes(place)
    ? squad[list].filter((p) => p !== place)
    : [...squad[list], place].sort((a, b) => a - b)
  return { ...setup, squads: { ...setup.squads, [team]: { ...squad, [list]: places } } }
}

// The Ready toggle of `team`
export function toggleReady(setup, team) {
  return { ...setup, ready: { ...setup.ready, [team]: !setup.ready[team] } }
}

// The squad of `side` is revealed and on the table: it goes into the setup, with `placed`, the ids of what
// it put on the table: { characters, tactics }. affiliation: the token key that the app set, or null.
export function placeSquad(setup, side, squad, placed, affiliation = null) {
  return {
    ...setup,
    squads: { ...setup.squads, [side]: squad },
    placed: { ...placedSides(setup), [side]: placed },
    affiliation: { ...(setup.affiliation ?? NEW_SETUP.affiliation), [side]: affiliation },
  }
}

// The player of `side` chose the affiliation of the squad
export function chooseAffiliation(setup, side, key) {
  return {
    ...setup,
    affiliation: { ...(setup.affiliation ?? NEW_SETUP.affiliation), [side]: key },
  }
}

// The ids of the characters and Team Tactic cards that the squads put on the table: { characters, tactics }
export function placedIds(setup) {
  const sides = Object.values(placedSides(setup)).filter(Boolean)
  return {
    characters: sides.flatMap((side) => side.characters),
    tactics: sides.flatMap((side) => side.tactics),
  }
}

// The setup put something on the table: the crisis cards of the mission, or a squad
export function setupPlacedCards(setup) {
  const { characters, tactics } = placedIds(setup)
  return setup.edge || characters.length > 0 || tactics.length > 0
}

// The crisis cards of each player on the table in the current step: [{ team, type, codes, use, drawn }].
// parsed: { blue, red } → the parsed roster or null. use: each card has a Use button. drawn: the cards were
// drawn from the deck, or the card was chosen from them. These cards lie in line with the scoring board
// (rosters/layout.js, crisisRowLayout).
export function crisisRows(setup, parsed) {
  const step = setupStep(setup)
  if (step === 'deck') {
    return TEAMS.flatMap((team) =>
      parsed[team]
        ? CRISIS_TYPES.map((type) => ({
            team,
            type,
            codes: parsed[team][type],
            use: false,
            drawn: false,
          }))
        : [],
    )
  }
  if (step === 'squads' || step === 'reveal' || step === 'affiliation' || step === 'done') return []
  const { team: winner, type: first } = setup.deck
  const other = otherTeam(winner)
  const second = otherType(first)
  const row = (team, type, codes, use, drawn) => ({ team, type, codes, use, drawn })
  const winnerRow = setup.picks[first]
    ? row(winner, first, [setup.picks[first]], false, true)
    : row(winner, first, setup.draws[first], true, true)
  let otherRow
  if (setup.picks[second]) otherRow = row(other, second, [setup.picks[second]], false, true)
  else if (setup.picks[first]) otherRow = row(other, second, setup.draws[second], true, true)
  else otherRow = row(other, second, parsed[other]?.[second] ?? [], false, false)
  return [winnerRow, otherRow]
}

// The Maximum Threat values that this game can still have, sorted, each once (docs/features/squad-breakdown.md,
// "Threat values"). parsed: as in crisisRows. threatOf(code): the threat of a crisis card. [] when no card is
// known, then the caller shows all values.
export function possibleThreats(setup, parsed, threatOf) {
  const values = (codes) => codes.map(threatOf).filter((v) => typeof v === 'number')
  let list
  if (setup.threat !== null) list = [setup.threat]
  else if (!setup.deck) {
    list = TEAMS.flatMap((team) =>
      parsed[team] ? values([...parsed[team].secure, ...parsed[team].extract]) : [],
    )
  } else {
    const { team: winner, type: first } = setup.deck
    const second = otherType(first)
    if (!setup.picks[first]) {
      list = values([...setup.draws[first], ...(parsed[otherTeam(winner)]?.[second] ?? [])])
    } else if (!setup.picks[second]) {
      list = values([setup.picks[first], ...setup.draws[second]])
    } else list = values([setup.picks[first], setup.picks[second]])
  }
  return [...new Set(list)].sort((a, b) => a - b)
}
