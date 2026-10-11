import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  POWER_GEM,
  formPowerBonus,
  parsePowerBonus,
  powerAfterPhase,
  sharedPowerBonus,
} from './power.js'

const rows = JSON.parse(readFileSync(new URL('./jarvis-characters.json', import.meta.url), 'utf8'))
const row = (slug) => {
  const found = rows.find((r) => r.slug === slug)
  assert.ok(found, `no Jarvis row ${slug}`)
  return found
}
const bonus = (slug) => sharedPowerBonus(row(slug))

test('+1, +2 on both sides', () => {
  assert.deepEqual(bonus('abomination'), { healthy: 1, injured: 1 })
  assert.deepEqual(bonus('doctor-strange-sorcerer-supreme'), { healthy: 2, injured: 2 })
  assert.deepEqual(bonus('hulk'), { healthy: 2, injured: 2 })
})

test('sides that differ, and "for each" gives 0', () => {
  assert.deepEqual(bonus('hulkbuster'), { healthy: 1, injured: 0 })
  assert.deepEqual(bonus('phoenix'), { healthy: 1, injured: 0 })
  assert.deepEqual(bonus('mephisto-lord-of-temptation'), { healthy: 0, injured: 0 })
})

test('text variants', () => {
  for (const slug of [
    'valkyrie-and-elendil',
    'warriors-three',
    'ulik',
    'black-bolt',
    'hela-queen-of-hel',
  ])
    assert.deepEqual(bonus(slug), { healthy: 1, injured: 1 }, slug)
  // French
  assert.deepEqual(bonus('the-wrecking-crew'), { healthy: 1, injured: 1 })
  assert.deepEqual(bonus('thor-hero-of-midgard'), { healthy: 1, injured: 1 })
})

test('parsePowerBonus', () => {
  const t = (s) => parsePowerBonus(s)
  assert.equal(t('During the |*Power Phase|, this character gains 2 additional |!power|.'), 2)
  assert.equal(t('During the |*Power Phase| this character gains 1 additional |!power|.'), 1)
  assert.equal(t("... gains 1 additional |!power| for each Devil's Deal token it has."), 0)
  assert.equal(
    t('Pendant la |*Phase de Pouvoir|, ce personnage gagne 1 |!power| supplémentaire.'),
    1,
  )
  assert.equal(
    t('This character and each other character you control gains 1 additional |!power|.'),
    0,
  )
  assert.equal(t(''), 0)
})

// Valkyrie and Elendil and Warriors Three have the text but not the tag (the text is the source).
// Magneto has the tag, but his Power depends on Metal Constructs.
const TAG_WITHOUT_BONUS = ['magneto']

test('every greaterPowerPhase row has extra Power on a side, except the named ones', () => {
  const missing = rows
    .filter((r) => r.tags.includes('greaterPowerPhase'))
    .filter((r) => formPowerBonus(r).every((f) => !f.healthy && !f.injured))
    .map((r) => r.slug)
  assert.deepEqual(missing, TAG_WITHOUT_BONUS)
})

test('40 rows have extra Power', () => {
  const withBonus = rows.filter((r) => formPowerBonus(r).some((f) => f.healthy || f.injured))
  assert.equal(withBonus.length, 40)
})

test('no row with two stat cards has extra Power', () => {
  const two = rows.filter((r) => r.secondStatCard)
  assert.ok(two.length > 0)
  assert.deepEqual(
    two.filter((r) => formPowerBonus(r).some((f) => f.healthy || f.injured)).map((r) => r.slug),
    [],
  )
})

test('powerAfterPhase', () => {
  const p = powerAfterPhase
  assert.equal(p({ power: 2 }), 3)
  assert.equal(p({ power: 2, bonus: 2 }), 5)
  assert.equal(p({ power: 2, gems: [POWER_GEM] }), 5)
  assert.equal(p({ power: 2, gems: ['00240102'] }), 4)
  assert.equal(p({ power: 2, gems: [POWER_GEM, '00240102'] }), 6)
  assert.equal(p({ power: 9, bonus: 2 }), 10)
  assert.equal(p({ power: 10 }), 10)
  // Stun: the whole gain is 1
  assert.equal(p({ power: 2, bonus: 2, gems: [POWER_GEM], stun: 1 }), 3)
  // Poison
  assert.equal(p({ power: 0, poison: 1 }), 0)
  assert.equal(p({ power: 5, poison: 1 }), 5)
  assert.equal(p({ power: 10, poison: 1 }), 9)
  assert.equal(p({ power: 5, bonus: 2, poison: 1 }), 7)
  // Stun and Poison together
  assert.equal(p({ power: 5, bonus: 2, stun: 1, poison: 1 }), 5)
  // Grunts stay as they are
  assert.equal(p({ power: 0, bonus: 2, grunt: true }), 0)
})
