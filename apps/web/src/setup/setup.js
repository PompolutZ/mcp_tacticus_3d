// Game setup: the steps from two loaded rosters to the start of round 1. Plain module with no imports, the
// same as rosters/mct.js, so a Node script can check it. The state is plain JSON, so a room saves it. See
// docs/feature-setup-game.md.

export const TEAMS = ['blue', 'red']
export const CRISIS_TYPES = ['secure', 'extract']

export const otherTeam = (team) => (team === 'blue' ? 'red' : 'blue')
export const otherType = (type) => (type === 'secure' ? 'extract' : 'secure')

// The cards that a player chose for the squad: places in the `characters` and `tactics` lists of the
// parsed roster (rosters/mct.js, parseRoster), in roster order. A place and not a code, because a roster
// can list a code twice.
const NO_SQUAD = { characters: [], tactics: [] }

// deck: the roll-off winner, who has Priority, and the crisis type of the deck they use: { team, type } |
// null. draws: the codes of the 2 cards drawn from each deck. picks: the code of the card of each type that
// the mission uses. threat: the Maximum Threat value. edge: the Priority player chose the deployment edge.
// squads: see NO_SQUAD. ready: the player clicked Ready. When both players are Ready, both squads go on the
// table at the same time. placed: the ids of the characters and Team Tactic cards that the squads put on
// the table, of both players. A restart removes them.
export const NEW_SETUP = {
  deck: null,
  draws: { secure: [], extract: [] },
  picks: { secure: null, extract: null },
  threat: null,
  edge: false,
  squads: { blue: NO_SQUAD, red: NO_SQUAD },
  ready: { blue: false, red: false },
  placed: { characters: [], tactics: [] },
}

// 'deck': players roll off, and the winner chooses a deck. 'first': the other player uses 1 of the 2
// drawn cards. 'second': the winner uses 1 of the 2 cards drawn from the other deck of the other player.
// 'threat': the other player chooses the Maximum Threat. 'edge': the winner turns the mat and chooses the
// deployment edge. 'squads': each player chooses a squad and clicks Ready. 'done': both squads are on the
// table.
export function setupStep(setup) {
  if (!setup.deck) return 'deck'
  const first = setup.deck.type
  if (!setup.picks[first]) return 'first'
  if (!setup.picks[otherType(first)]) return 'second'
  if (setup.threat === null) return 'threat'
  if (!setup.edge) return 'edge'
  if (!setup.ready.blue || !setup.ready.red) return 'squads'
  return 'done'
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

// The Ready toggle of `team`, while the other player is not Ready
export function toggleReady(setup, team) {
  return { ...setup, ready: { ...setup.ready, [team]: !setup.ready[team] } }
}

// The second player clicks Ready: both squads go on the table. placed: { characters, tactics }, the ids of
// what the squads put on the table.
export function activateSquads(setup, placed) {
  return {
    ...setup,
    ready: { blue: true, red: true },
    placed: {
      characters: [...setup.placed.characters, ...placed.characters],
      tactics: [...setup.placed.tactics, ...placed.tactics],
    },
  }
}

// A saved setup, with the start value of each field that it does not have. A setup saved before the Ready
// toggles has `active` (the player activated their squad) in place of `ready`.
export function restoreSetup(saved) {
  const { active, ...rest } = saved ?? {}
  return { ...NEW_SETUP, ...(active && { ready: active }), ...rest }
}

// The setup put something on the table: the crisis cards of the mission, or a squad
export function setupPlacedCards(setup) {
  return setup.edge || setup.placed.characters.length > 0 || setup.placed.tactics.length > 0
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
  if (step === 'squads' || step === 'done') return []
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
