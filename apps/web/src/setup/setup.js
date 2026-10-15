// Game setup: the steps from two loaded rosters to the start of round 1. Plain module with no imports, the
// same as rosters/mct.js, so a Node script can check it. The state is plain JSON, so a room saves it. See
// docs/features/setup-game.md.

export const TEAMS = ['host', 'guest']
export const CRISIS_TYPES = ['secure', 'extract']

export const otherTeam = (team) => (team === 'host' ? 'guest' : 'host')
// The side of the table of a team: host sits at +z, guest at -z. sideSign is the z (and mirrored x) factor,
// sideYaw turns a piece so its top points away from its owner (host 0, guest 180 deg).
export const sideSign = (team) => (team === 'host' ? 1 : -1)
export const sideYaw = (team) => (team === 'host' ? 0 : Math.PI)
export const otherType = (type) => (type === 'secure' ? 'extract' : 'secure')

// Why a squad cannot be Ready: 'over' (its threat is above the Maximum Threat), 'empty' (no character), or
// null. Over comes first. A squad with less threat is fine.
export function squadProblem({ threat, count, maxThreat }) {
  if (threat > maxThreat) return 'over'
  return count === 0 ? 'empty' : null
}

// The cards that a player chose for the squad: places in the `characters` and `tactics` lists of the
// parsed roster (rosters/mct.js, parseRoster), in roster order. A place and not a code, because a roster
// can list a code twice.
const NO_SQUAD = { characters: [], tactics: [] }

// id: random, made with each new setup (newSetup). A squad that a player keeps in their browser counts only
// for the setup with its id (rooms/store.js, squad). priority: the side that won the roll off and has
// Priority, null before. The colors follow it (colorOf). rollOff: the roll off the app read, { winner, counts }
// | null (setRollOff). deck: the crisis type of the deck that the player
// with Priority uses: { type } | null. A setup saved before `priority` has deck: { team, type } and no
// priority: priorityOf reads deck.team as the Priority side. draws: the codes of the 2 cards drawn from each
// deck. picks: the code of the card of each type that the mission uses. threat: the Maximum Threat value.
// edge: the Priority player chose the deployment edge. squads: see NO_SQUAD. In a multiplayer room, a
// squad is in the document only after the reveal. ready: the player clicked Ready. When both players are
// Ready, each squad is revealed and goes on the table (revealPlan). placed: per team, the ids of the
// characters and Team Tactic cards that the squad put on the table, or null before. A restart removes them.
// A setup saved before the reveal has placed: { characters, tactics } for both teams (placedSides).
// affiliation: per team, the affiliation token key of the squad for the scoring board, or null before the
// squad is placed or while the player still chooses (scoreboard/affiliations.js). A setup saved before
// the affiliation step has no affiliation field. deployed: the players deployed their models. The first
// Power Phase after the reveal sets it (finishDeploy). A setup saved before the deploy step has no field,
// and counts as deployed. lockSet: the setup turned Deploy Lock on once, when both squads were placed
// (deployLockDue), so a later hand toggle stays. A setup saved before it has no field. view: the step that a player browses with Prev / Next, or null for the current
// step. It is shared, so both players see it (viewOf, browse). A setup saved before it has no field.
export const NEW_SETUP = {
  id: null,
  priority: null,
  rollOff: null,
  deck: null,
  draws: { secure: [], extract: [] },
  picks: { secure: null, extract: null },
  threat: null,
  edge: false,
  squads: { host: NO_SQUAD, guest: NO_SQUAD },
  ready: { host: false, guest: false },
  placed: { host: null, guest: null },
  affiliation: { host: null, guest: null },
  deployed: false,
  lockSet: false,
  view: null,
}

// A new setup. The id is random, so it is made here and not in NEW_SETUP.
export function newSetup() {
  return { ...NEW_SETUP, id: crypto.randomUUID() }
}

const NO_PLACED = { characters: [], tactics: [] }

// The side with Priority (the roll-off winner), or null before the roll off. A setup saved before `priority`
// has none, and then the side of deck.team has it: the roll-off winner was stored there.
export function priorityOf(setup) {
  return setup?.priority ?? setup?.deck?.team ?? null
}

// The color of a side, 'blue' | 'red'. Side keys are seats, not colors (docs/features/setup-game.md,
// "Colors"). setup: the setup state, or null. followPriority: true in a single player room and a
// multiplayer room, false in the Sandbox. With followPriority the side with Priority is Blue and the other
// is Red. Before the roll off, and always in the Sandbox, the +z side (the key 'host') is Blue.
export function colorOf(team, setup, followPriority) {
  const priority = followPriority ? priorityOf(setup) : null
  if (!priority) return team === 'host' ? 'blue' : 'red'
  return team === priority ? 'blue' : 'red'
}

// The colors of both sides in a room, { host, guest }, for the room record (rooms/store.js)
export function sideColorsOf(setup) {
  return { host: colorOf('host', setup, true), guest: colorOf('guest', setup, true) }
}

// setup.placed as { host, guest }, each null | { characters, tactics }. The old shape { characters, tactics }
// belongs to Blue, and Red gets an empty list, but only when both players are Ready: then the old setup
// was done. Before that the old lists are empty.
export function placedSides(setup) {
  const { placed } = setup
  if (!Array.isArray(placed.characters))
    return { host: placed.host ?? null, guest: placed.guest ?? null }
  const done = setup.ready.host && setup.ready.guest
  return { host: done ? placed : null, guest: done ? NO_PLACED : null }
}

// 'rollOff': players roll off, and nobody has Priority yet. 'deck': the player with Priority chooses a deck. 'first': the other player uses 1 of the 2
// drawn cards. 'second': the winner uses 1 of the 2 cards drawn from the other deck of the other player.
// 'threat': the other player chooses the Maximum Threat. 'edge': the winner turns the mat and chooses the
// deployment edge. 'squads': each player chooses a squad and clicks Ready. 'reveal': both players are
// Ready, but a squad is not on the table yet, for example while the other player's page is closed.
// 'affiliation': both squads are on the table, but a side has no affiliation yet. 'done': both squads are
// on the table and have an affiliation (a setup with no affiliation field is done as soon as both are on
// the table). 'deploy': both squads are on the table with an affiliation, and the players deploy until the
// first Power Phase (`deployed` is false). A setup with no `deployed` field has no deploy step.
export function setupStep(setup) {
  if (!priorityOf(setup)) return 'rollOff'
  if (!setup.deck) return 'deck'
  const first = setup.deck.type
  if (!setup.picks[first]) return 'first'
  if (!setup.picks[otherType(first)]) return 'second'
  if (setup.threat === null) return 'threat'
  if (!setup.edge) return 'edge'
  if (!setup.ready.host || !setup.ready.guest) return 'squads'
  const placed = placedSides(setup)
  if (!placed.host || !placed.guest) return 'reveal'
  if (setup.affiliation && TEAMS.some((team) => !setup.affiliation[team])) return 'affiliation'
  if (setup.deployed === false) return 'deploy'
  return 'done'
}

// The side that chooses in the current step, or null when no single player does (docs/features/setup-game.md,
// "What the app does"). Deck, second card and edge: the player with Priority. First card and Maximum
// Threat: the other player. In a multiplayer room, only this side can click the buttons of the step. The roll
// off, the squads and the later steps have no chooser: both players act.
export function chooserOf(setup) {
  const winner = priorityOf(setup)
  switch (setupStep(setup)) {
    case 'deck':
    case 'second':
    case 'edge':
      return winner
    case 'first':
    case 'threat':
      return otherTeam(winner)
    default:
      return null
  }
}

// The sides that this browser reveals now. Both players are Ready, and the side is not placed yet. sides:
// the teams this browser plays. stored: null when the squads are in the document (single player room,
// Sandbox), else { host, guest } → the squad record of this browser { setupId, squad } | null. Returns
// { reveal: [{ side, squad }], missing: [side] }. missing: the browser has no squad of this setup for the
// side, for example after a restart in the other browser, or on another device.
export function revealPlan(setup, sides, stored) {
  const plan = { reveal: [], missing: [] }
  if (!setup.ready.host || !setup.ready.guest) return plan
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

// The roll off is over: `team` has Priority
export function setPriority(setup, team) {
  return { ...setup, priority: team, rollOff: null }
}

// The app read the roll off (rollOff.js, readRollOff): result = { winner, counts }. A winner gets Priority. On
// a tie (winner null) Priority stays null and the panel says so. The result stays in `setup.rollOff` for the
// panel, until a manual Priority or a restart.
export function setRollOff(setup, result) {
  return { ...setup, priority: result.winner ?? setup.priority, rollOff: result }
}

// The player with Priority uses their deck of `type`, with the card codes `codes`. 2 cards are drawn.
export function chooseDeck(setup, type, codes, random = Math.random) {
  return {
    ...setup,
    priority: priorityOf(setup),
    deck: { type },
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

// The squad of `team` gets these character places (sorted). Its Team Tactic places stay.
// See docs/features/squad-breakdown.md, "Choose a squad".
export function setSquadCharacters(setup, team, places) {
  const squad = setup.squads[team]
  const characters = [...places].sort((a, b) => a - b)
  return { ...setup, squads: { ...setup.squads, [team]: { ...squad, characters } } }
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

// Both squads are placed, the deploy step is still ahead and the setup did not turn Deploy Lock on yet.
// The app then turns it on and calls lockWasSet, once. A setup with no `deployed` field has no deploy step.
export function deployLockDue(setup) {
  const placed = placedSides(setup)
  return Boolean(placed.host && placed.guest) && setup.deployed === false && !setup.lockSet
}

// The setup turned Deploy Lock on
export function lockWasSet(setup) {
  return { ...setup, lockSet: true }
}

// The player of `side` chose the affiliation of the squad
export function chooseAffiliation(setup, side, key) {
  return {
    ...setup,
    affiliation: { ...(setup.affiliation ?? NEW_SETUP.affiliation), [side]: key },
  }
}

// True while the squad of `side` is on the table but its player has not chosen the affiliation yet (the step
// `affiliation` is open for that side). Power waits for it. A setup with no `affiliation` field never waits.
export function needsAffiliation(setup, side) {
  return Boolean(setup.affiliation) && Boolean(placedSides(setup)[side]) && !setup.affiliation[side]
}

// The first Power Phase ends the deployment: the setup is done
export function finishDeploy(setup) {
  return { ...setup, deployed: true }
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
// parsed: { host, guest } → the parsed roster or null. use: each card has a Use button. drawn: the cards were
// drawn from the deck, or the card was chosen from them. These cards lie in line with the scoring board
// (rosters/layout.js, crisisRowLayout).
export function crisisRows(setup, parsed) {
  const step = setupStep(setup)
  const chooser = chooserOf(setup)
  if (step === 'rollOff' || step === 'deck') {
    return TEAMS.flatMap((team) =>
      parsed[team]
        ? CRISIS_TYPES.map((type) => ({
            team,
            type,
            codes: parsed[team][type],
            use: false,
            drawn: false,
            facing: team === chooser ? chooser : null,
          }))
        : [],
    )
  }
  if (
    step === 'squads' ||
    step === 'reveal' ||
    step === 'affiliation' ||
    step === 'deploy' ||
    step === 'done'
  )
    return []
  const winner = priorityOf(setup)
  const first = setup.deck.type
  const other = otherTeam(winner)
  const second = otherType(first)
  const row = (team, type, codes, use, drawn) => ({
    team,
    type,
    codes,
    use,
    drawn,
    facing: use ? chooser : null,
  })
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
    const winner = priorityOf(setup)
    const first = setup.deck.type
    const second = otherType(first)
    if (!setup.picks[first]) {
      list = values([...setup.draws[first], ...(parsed[otherTeam(winner)]?.[second] ?? [])])
    } else if (!setup.picks[second]) {
      list = values([setup.picks[first], ...setup.draws[second]])
    } else list = values([setup.picks[first], setup.picks[second]])
  }
  return [...new Set(list)].sort((a, b) => a - b)
}

// The steps in the order of the rulebook. `reveal` is the wait after the squads, it has no choice of its own.
const FLOW = [
  'rollOff',
  'deck',
  'first',
  'second',
  'threat',
  'edge',
  'squads',
  'reveal',
  'affiliation',
  'deploy',
  'done',
]

// The steps that are done, in order, for Prev / Next and Override: the steps before the current one, and
// only the ones with a choice in the state. `affiliation` needs the field (a setup saved before it has none)
// and `deploy` needs `deployed === true`. The app sets a single affiliation with no click, and the state
// cannot tell that from a choice, so `affiliation` is listed in both cases.
export function doneSteps(setup) {
  const now = FLOW.indexOf(setupStep(setup))
  return FLOW.filter((step, i) => {
    if (i >= now || step === 'reveal') return false
    if (step === 'affiliation') return Boolean(setup.affiliation)
    if (step === 'deploy') return setup.deployed === true
    return true
  })
}

// True while the roster rows lie on the table: the steps before the squads go on the table (affiliation). The
// tool rack of a side with a loaded roster is hidden then (tabletools/ToolRack.jsx).
export function rosterRowsShown(setup) {
  return !['affiliation', 'deploy', 'done'].includes(setupStep(setup))
}

// The sides whose tool rack is hidden: the roster rows of the side lie on the table, where the rack lies.
// rosters: { host, guest } → null | { code }. A tool that is already on the table stays.
export function rackHiddenSides(setup, rosters) {
  return rosterRowsShown(setup) ? TEAMS.filter((team) => rosters?.[team]) : []
}

// The step that a player browses, or null for the current step. A step that is not done any more is null.
export function viewOf(setup) {
  const view = setup.view ?? null
  return view && doneSteps(setup).includes(view) ? view : null
}

// Browse `step` (a done step), or null to go back to the current step
export function browse(setup, step) {
  return { ...setup, view: step && doneSteps(setup).includes(step) ? step : null }
}

// The step after (dir 1) or before (dir -1) the browsed one. null is the current step, the end of the list.
export function neighbourStep(setup, dir) {
  const list = doneSteps(setup)
  const view = viewOf(setup)
  const at = view === null ? list.length : list.indexOf(view)
  const next = at + dir
  if (next < 0) return view
  return next >= list.length ? null : list[next]
}

const NO_SQUADS = {
  squads: { host: NO_SQUAD, guest: NO_SQUAD },
  ready: NEW_SETUP.ready,
  placed: NEW_SETUP.placed,
}

// What an Override to `step` takes off the table: { squads, crisis }. squads: the characters and Team Tactic
// cards that the squads put on the table (placedIds), when the step is `squads` or earlier. crisis: the two
// crisis cards of the mission with their tokens, when the step is `edge` or earlier and the edge was chosen.
// The caller removes them the same way as Restart setup (setup/actions.js, removeSetupPieces).
export function overrideRemoval(setup, step) {
  const at = FLOW.indexOf(step)
  const placed = placedIds(setup)
  return {
    squads:
      at <= FLOW.indexOf('squads') && (placed.characters.length > 0 || placed.tactics.length > 0),
    crisis: at <= FLOW.indexOf('edge') && Boolean(setup.edge),
  }
}

// Override: `step` is the current step again, and every later choice is dropped. A step up to `squads` gets a new id, so a squad draft that a browser stored for the old id
// is dropped (rooms/store.js). The cards
// that were drawn stay, except for `deck` and `rollOff`, which draw again. The caller removes what
// overrideRemoval names, and turns Deploy Lock off when it removes the squads.
export function overrideTo(setup, step) {
  const at = FLOW.indexOf(step)
  const next = { ...setup, view: null }
  if (at <= FLOW.indexOf('rollOff')) {
    next.priority = null
    next.rollOff = null
  }
  if (at <= FLOW.indexOf('deck')) {
    next.deck = null
    next.draws = { secure: [], extract: [] }
    next.picks = { secure: null, extract: null }
  }
  if (at <= FLOW.indexOf('first') || at <= FLOW.indexOf('second')) {
    const first = setup.deck?.type
    const picks = { ...next.picks }
    if (at <= FLOW.indexOf('first')) picks.secure = picks.extract = null
    else if (first) picks[otherType(first)] = null
    next.picks = picks
  }
  if (at <= FLOW.indexOf('threat')) next.threat = null
  if (at <= FLOW.indexOf('edge')) next.edge = false
  if (at <= FLOW.indexOf('squads')) {
    Object.assign(next, NO_SQUADS, { affiliation: NEW_SETUP.affiliation })
    next.id = crypto.randomUUID()
    next.lockSet = false
  }
  if (at <= FLOW.indexOf('affiliation')) {
    next.affiliation = NEW_SETUP.affiliation
  }
  if (at <= FLOW.indexOf('deploy')) next.deployed = false
  return next
}

// An empty squad
export const EMPTY_SQUAD = { characters: [], tactics: [] }

// Why a click on a squad of the Breakdown tab does not work for `team` now, or null when it works
// (docs/features/squad-breakdown.md, "Choose a squad"). hidden: the squads are hidden (a multiplayer room,
// also when mySide is null). Never derive it from mySide.
export function squadChoiceBlock(setup, team, { hidden, mySide }) {
  if (hidden && team !== mySide)
    return "This is the other player's roster, so you cannot choose its squad."
  if (placedSides(setup)[team]) return 'The squad is on the table.'
  if (setupStep(setup) !== 'squads') return 'You can choose a squad in the squad step.'
  if (viewOf(setup)) return 'You are browsing an earlier step.'
  if (setup.ready[team]) return 'Squad ready is on, so the squad does not change.'
  return null
}

// The squad of the own side: the one kept in this browser when it is for this setup, else the one in the
// document, else empty. stored: { setupId, squad } | null.
export function ownSquadOf(stored, setup, mySide) {
  return stored && stored.setupId === (setup.id ?? null)
    ? stored.squad
    : (setup.squads[mySide] ?? EMPTY_SQUAD)
}

// The setup as this player sees it: the other player's squad is empty until it is placed. After the reveal
// it is in the document, and the affiliation step needs it. Not hidden: the setup as it is.
export function viewerSetup(setup, { hidden, mySide, ownSquad }) {
  return hidden
    ? {
        ...setup,
        squads: {
          [mySide]: ownSquad,
          [otherTeam(mySide)]: placedSides(setup)[otherTeam(mySide)]
            ? setup.squads[otherTeam(mySide)]
            : EMPTY_SQUAD,
        },
      }
    : setup
}
