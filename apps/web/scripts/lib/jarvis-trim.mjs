// Trims the raw Jarvis rows to the fields the app reads. Used by trim-jarvis.mjs and by the fetch-jarvis-*
// scripts. The derived fields (immune, dropPlacer, ...) are computed here, so the app does not ship the
// stat card text. See scripts/README.md, "Trimmed Jarvis files".

import { dropPlacer } from '../../src/characters/dropPlacer.js'
import { sharedImmunities } from '../../src/characters/immunity.js'
import { sharedPowerBonus } from '../../src/characters/power.js'
import { cardSizes } from '../../src/characters/size.js'

// Jarvis stores stamina as a string; "?" (Multiple Man) and a missing side give 0.
const stamina = (side) => Number(side?.stamina) || 0

export function trimCharacters(rows) {
  return rows.map((jch) => ({
    slug: jch.slug,
    name: jch.name,
    exportCode: jch.exportCode ?? null,
    isAlternateSculpt: Boolean(jch.isAlternateSculpt),
    isGrunt: Boolean(jch.isGrunt),
    baseSize: jch.baseSize ?? null,
    threatLevel: jch.threatLevel ?? null,
    affiliations: (jch.affiliations ?? []).map((a) => ({
      slug: a.slug,
      isLeader: Boolean(a.isLeader),
      isLeaderWithTeamTactics: a.isLeaderWithTeamTactics || null,
    })),
    alterEgo: jch.alterEgo ?? null,
    peerless: (jch.tags ?? []).includes('peerless'),
    rogue: (jch.tags ?? []).includes('rogueAgent'),
    secondFormSlug: jch.secondFormSlug || null,
    bearableGemsWithName: (jch.bearableGemsWithName ?? []).map((g) => ({
      exportCode: g.exportCode ?? null,
      threatLevel: g.threatLevel ?? null,
    })),
    staminaHealthy: stamina(jch.statCard?.frontSide),
    staminaInjured: stamina(jch.statCard?.backSide),
    sizes: cardSizes(jch.statCard),
    immune: sharedImmunities(jch),
    dropPlacer: {
      healthy: dropPlacer({ side: 'healthy' }, jch),
      injured: dropPlacer({ side: 'injured' }, jch),
    },
    powerBonus: sharedPowerBonus(jch),
  }))
}

// Every row stays: the app reads all rows that have a code.
export function trimTactics(rows) {
  return rows.map((row) => ({
    exportCode: row.exportCode ?? null,
    slug: row.slug,
    name: row.name,
    isInfinityGem: Boolean(row.isInfinityGem),
  }))
}

// Only the current printings. They keep replacedBy: null, so the checks of the app stay true.
export function trimCrisis(rows) {
  return rows
    .filter((row) => row.replacedBy === null)
    .map((row) => ({
      exportCode: row.exportCode ?? null,
      slug: row.slug,
      name: row.name,
      type: row.type,
      threatLevel: row.threatLevel ?? null,
      replacedBy: null,
    }))
}
