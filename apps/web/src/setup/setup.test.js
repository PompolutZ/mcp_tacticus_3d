import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  NEW_SETUP,
  chooseAffiliation,
  deployLockDue,
  lockWasSet,
  chooseDeck,
  chooserOf,
  browse,
  doneSteps,
  neighbourStep,
  overrideRemoval,
  overrideTo,
  viewOf,
  finishDeploy,
  colorOf,
  crisisRows,
  newSetup,
  placeSquad,
  placedIds,
  placedSides,
  possibleThreats,
  priorityOf,
  revealPlan,
  setPriority,
  setRollOff,
  setSquadCharacters,
  setupPlacedCards,
  setupStep,
} from './setup.js'

// A setup at the squads step
const squadsSetup = (extra = {}) => ({
  ...newSetup(),
  priority: 'blue',
  deck: { type: 'secure' },
  picks: { secure: 'a', extract: 'b' },
  threat: 17,
  edge: true,
  ...extra,
})
const bothReady = { ready: { blue: true, red: true } }
const squad = { characters: [0, 2], tactics: [1] }
const cards = { characters: ['c1'], tactics: ['t1'] }

test('newSetup makes a random id', () => {
  assert.notEqual(newSetup().id, newSetup().id)
  assert.equal(NEW_SETUP.id, null)
})

test('setupStep: squads, reveal and done', () => {
  assert.equal(setupStep(squadsSetup()), 'squads')
  assert.equal(setupStep(squadsSetup({ ready: { blue: true, red: false } })), 'squads')
  assert.equal(setupStep(squadsSetup(bothReady)), 'reveal')
  const oneSide = placeSquad(squadsSetup(bothReady), 'blue', squad, cards)
  assert.equal(setupStep(oneSide), 'reveal')
  const both = placeSquad(oneSide, 'red', squad, { characters: [], tactics: [] }, 'unaffiliated')
  assert.equal(setupStep(both), 'affiliation')
  const chosen = chooseAffiliation(both, 'blue', 'asgard')
  assert.equal(setupStep(chosen), 'deploy')
  assert.equal(setupStep(finishDeploy(chosen)), 'done')
})

test('the old placed shape reads as Blue, and a done setup stays done', () => {
  const old = squadsSetup({ ...bothReady, placed: cards })
  delete old.affiliation
  delete old.deployed
  assert.deepEqual(placedSides(old), { blue: cards, red: { characters: [], tactics: [] } })
  assert.equal(setupStep(old), 'done')
  assert.deepEqual(placedIds(old), cards)
  assert.equal(setupPlacedCards(old), true)
  // Not both Ready: nothing is placed yet
  const early = squadsSetup({ placed: { characters: [], tactics: [] } })
  assert.deepEqual(placedSides(early), { blue: null, red: null })
  assert.equal(setupStep(early), 'squads')
})

test('placeSquad writes the squad and one placed key, in the new shape', () => {
  const old = squadsSetup({ ...bothReady, placed: { characters: [], tactics: [] } })
  const next = placeSquad(old, 'red', squad, cards)
  assert.deepEqual(next.squads.red, squad)
  assert.equal(next.placed.red, cards)
  assert.equal(next.placed.characters, undefined)
  assert.deepEqual(placedIds(next), cards)
})

test('revealPlan: nothing until both players are Ready', () => {
  const setup = squadsSetup({ ready: { blue: true, red: false } })
  assert.deepEqual(revealPlan(setup, ['blue'], { blue: null }), { reveal: [], missing: [] })
})

test('revealPlan: a multiplayer browser reveals only its side', () => {
  const setup = squadsSetup(bothReady)
  const stored = { red: { setupId: setup.id, squad } }
  assert.deepEqual(revealPlan(setup, ['red'], stored), {
    reveal: [{ side: 'red', squad }],
    missing: [],
  })
})

test('revealPlan: a single player room reveals both sides from the document', () => {
  const setup = squadsSetup({
    ...bothReady,
    squads: { blue: squad, red: { characters: [1], tactics: [] } },
  })
  const plan = revealPlan(setup, ['blue', 'red'], null)
  assert.deepEqual(
    plan.reveal.map((r) => r.side),
    ['blue', 'red'],
  )
  assert.deepEqual(plan.reveal[1].squad, { characters: [1], tactics: [] })
})

test('revealPlan: a placed side is skipped', () => {
  const setup = placeSquad(squadsSetup(bothReady), 'blue', squad, cards)
  const plan = revealPlan(setup, ['blue', 'red'], null)
  assert.deepEqual(
    plan.reveal.map((r) => r.side),
    ['red'],
  )
  assert.deepEqual(revealPlan(setup, ['blue'], { blue: null }), { reveal: [], missing: [] })
})

test('revealPlan: a squad of another setup id does not count', () => {
  const setup = squadsSetup(bothReady)
  const stale = { red: { setupId: 'other', squad } }
  assert.deepEqual(revealPlan(setup, ['red'], stale), { reveal: [], missing: ['red'] })
})

test('revealPlan: no stored squad is missing', () => {
  const setup = squadsSetup(bothReady)
  assert.deepEqual(revealPlan(setup, ['blue'], { blue: null }), { reveal: [], missing: ['blue'] })
})

test('revealPlan: an old setup without an id matches a stored squad without one', () => {
  const setup = { ...squadsSetup(bothReady), id: undefined }
  const plan = revealPlan(setup, ['blue'], { blue: { setupId: null, squad } })
  assert.equal(plan.reveal.length, 1)
})

test('newSetup has no affiliation', () => {
  assert.deepEqual(newSetup().affiliation, { blue: null, red: null })
})

test('step affiliation while a side has none, done when both have one', () => {
  const none = { characters: [], tactics: [] }
  const base = placeSquad(
    placeSquad(squadsSetup(bothReady), 'blue', squad, none, 'asgard'),
    'red',
    squad,
    none,
  )
  assert.equal(setupStep(base), 'affiliation')
  const chosen = chooseAffiliation(base, 'red', 'unaffiliated')
  assert.equal(setupStep(chosen), 'deploy')
  assert.equal(setupStep(finishDeploy(chosen)), 'done')
})

test('newSetup is not deployed, finishDeploy sets it', () => {
  assert.equal(newSetup().deployed, false)
  assert.equal(finishDeploy(newSetup()).deployed, true)
})

test('a saved setup with no deployed field has no deploy step', () => {
  const none = { characters: [], tactics: [] }
  const old = placeSquad(
    placeSquad(squadsSetup(bothReady), 'blue', squad, none, 'asgard'),
    'red',
    squad,
    none,
    'asgard',
  )
  assert.equal(setupStep(old), 'deploy')
  delete old.deployed
  assert.equal(setupStep(old), 'done')
})

test('a setup with no affiliation field stays done', () => {
  const old = squadsSetup({ ...bothReady, placed: cards })
  delete old.affiliation
  delete old.deployed
  assert.equal(setupStep(old), 'done')
})

test('placeSquad writes the affiliation of one side only', () => {
  const next = placeSquad(squadsSetup(bothReady), 'red', squad, cards, 'avengers')
  assert.deepEqual(next.affiliation, { blue: null, red: 'avengers' })
})

test('chooseAffiliation changes one side', () => {
  const next = chooseAffiliation(squadsSetup(), 'blue', 'asgard')
  assert.deepEqual(next.affiliation, { blue: 'asgard', red: null })
  const old = squadsSetup()
  delete old.affiliation
  delete old.deployed
  assert.deepEqual(chooseAffiliation(old, 'red', 'asgard').affiliation, {
    blue: null,
    red: 'asgard',
  })
})

test('possibleThreats: each step', () => {
  const rosters = {
    blue: { secure: ['s1', 's2'], extract: ['e1'] },
    red: { secure: ['s3'], extract: ['e2', 'e3'] },
  }
  const values = { s1: 17, s2: 15, s3: 17, e1: 20, e2: 16, e3: 18, x: 19 }
  const threatOf = (code) => values[code]
  assert.deepEqual(possibleThreats(newSetup(), rosters, threatOf), [15, 16, 17, 18, 20])
  // Deck chosen: Blue uses secure, 2 cards drawn. Red's extract cards are all possible.
  const deck = {
    ...newSetup(),
    priority: 'blue',
    deck: { type: 'secure' },
    draws: { secure: ['s1', 's2'], extract: [] },
  }
  assert.deepEqual(possibleThreats(deck, rosters, threatOf), [15, 16, 17, 18])
  // First card picked: it and the 2 drawn extract cards
  const first = {
    ...deck,
    picks: { secure: 's2', extract: null },
    draws: { secure: ['s1', 's2'], extract: ['e2', 'e3'] },
  }
  assert.deepEqual(possibleThreats(first, rosters, threatOf), [15, 16, 18])
  // Both picked: the threat step
  const both = { ...first, picks: { secure: 's1', extract: 'e3' } }
  assert.deepEqual(possibleThreats(both, rosters, threatOf), [17, 18])
  // After the Maximum Threat only that value is left
  assert.deepEqual(possibleThreats({ ...both, threat: 18 }, rosters, threatOf), [18])
})

test('possibleThreats: missing roster, no cards, unknown code', () => {
  const threatOf = (code) => ({ s1: 17 })[code]
  assert.deepEqual(
    possibleThreats(
      newSetup(),
      { blue: { secure: ['s1', 'zz'], extract: [] }, red: null },
      threatOf,
    ),
    [17],
  )
  assert.deepEqual(possibleThreats(newSetup(), { blue: null, red: null }, threatOf), [])
  const deck = {
    ...newSetup(),
    priority: 'red',
    deck: { type: 'extract' },
    draws: { secure: [], extract: [] },
  }
  assert.deepEqual(possibleThreats(deck, { blue: null, red: null }, threatOf), [])
})

test('setSquadCharacters replaces the characters, sorted, and keeps the tactics', () => {
  const setup = { ...newSetup(), squads: { blue: squad, red: { characters: [5], tactics: [] } } }
  const next = setSquadCharacters(setup, 'blue', [4, 1, 3])
  assert.deepEqual(next.squads.blue, { characters: [1, 3, 4], tactics: [1] })
  assert.deepEqual(next.squads.red, setup.squads.red)
  assert.deepEqual(setup.squads.blue, squad)
})

test('setupStep: the roll off comes first, until Priority is set', () => {
  assert.equal(setupStep(newSetup()), 'rollOff')
  assert.equal(setupStep(setPriority(newSetup(), 'red')), 'deck')
  assert.equal(newSetup().priority, null)
})

test('chooseDeck: the player with Priority chooses, no team argument', () => {
  const start = setPriority(newSetup(), 'red')
  const next = chooseDeck(start, 'extract', ['a', 'b', 'c'], () => 0)
  assert.equal(next.priority, 'red')
  assert.deepEqual(next.deck, { type: 'extract' })
  assert.equal(next.draws.extract.length, 2)
  assert.equal(setupStep(next), 'first')
})

test('priorityOf: a setup saved with deck.team and no priority reads deck.team', () => {
  const old = { ...newSetup(), priority: undefined, deck: { team: 'red', type: 'secure' } }
  assert.equal(priorityOf(old), 'red')
  assert.equal(setupStep(old), 'first')
  assert.equal(colorOf('red', old, true), 'blue')
  const none = { ...newSetup(), priority: undefined }
  assert.equal(priorityOf(none), null)
  assert.equal(setupStep(none), 'rollOff')
  assert.equal(priorityOf({ ...newSetup(), priority: 'blue', deck: { team: 'red' } }), 'blue')
})

test('colorOf: before the roll off the +z side (key blue) is Blue', () => {
  for (const follow of [true, false]) {
    assert.equal(colorOf('blue', newSetup(), follow), 'blue')
    assert.equal(colorOf('red', newSetup(), follow), 'red')
  }
  assert.equal(colorOf('blue', null, true), 'blue')
})

test('colorOf: in a room the side with Priority is Blue', () => {
  const red = setPriority(newSetup(), 'red')
  assert.equal(colorOf('red', red, true), 'blue')
  assert.equal(colorOf('blue', red, true), 'red')
  const blue = setPriority(newSetup(), 'blue')
  assert.equal(colorOf('blue', blue, true), 'blue')
  assert.equal(colorOf('red', blue, true), 'red')
})

test('colorOf: in the Sandbox the +z side is always Blue', () => {
  const red = setPriority(newSetup(), 'red')
  assert.equal(colorOf('blue', red, false), 'blue')
  assert.equal(colorOf('red', red, false), 'red')
})

test('crisisRows: the roll-off step shows the deck rows, the winner row comes from Priority', () => {
  const parsed = { blue: { secure: ['a'], extract: ['b'] }, red: { secure: ['c'], extract: ['d'] } }
  assert.equal(crisisRows(newSetup(), parsed).length, 4)
  const next = chooseDeck(setPriority(newSetup(), 'red'), 'secure', ['c', 'e'], () => 0)
  const rows = crisisRows(next, parsed)
  assert.equal(rows[0].team, 'red')
  assert.equal(rows[1].team, 'blue')
})

test('setRollOff: a winner gets Priority, a tie keeps it null, a manual Priority clears the result', () => {
  const counts = { blue: {}, red: {} }
  const won = setRollOff(newSetup(), { winner: 'red', counts })
  assert.equal(won.priority, 'red')
  assert.equal(setupStep(won), 'deck')
  assert.ok(won.rollOff)
  const tie = setRollOff(newSetup(), { winner: null, counts })
  assert.equal(tie.priority, null)
  assert.equal(setupStep(tie), 'rollOff')
  assert.equal(setPriority(tie, 'blue').rollOff, null)
})

test('chooserOf: the side that chooses in each step', () => {
  // Red has Priority
  const base = { ...newSetup(), priority: 'red' }
  assert.equal(chooserOf(newSetup()), null)
  assert.equal(chooserOf(base), 'red') // deck
  const first = { ...base, deck: { type: 'secure' } }
  assert.equal(chooserOf(first), 'blue')
  const second = { ...first, picks: { secure: 's1', extract: null } }
  assert.equal(chooserOf(second), 'red')
  const threat = { ...second, picks: { secure: 's1', extract: 'e1' } }
  assert.equal(chooserOf(threat), 'blue')
  const edge = { ...threat, threat: 17 }
  assert.equal(chooserOf(edge), 'red')
  assert.equal(chooserOf({ ...edge, priority: 'blue' }), 'blue')
  assert.equal(chooserOf({ ...edge, edge: true }), null)
})

// History: a setup at each step, built from the fields
const atDeploy = () => {
  const placed = placeSquad(
    placeSquad(squadsSetup(bothReady), 'blue', squad, cards, 'asgard'),
    'red',
    squad,
    { characters: ['c2'], tactics: [] },
    'unaffiliated',
  )
  return placed
}
const withDraws = () =>
  squadsSetup({
    draws: { secure: ['a', 'x'], extract: ['b', 'y'] },
    rollOff: { winner: 'blue', counts: {} },
  })

test('doneSteps lists the steps before the current one, in order', () => {
  assert.deepEqual(doneSteps(newSetup()), [])
  assert.deepEqual(doneSteps({ ...newSetup(), priority: 'blue' }), ['rollOff'])
  assert.deepEqual(doneSteps({ ...newSetup(), priority: 'blue', deck: { type: 'secure' } }), [
    'rollOff',
    'deck',
  ])
  assert.deepEqual(doneSteps(squadsSetup()), [
    'rollOff',
    'deck',
    'first',
    'second',
    'threat',
    'edge',
  ])
  assert.deepEqual(doneSteps(squadsSetup(bothReady)), [
    'rollOff',
    'deck',
    'first',
    'second',
    'threat',
    'edge',
    'squads',
  ])
  assert.deepEqual(doneSteps(atDeploy()).slice(-2), ['squads', 'affiliation'])
  assert.equal(setupStep(atDeploy()), 'deploy')
  assert.deepEqual(doneSteps(finishDeploy(atDeploy())).slice(-3), [
    'squads',
    'affiliation',
    'deploy',
  ])
})

test('doneSteps skips affiliation and deploy for a setup saved before them', () => {
  const old = finishDeploy(atDeploy())
  delete old.affiliation
  delete old.deployed
  assert.equal(setupStep(old), 'done')
  assert.deepEqual(doneSteps(old).slice(-1), ['squads'])
})

test('browse sets the view for a done step only; viewOf and neighbourStep walk the list', () => {
  const setup = squadsSetup()
  assert.equal(viewOf(setup), null)
  assert.equal(browse(setup, 'squads').view, null)
  assert.equal(browse(setup, 'threat').view, 'threat')
  const at = browse(setup, 'threat')
  assert.equal(neighbourStep(at, -1), 'second')
  assert.equal(neighbourStep(at, 1), 'edge')
  assert.equal(neighbourStep(browse(setup, 'edge'), 1), null)
  assert.equal(neighbourStep(setup, -1), 'edge')
  assert.equal(neighbourStep(browse(setup, 'rollOff'), -1), 'rollOff')
  assert.equal(browse(at, null).view, null)
  // a view that is not done any more is the current step
  assert.equal(viewOf({ ...setup, view: 'squads' }), null)
  assert.equal(viewOf({ ...setup, view: undefined }), null)
})

test('overrideTo rollOff clears Priority, the read result and everything after', () => {
  const next = overrideTo({ ...withDraws(), view: 'rollOff' }, 'rollOff')
  assert.equal(setupStep(next), 'rollOff')
  assert.equal(next.priority, null)
  assert.equal(next.rollOff, null)
  assert.equal(next.deck, null)
  assert.deepEqual(next.draws, { secure: [], extract: [] })
  assert.equal(next.view, null)
})

test('overrideTo deck clears the deck, draws, picks, threat and edge, and keeps Priority', () => {
  const next = overrideTo(withDraws(), 'deck')
  assert.equal(setupStep(next), 'deck')
  assert.equal(next.priority, 'blue')
  assert.deepEqual(next.draws, { secure: [], extract: [] })
  assert.deepEqual(next.picks, { secure: null, extract: null })
  assert.equal(next.threat, null)
  assert.equal(next.edge, false)
})

test('overrideTo first clears both picks and keeps the draws', () => {
  const setup = withDraws()
  const next = overrideTo(setup, 'first')
  assert.equal(setupStep(next), 'first')
  assert.deepEqual(next.picks, { secure: null, extract: null })
  assert.deepEqual(next.draws, setup.draws)
  assert.deepEqual(next.deck, { type: 'secure' })
  assert.equal(next.threat, null)
  assert.equal(next.edge, false)
})

test('overrideTo second clears the second pick only and keeps the draws', () => {
  const setup = withDraws()
  const next = overrideTo(setup, 'second')
  assert.equal(setupStep(next), 'second')
  assert.deepEqual(next.picks, { secure: 'a', extract: null })
  assert.deepEqual(next.draws, setup.draws)
  assert.equal(next.threat, null)
  // the first deck is Extract: the Secure pick goes
  const extractFirst = overrideTo(
    squadsSetup({ deck: { type: 'extract' }, picks: { secure: 'a', extract: 'b' } }),
    'second',
  )
  assert.deepEqual(extractFirst.picks, { secure: null, extract: 'b' })
})

test('overrideTo edge or earlier gives a new id, so stored squad drafts are dropped', () => {
  const setup = squadsSetup()
  assert.notEqual(overrideTo(setup, 'edge').id, setup.id)
  assert.notEqual(overrideTo(setup, 'rollOff').id, setup.id)
})

test('overrideTo threat and edge clear that choice and later ones', () => {
  const threat = overrideTo(squadsSetup(), 'threat')
  assert.equal(setupStep(threat), 'threat')
  assert.equal(threat.threat, null)
  assert.equal(threat.edge, false)
  assert.deepEqual(threat.picks, { secure: 'a', extract: 'b' })
  const edge = overrideTo(squadsSetup(), 'edge')
  assert.equal(setupStep(edge), 'edge')
  assert.equal(edge.threat, 17)
  assert.equal(edge.edge, false)
})

test('overrideTo squads resets squads, Ready, placed, affiliation and deployed', () => {
  const setup = { ...atDeploy(), view: 'squads' }
  const next = overrideTo(setup, 'squads')
  assert.equal(setupStep(next), 'squads')
  assert.equal(next.edge, true)
  assert.equal(next.threat, 17)
  assert.deepEqual(next.squads.blue, { characters: [], tactics: [] })
  assert.deepEqual(next.ready, { blue: false, red: false })
  assert.deepEqual(next.placed, { blue: null, red: null })
  assert.deepEqual(next.affiliation, { blue: null, red: null })
  assert.equal(next.deployed, false)
  assert.notEqual(next.id, setup.id)
  assert.equal(
    revealPlan(next, ['red'], {
      red: { setupId: setup.id, squad: { characters: [0], tactics: [] } },
    }).missing.length,
    0,
  )
})

test('overrideTo affiliation keeps the squads, clears affiliation and deployed', () => {
  const setup = finishDeploy(atDeploy())
  const next = overrideTo(setup, 'affiliation')
  assert.equal(next.id, setup.id)
  assert.equal(setupStep(next), 'affiliation')
  assert.deepEqual(next.affiliation, { blue: null, red: null })
  assert.equal(next.deployed, false)
  assert.deepEqual(next.placed, setup.placed)
  assert.deepEqual(next.ready, setup.ready)
  assert.equal(setupStep(overrideTo(setup, 'deploy')), 'deploy')
  assert.deepEqual(overrideTo(setup, 'deploy').affiliation, setup.affiliation)
})

test('overrideRemoval names what leaves the table', () => {
  const setup = atDeploy()
  assert.deepEqual(overrideRemoval(setup, 'squads'), { squads: true, crisis: false })
  assert.deepEqual(overrideRemoval(setup, 'edge'), { squads: true, crisis: true })
  assert.deepEqual(overrideRemoval(setup, 'rollOff'), { squads: true, crisis: true })
  assert.deepEqual(overrideRemoval(setup, 'affiliation'), { squads: false, crisis: false })
  // the edge was chosen, no squad on the table yet
  assert.deepEqual(overrideRemoval(squadsSetup(bothReady), 'threat'), {
    squads: false,
    crisis: true,
  })
  // no edge yet: no crisis cards on the table
  assert.deepEqual(overrideRemoval(overrideTo(squadsSetup(), 'edge'), 'first'), {
    squads: false,
    crisis: false,
  })
})

test('deployLockDue is true once, when both squads are placed', () => {
  const start = squadsSetup(bothReady)
  assert.equal(deployLockDue(start), false)
  const one = placeSquad(start, 'blue', squad, cards)
  assert.equal(deployLockDue(one), false)
  const both = placeSquad(one, 'red', squad, cards, 'unaffiliated')
  assert.equal(deployLockDue(both), true)
  assert.equal(deployLockDue(lockWasSet(both)), false)
  assert.equal(deployLockDue(finishDeploy(both)), false)
  const old = { ...both }
  delete old.deployed
  assert.equal(deployLockDue(old), false)
  assert.equal(overrideTo(lockWasSet(both), 'squads').lockSet, false)
})
