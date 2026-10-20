import { useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_FILTERS, filtersWithSquad } from './breakdown.js'
import { CRISIS_THREATS, rosterCard } from './cards.js'
import { placedSides, possibleThreats } from '../setup/setup.js'

// The Breakdown state of both rosters, and the `breakdown` prop of BreakdownTab. Call it once, in App, so
// every consumer shares the state: the selected threat value and the filters stay after a popup closes
// (docs/features/squad-breakdown.md, "State"). Not saved.
// Inputs: the state and handlers of App. squadBlock(team): why a click does not choose a squad, or null.
// handleBreakdownChoose(team, places): a click on a row.
// Returns { breakdownFor }. breakdownFor(team): the prop object of BreakdownTab, or null while the tab is not
// shown for that team: its roster is missing, its squad is placed, or (multiplayer room, hiddenSquads set)
// it is not the own roster.
export function useBreakdownChoice({
  setup,
  rosters,
  parsedRosters,
  hiddenSquads,
  mySide,
  ownSquad,
  squadBlock,
  handleBreakdownChoose,
}) {
  // { host, guest } → { code, threat, filters } | null. code: the roster code it belongs to; null means the
  // first value.
  const [breakdownChoice, setBreakdownChoice] = useState({ host: null, guest: null })
  // Must have follows the squad on the table (docs/features/squad-breakdown.md, "Filters"). The squad
  // characters this browser may see; the hidden squad of the other roster gives none.
  const visibleSquad = (team) =>
    hiddenSquads && team !== mySide ? [] : (hiddenSquads ? ownSquad : setup.squads[team]).characters
  const squadKeys = {
    host: visibleSquad('host').join(','),
    guest: visibleSquad('guest').join(','),
  }
  const codes = { host: rosters.host?.code ?? null, guest: rosters.guest?.code ?? null }
  // The last { code, key } synced per team
  const synced = useRef({ host: null, guest: null })
  useEffect(() => {
    for (const team of ['host', 'guest']) {
      const code = codes[team]
      const key = squadKeys[team]
      const last = synced.current[team]
      if (code === null) {
        synced.current[team] = null
        continue
      }
      const newRoster = last?.code !== code
      if (!newRoster && last.key === key) continue
      synced.current[team] = { code, key }
      // A new roster with no squad keeps the start filters
      if (newRoster && key === '') continue
      const places = key === '' ? [] : key.split(',').map(Number)
      setBreakdownChoice((prev) => {
        const old = prev[team]?.code === code ? prev[team] : null
        return {
          ...prev,
          [team]: {
            code,
            threat: old?.threat ?? null,
            filters: filtersWithSquad(old?.filters ?? DEFAULT_FILTERS, places),
          },
        }
      })
    }
  }, [codes.host, codes.guest, squadKeys.host, squadKeys.guest]) // eslint-disable-line react-hooks/exhaustive-deps
  // The threat values that the game can still have, or all crisis threats when the rosters have none
  const breakdownThreats = useMemo(() => {
    const threats = possibleThreats(setup, parsedRosters, (code) => rosterCard(code)?.threat)
    return threats.length > 0 ? threats : CRISIS_THREATS
  }, [setup, parsedRosters])

  function breakdownFor(team) {
    if (!rosters[team]) return null
    if (placedSides(setup)[team] || (hiddenSquads && team !== mySide)) return null
    // A choice of another roster code counts as no choice. A threat that left the list shows the first
    // value; the filters stay (docs/features/squad-breakdown.md, "State").
    const stored = breakdownChoice[team]
    const choice = stored && stored.code === rosters[team].code ? stored : null
    const store = (change) =>
      setBreakdownChoice((prev) => {
        const prevChoice = prev[team]?.code === rosters[team].code ? prev[team] : null
        return {
          ...prev,
          [team]: {
            code: rosters[team].code,
            threat: prevChoice?.threat ?? breakdownThreats[0],
            filters: prevChoice?.filters ?? DEFAULT_FILTERS,
            ...change,
          },
        }
      })
    return {
      threats: breakdownThreats,
      threat:
        choice && breakdownThreats.includes(choice.threat) ? choice.threat : breakdownThreats[0],
      filters: choice?.filters ?? DEFAULT_FILTERS,
      onThreatChange: (threat) => store({ threat }),
      onFiltersChange: (filters) => store({ filters }),
      // Whether a click chooses a squad, the reason when not, and the squad characters this browser may show
      chooseBlock: squadBlock(team),
      squadCharacters: visibleSquad(team),
      onChoose: (places) => handleBreakdownChoose(team, places),
    }
  }

  return { breakdownFor }
}
