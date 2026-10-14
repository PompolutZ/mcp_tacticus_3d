import jarvisData from './jarvis-characters.json'
import migratedData from './characters.json'
import { sharedImmunities } from './immunity.js'
import { sharedPowerBonus } from './power.js'
import { cardSizes, sideSize } from './size.js'
import { dropPlacer } from './dropPlacer.js'

function baseName(mm) {
  if (mm <= 35) return 'small'
  if (mm <= 50) return 'medium'
  return 'large'
}

const migrated = new Map()
for (const [slug, ch] of Object.entries(migratedData)) {
  migrated.set(ch.id, { slug, ...ch })
}

// One Library row: the Jarvis character jch (stats), with the migrated character m (files) when
// there is one. mctCode is the row's MCT code.
function rosterEntry(jch, m, mctCode) {
  return {
    slug: m?.slug || jch.slug,
    // The page of the character on Jarvis is jarvis-protocol.com/characters/<jarvisSlug>. slug can
    // differ: a migrated character has the slug of characters.json.
    jarvisSlug: jch.slug,
    name: m?.name || jch.name,
    mctCode,
    available: !!m,
    base: m?.base || baseName(jch.baseSize),
    figure: m?.figure || 'model',
    rotation: m?.rotation || 0,
    // Stamina of each stat card side, for the tray's Damage limit (see TrayControls). Jarvis
    // stores it as a string; "?" (Multiple Man's variable stamina) falls back to 0.
    staminaHealthy: Number(jch.statCard.frontSide.stamina) || 0,
    // A grunt has no Injured side (backSide is null): 0
    staminaInjured: Number(jch.statCard.backSide?.stamina) || 0,
    // Size of each stat card side, for the Line of Sight tool (see size.js)
    sizes: cardSizes(jch.statCard),
    // Threat Level, for the squad threat in the game setup (see docs/features/setup-game.md)
    threat: jch.threatLevel ?? 0,
    // Jarvis affiliation slugs, for the squad affiliation in the game setup (scoreboard/affiliations.js)
    affiliations: (jch.affiliations ?? []).map((a) => a.slug),
    // Alter ego from Jarvis, or null (grunts, Multiple Man). No two characters of a squad share one (p11), see
    // rosters/breakdown.js.
    alterEgo: jch.alterEgo ?? null,
    // The Jarvis tag peerless: at most one such character per squad (p21), see rosters/breakdown.js.
    peerless: (jch.tags ?? []).includes('peerless'),
    // The Jarvis tag rogueAgent (Taskmaster, Winter Soldier): counts as affiliated in Squad building, see
    // scoreboard/affiliations.js.
    rogue: (jch.tags ?? []).includes('rogueAgent'),
    // Where the character is a leader, for the leader star of the breakdown: [{ affiliation, tactic }].
    // affiliation: the Jarvis slug. tactic: null (always a leader), or the slug of the Team Tactic card that
    // the roster needs (isLeaderWithTeamTactics).
    leads: (jch.affiliations ?? [])
      .filter((a) => a.isLeader || a.isLeaderWithTeamTactics)
      .map((a) => ({
        affiliation: a.slug,
        tactic: a.isLeader ? null : a.isLeaderWithTeamTactics,
      })),
    // Token keys (tokens.json) from the mod's cToken, written by migrate-characters.mjs.
    // See docs/features/character-trays.md, "Give tokens by drag and drop", and TrayControls.jsx.
    tokens: m?.tokens || [],
    // Conditions the character is immune to, per side, in every form (immunity.js). From Jarvis.
    immune: sharedImmunities(jch),
    // Who places a token that the character drops, per side: 'opponent' or 'controller' (dropPlacer.js). From Jarvis.
    dropPlacer: {
      healthy: dropPlacer({ side: 'healthy' }, jch),
      injured: dropPlacer({ side: 'injured' }, jch),
    },
    // Fixed extra Power of the Power Phase, per side, smallest of the forms (power.js). From Jarvis.
    powerBonus: sharedPowerBonus(jch),
    // Grunts cannot have Power, so the Power Phase skips them (power.js).
    grunt: !!jch.isGrunt,
    // Second form: null, or { figure, rotation, base?, name?, portrait?, card? } from
    // characters.json. See docs/features/character-trays.md, "Second forms", and models.js.
    transform: m?.transform ?? null,
    // Number of construct models (characters/files.js, characterConstruct), 0 for none. From characters.json.
    constructs: m?.constructs ?? 0,
    // Jarvis name of the second form, for example 'diamond' for Emma Frost, or null. The roster popup
    // uses it as the label of the second card (rosters/cards.js).
    secondForm: jch.secondFormSlug || null,
    // Grunt rows of this host, in the order of characters.json (see GRUNT_ROWS below). A grunt has none.
    grunts: [],
  }
}

// An alternate sculpt (Mephisto Convention Exclusive) has the MCT code of its main character, so it
// would be a second row for the same character.
const jarvisRows = jarvisData.filter((jch) => jch.exportCode && !jch.isAlternateSculpt)
const jarvisCodes = new Set(jarvisRows.map((jch) => jch.exportCode))
const jarvisByName = new Map(jarvisRows.map((jch) => [jch.name, jch]))

// A migrated character with its own MCT code but no Jarvis entry of its own gets a row too, with the
// stats of the Jarvis character of the same name. The only one now is the second Sentinel MK4
// (00510102): the mod has a row for each of the two sculpts in the box, and Jarvis has one entry. Jarvis
// uses 00510102 in a roster code for the second Sentinel MK4 of a roster.
const extraRows = [...migrated.values()]
  .filter((m) => !jarvisCodes.has(m.id) && jarvisByName.has(m.name))
  .map((m) => rosterEntry(jarvisByName.get(m.name), m, m.id))

// The grunts: migrated characters that a host lists in `grunts` of characters.json. Jarvis has no MCT
// code for them, so they are not in CHARACTERS and the Library does not list them (docs/features/
// character-trays.md, "Grunts"). Stats come from the Jarvis grunt row of the same name; the mod
// names the two Sand Constructs "Sand Construct(s) - Fisty" and "... - Twisty", Jarvis "Sand Construct"
// twice, with the same stats.
const jarvisGrunts = jarvisData.filter((jch) => jch.isGrunt)
function gruntRow(m) {
  const jch =
    jarvisGrunts.find((j) => j.name === m.name) ??
    jarvisGrunts.find((j) => m.name.startsWith(j.name))
  return jch ? rosterEntry(jch, m, m.id) : null
}
const GRUNT_ROWS = new Map()
for (const m of migrated.values()) {
  for (const key of m.grunts ?? []) {
    const g = migratedData[key] && migrated.get(migratedData[key].id)
    const row = g && gruntRow(g)
    if (row) GRUNT_ROWS.set(key, row)
  }
}

export const CHARACTERS = [
  ...jarvisRows.map((jch) => rosterEntry(jch, migrated.get(jch.exportCode), jch.exportCode)),
  ...extraRows,
].sort((a, b) => a.name.localeCompare(b.name) || a.mctCode.localeCompare(b.mctCode))

// The grunts of every host that is a row of CHARACTERS
for (const ch of CHARACTERS) {
  ch.grunts = (migratedData[ch.slug]?.grunts ?? []).flatMap((key) => GRUNT_ROWS.get(key) ?? [])
}

const bySlug = new Map([...CHARACTERS, ...GRUNT_ROWS.values()].map((ch) => [ch.slug, ch]))
const byCode = new Map(CHARACTERS.map((ch) => [ch.mctCode, ch]))

// The Library row of an MCT code, or null. A roster stores characters by code (rosters/mct.js).
export function characterByCode(code) {
  return byCode.get(code) ?? null
}

// Display name of a spawned character (App.jsx stores only its slug as `key`).
export function characterName(slug) {
  return bySlug.get(slug)?.name ?? slug
}

// Stamina of a spawned character's current side: the Damage limit on its tray.
export function characterStamina(slug, side) {
  const ch = bySlug.get(slug)
  if (!ch) return 0
  return side === 'injured' ? ch.staminaInjured : ch.staminaHealthy
}

// Size of a spawned character's current side, or 0 when unknown: the Line of Sight block Size.
export function characterSize(slug, side) {
  const ch = bySlug.get(slug)
  return ch ? sideSize(ch.sizes, side) : 0
}

// Every character's Give sources start with Activated and Dazed. characters.json does not list them:
// the mod spawns them next to every tray (see migrate-characters.mjs).
const ALWAYS_GIVEN = ['activated', 'dazed']

// Token keys of the Give sources next to this character's tray, in order: Activated, Dazed, then
// the tokens of the character (see docs/features/character-trays.md, "Give tokens by drag and drop").
// A host also lists the tokens of its grunts: a grunt has no Give sources of its own, so a player drags
// them from the host's row onto the grunt card (docs/features/character-trays.md, "Grunts").
export function characterGiveSources(slug) {
  const ch = bySlug.get(slug)
  const ofGrunts = (ch?.grunts ?? []).flatMap((grunt) => grunt.tokens)
  return [...new Set([...ALWAYS_GIVEN, ...(ch?.tokens ?? []), ...ofGrunts])]
}

// Token keys this character cannot get on its current side (p21), when every form is immune to
// them. handleCharacterTokenGive (characters/useCharacterActions.js) uses this. See docs/features/character-trays.md, "Immunities".
export function characterImmune(slug, side) {
  return bySlug.get(slug)?.immune[side === 'injured' ? 'injured' : 'healthy'] ?? []
}

// 'opponent' or 'controller': who places an objective token that this character drops on its current side
// (dropPlacer.js). 'opponent' when unknown.
export function characterDropPlacer(slug, side) {
  return bySlug.get(slug)?.dropPlacer[side === 'injured' ? 'injured' : 'healthy'] ?? 'opponent'
}

// Fixed extra Power this character gains in the Power Phase on its current side (power.js); 0 when
// unknown. See docs/features/round-phases.md, "Facts from Jarvis".
export function characterPowerBonus(slug, side) {
  return bySlug.get(slug)?.powerBonus[side === 'injured' ? 'injured' : 'healthy'] ?? 0
}

// True for a grunt: it cannot have Power.
export function characterIsGrunt(slug) {
  return bySlug.get(slug)?.grunt ?? false
}
