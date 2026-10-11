// The squads that a roster can build for a threat value, and the filters of the Breakdown tab. Plain module
// with no imports, so a Node test can check it. See docs/features/squad-breakdown.md.

// More characters than this: no breakdown, the same as on Jarvis
export const MAX_BREAKDOWN_CHARACTERS = 14

// Alter egos that the alter ego rule skips: the copies of Sentinel MK4 and of Prime Sentinel
export const SHARED_ALTER_EGOS = ['Sentinel MK4', 'Prime Sentinel']

// The filters of a roster when none is on. must, mustNot: roster places. affiliation: null, '*' (any) or a
// token key. dual: at least 2 affiliations. leader: only affiliations with a leader count. minSize, maxSize:
// number or null.
export const NO_FILTERS = {
  must: [],
  mustNot: [],
  affiliation: null,
  dual: false,
  leader: false,
  minSize: null,
  maxSize: null,
}

// The filters a roster starts with. Players nearly always play with a leader (user, playtest 1).
export const DEFAULT_FILTERS = { ...NO_FILTERS, leader: true }

// The combinations of `units` with a total threat of exactly `threat`: [{ places, threat }], places sorted,
// the list sorted by places. units: [{ place, name, threat, alterEgo, peerless }] in roster order. The 4
// rules are in docs/features/squad-breakdown.md, "Combinations".
export function squadCombinations(units, threat) {
  // The previous unit with the same name (the earlier copy), or null
  const earlier = units.map((unit, i) => {
    for (let j = i - 1; j >= 0; j--) if (units[j].name === unit.name) return j
    return null
  })
  // Can unit i join the chosen set `taken` (indexes) with total threat `total` (rules 1 to 3, and not over)?
  const fits = (i, taken, total) => {
    const unit = units[i]
    if (total + unit.threat > threat) return false
    if (earlier[i] !== null && !taken.includes(earlier[i])) return false
    const shared = unit.alterEgo === null || SHARED_ALTER_EGOS.includes(unit.alterEgo)
    for (const j of taken) {
      if (!shared && units[j].alterEgo === unit.alterEgo) return false
      if (unit.peerless && units[j].peerless) return false
    }
    return true
  }
  const result = []
  const walk = (i, taken, total) => {
    if (i === units.length) {
      // Rule 4: the total is exactly the threat value
      if (taken.length === 0 || total !== threat) return
      result.push({ places: taken.map((k) => units[k].place), threat: total })
      return
    }
    if (fits(i, taken, total)) walk(i + 1, [...taken, i], total + units[i].threat)
    walk(i + 1, taken, total)
  }
  walk(0, [], 0)
  return result.sort((a, b) => comparePlaces(a.places, b.places))
}

// Roster order of two sorted place lists
function comparePlaces(a, b) {
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] - b[i]
  return a.length - b.length
}

// Does the combination pass the filters? combination: { places, threat, affiliations: [{ key, leader }] }.
// mustNot is not checked: the caller removes those units before squadCombinations. See
// docs/features/squad-breakdown.md, "Filters".
export function matchesFilters(combination, filters) {
  const { places } = combination
  if (!filters.must.every((place) => places.includes(place))) return false
  if (filters.minSize !== null && places.length < filters.minSize) return false
  if (filters.maxSize !== null && places.length > filters.maxSize) return false
  const counted = filters.leader
    ? combination.affiliations.filter((a) => a.leader)
    : combination.affiliations
  if (filters.affiliation === '*' && counted.length < 1) return false
  if (
    filters.affiliation !== null &&
    filters.affiliation !== '*' &&
    !counted.some((a) => a.key === filters.affiliation)
  )
    return false
  if (filters.affiliation === null && filters.leader && counted.length < 1) return false
  if (filters.dual && counted.length < 2) return false
  return true
}
