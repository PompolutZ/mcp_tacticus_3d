// Find an MCT code in the Jarvis data: kind, name, image files or null, model or not.
// See docs/features/roster.md, "Data" and "Cards without files".
import { CHARACTERS, characterByCode } from '../characters/characters.js'
import { characterCard, transformCard } from '../characters/files.js'
import tacticsData from '../tactics/jarvis-tactics-cards.json'
import tacticFiles from '../tactics/cards.json'
import { tacticCardBack, tacticCardFace } from '../tactics/files.js'
import { isFaceKey } from '../tactics/faceData.js'
import jarvisCharacters from '../characters/jarvis-characters.json'
import crisisData from '../crisis/jarvis-crisis-cards.json'
import crisisFiles from '../crisis/cards.json'
import { crisisCardFace } from '../crisis/files.js'
import { affiliationKey, squadAffiliations } from '../scoreboard/affiliations.js'
import { MAX_BREAKDOWN_CHARACTERS, matchesFilters, squadCombinations } from './breakdown.js'
import { jarvisValidatorCode, parseRoster } from './mct.js'

// Gem code -> threat, from bearableGemsWithName of the Jarvis character rows. The first value of a code wins.
const gemThreats = new Map()
for (const row of jarvisCharacters) {
  for (const gem of row.bearableGemsWithName ?? []) {
    if (gem.exportCode && !gemThreats.has(gem.exportCode)) {
      gemThreats.set(gem.exportCode, gem.threatLevel)
    }
  }
}

// Three tactic ids in cards.json lost their leading zero (1430206), so pad them to 8 digits.
const idToKey = (files) =>
  new Map(Object.entries(files).map(([key, card]) => [card.id.padStart(8, '0'), key]))
const tacticKeys = idToKey(tacticFiles)
const crisisKeys = idToKey(crisisFiles)

// code -> { code, kind, name, key, threat, image, back, model, variants, jarvisUrl }. Each code once. key: the
// key of a Team Tactic or crisis card in its cards.json, or null when the app has no files for it. threat: the
// Threat Level of a character, the Maximum Threat of a crisis card, or the threat of an Infinity Gem (from
// bearableGemsWithName; 1 when Jarvis has none), from Jarvis. back: the image
// of the other side, for the flip in the roster popup. null when the app has no image, or when the other side is the
// same for every card of the kind: the back of a crisis card shows only its type.
// faceKey: the key of a Team Tactic card whose face the app draws from Jarvis data (components/TacticFace.jsx), else null;
// image is then not loaded, the face comes from the component.
// variants: the cards that the roster popup can switch between for this character, [{ label, image, back, portrait? }],
// the character card first. null when the character has one card. A second form with its own card (see
// docs/features/character-trays.md, "Second forms") and each migrated grunt of a host (see "Grunts").
// gem: true for an Infinity Gem (isInfinityGem in Jarvis). It has kind 'tactic' and the files of a Team Tactic card.
// jarvisUrl: the page of the card on Jarvis, for the link in the roster popup. A character with a second
// form has one page for both cards.
const cards = new Map()

const JARVIS = 'https://www.jarvis-protocol.com'

// 'diamond' -> 'Diamond form'
const formLabel = (slug) =>
  slug ? `${slug[0].toUpperCase()}${slug.slice(1).replace(/-/g, ' ')} form` : 'Second form'

for (const ch of CHARACTERS) {
  const image = ch.available ? characterCard(ch.slug, 'healthy') : null
  const back = ch.available ? characterCard(ch.slug, 'injured') : null
  // The card of the character, its second form, and each grunt (no Injured side, so no back; portrait: the image is 808x1404, not 3:2)
  const forms = [
    ...(ch.transform?.card
      ? [
          {
            label: formLabel(ch.secondForm),
            image: transformCard(ch.slug, 'healthy'),
            back: transformCard(ch.slug, 'injured'),
          },
        ]
      : []),
    ...ch.grunts.map((grunt) => ({
      label: grunt.name,
      image: characterCard(grunt.slug, 'healthy'),
      back: null,
      portrait: true,
    })),
  ]
  const variants =
    ch.available && forms.length > 0 ? [{ label: ch.name, image, back }, ...forms] : null
  cards.set(ch.mctCode, {
    code: ch.mctCode,
    kind: 'character',
    name: ch.name,
    key: null,
    threat: ch.threat,
    image,
    back,
    model: ch.available,
    variants,
    jarvisUrl: `${JARVIS}/characters/${ch.jarvisSlug}`,
  })
}

// Jarvis lists some codes twice (reprints). The first row is the card.
for (const row of tacticsData) {
  if (!row.exportCode || cards.has(row.exportCode)) continue
  const key = tacticKeys.get(row.exportCode)
  cards.set(row.exportCode, {
    code: row.exportCode,
    kind: 'tactic',
    name: row.name,
    key: key ?? null,
    threat: row.isInfinityGem ? (gemThreats.get(row.exportCode) ?? 1) : null,
    image: key ? tacticCardFace(key) : null,
    back: key ? tacticCardBack(key) : null,
    faceKey: key && isFaceKey(key) ? key : null,
    model: false,
    variants: null,
    gem: Boolean(row.isInfinityGem),
    jarvisUrl: `${JARVIS}/team-tactics-cards/${row.slug}`,
  })
}

// The current printing of a crisis card has replacedBy: null.
for (const row of crisisData) {
  if (!row.exportCode || row.replacedBy !== null || cards.has(row.exportCode)) continue
  const key = crisisKeys.get(row.exportCode)
  cards.set(row.exportCode, {
    code: row.exportCode,
    kind: row.type === 'Secure' ? 'secure' : 'extract',
    name: row.name,
    key: key ?? null,
    threat: row.threatLevel,
    image: key ? crisisCardFace(key) : null,
    back: null,
    model: false,
    variants: null,
    jarvisUrl: `${JARVIS}/crisis-cards/${row.slug}`,
  })
}

// The kind for the roster parser: a gem is not a Team Tactic card, so it stays out of the tactics group
function cardKind(code) {
  const info = cards.get(code)
  return info?.gem ? 'gem' : (info?.kind ?? null)
}

export function rosterCard(code) {
  return cards.get(code) ?? null
}

// The cards attached to a character (its `attached` list of MCT codes, missing in old documents), for
// the gem chips on its tray: [{ code, name, label, image, faceKey }]. label: "Infinity Gem: Soul" gives "Soul Gem".
// image is null when the app has no image of the card. A code the app does not know is left out.
export function attachedCards(character) {
  return (character.attached ?? []).flatMap((code) => {
    const info = cards.get(code)
    if (!info) return []
    const label = /^Infinity Gem: (.+)$/.test(info.name)
      ? `${info.name.slice('Infinity Gem: '.length)} Gem`
      : info.name
    return [{ code, name: info.name, label, image: info.image, faceKey: info.faceKey }]
  })
}

export function parseRosterText(text) {
  return parseRoster(text, cardKind)
}

// The page of a parsed roster in the Jarvis roster validator, for the link in the roster popup
export function jarvisRosterUrl(parsed) {
  return `${JARVIS}/roster-validator?mctCode=${encodeURIComponent(jarvisValidatorCode(parsed))}`
}

// The sum of the Threat Levels of the characters at `places` of a parsed roster and of their attached
// Infinity Gems (setup/setup.js, squads)
export function squadThreat(parsed, places) {
  return places.reduce((sum, place) => {
    const ch = parsed.characters[place]
    const gems = (ch?.gems ?? []).reduce((g, code) => g + (cards.get(code)?.threat ?? 0), 0)
    return sum + (cards.get(ch?.code)?.threat ?? 0) + gems
  }, 0)
}

// The affiliation token keys that a squad can use (more than half of its characters, rule p11), sorted by
// name. places: as in squadThreat.
export function squadAffiliationKeys(parsed, places) {
  return squadAffiliations(
    places.map((place) => {
      const ch = characterByCode(parsed.characters[place]?.code)
      return { affiliations: ch?.affiliations ?? [], rogue: ch?.rogue ?? false }
    }),
  )
}

// The threat values of all current crisis cards, sorted, each once (15 to 20 now). The breakdown shows them
// when the rosters have no crisis cards. See docs/features/squad-breakdown.md, "Threat values".
export const CRISIS_THREATS = [
  ...new Set(
    [...cards.values()]
      .filter((c) => c.kind === 'secure' || c.kind === 'extract')
      .map((c) => c.threat),
  ),
].sort((a, b) => a - b)

// The units of the characters of a parsed roster for squadCombinations (breakdown.js), in roster order.
// place: the place in parsed.characters. threat: Threat Level plus attached gems, as in squadThreat.
function breakdownUnits(parsed) {
  return parsed.characters.map((ch, place) => {
    const info = characterByCode(ch.code)
    return {
      place,
      name: info?.name ?? ch.code,
      threat: squadThreat(parsed, [place]),
      alterEgo: info?.alterEgo ?? null,
      peerless: Boolean(info?.peerless),
    }
  })
}

// The Jarvis slugs of the Team Tactic cards of a roster. A code with two Jarvis rows gives both slugs.
function tacticSlugs(parsed) {
  const codes = new Set(parsed.tactics)
  return new Set(tacticsData.filter((row) => codes.has(row.exportCode)).map((row) => row.slug))
}

// The combinations of a parsed roster for the threat value `threat` (see docs/features/squad-breakdown.md,
// "Combinations" and "Filters"): [{ places, threat, affiliations: [{ key, leader }] }]. The characters in
// filters.mustNot are removed first. null when the roster has more than 14 characters.
// affiliations: the token keys of the combination (squadAffiliationKeys). leader: a character leads it,
// with isLeader or with a Team Tactic card of the roster (all of them, not only the chosen ones).
export function rosterBreakdown(parsed, threat, filters) {
  if (parsed.characters.length > MAX_BREAKDOWN_CHARACTERS) return null
  const units = breakdownUnits(parsed).filter((unit) => !filters.mustNot.includes(unit.place))
  const slugs = tacticSlugs(parsed)
  return squadCombinations(units, threat)
    .map((combo) => ({
      ...combo,
      affiliations: squadAffiliationKeys(parsed, combo.places).map((key) => ({
        key,
        leader: combo.places.some((place) =>
          (characterByCode(parsed.characters[place].code)?.leads ?? []).some(
            (lead) =>
              affiliationKey(lead.affiliation) === key && (!lead.tactic || slugs.has(lead.tactic)),
          ),
        ),
      })),
    }))
    .filter((combo) => matchesFilters(combo, filters))
}

// The message for the codes of a roster text that the app does not know, for example
// "2 unknown codes: 01234567, 07654321". The first 5 codes show.
export function unknownCodesMessage(unknown) {
  const n = unknown.length
  const shown = unknown.slice(0, 5).join(', ') + (n > 5 ? ', …' : '')
  return `${n === 1 ? '1 unknown code' : `${n} unknown codes`}: ${shown}`
}

// The cards of a parsed roster that the app has no files for, as names in roster order, each name once:
// { models: characters without a 3D model, tactics: Team Tactic cards without an image }. On the table
// and in the roster popup they show as plates, and a character without a model cannot be spawned.
// For the warning in the new room dialog. parsed holds only known codes, so each code has a card.
export function missingFiles(parsed) {
  const names = (infos) => [...new Set(infos.map((info) => info.name))]
  return {
    models: names(parsed.characters.map((ch) => cards.get(ch.code)).filter((info) => !info.model)),
    tactics: names(parsed.tactics.map((code) => cards.get(code)).filter((info) => !info.image)),
  }
}

// Background of a card without an image, on the table (RosterCards.jsx) and in the roster popup
export const PLATE_COLORS = {
  character: '#3a4658',
  tactic: '#4a3f5c',
  secure: '#3d5a4a',
  extract: '#5c4a3d',
}

// The tabs of the roster popup (RosterPopup.jsx), in order, and the tab of each card kind
export const ROSTER_TABS = [
  { key: 'characters', label: 'Characters' },
  { key: 'tactics', label: 'Tactic cards' },
  { key: 'crisis', label: 'Crisis cards' },
]
export const TAB_OF_KIND = {
  character: 'characters',
  tactic: 'tactics',
  secure: 'crisis',
  extract: 'crisis',
}

// The cards of each popup tab: { characters, tactics, crisis } → [{ code, kind, gems }]. The order is the
// order of rosterLayout (layout.js), so the n-th card of a kind on the table is the n-th card of its tab.
export function rosterTabs(parsed) {
  const cards = (codes, kind) => codes.map((code) => ({ code, kind, gems: [] }))
  return {
    characters: parsed.characters.map((ch) => ({
      code: ch.code,
      kind: 'character',
      gems: ch.gems,
    })),
    tactics: cards(parsed.tactics, 'tactic'),
    crisis: [...cards(parsed.secure, 'secure'), ...cards(parsed.extract, 'extract')],
  }
}
