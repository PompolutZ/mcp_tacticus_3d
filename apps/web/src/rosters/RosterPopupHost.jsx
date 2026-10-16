import { useMemo, useState } from 'react'
import { RosterPopup } from './RosterPopup.jsx'
import { DEFAULT_FILTERS } from './breakdown.js'
import { CRISIS_THREATS, ROSTER_TABS, rosterCard, rosterTabs } from './cards.js'
import { COLOR_NAME } from '../sideColors.js'
import { useSideColors } from '../table/useSideColors.jsx'
import { placedSides, possibleThreats } from '../setup/setup.js'

// The roster popup of the table (RosterPopup.jsx) with the state that must outlive it. It is always
// mounted: the selected Breakdown threat and filters stay after the popup closes and opens again
// (docs/features/squad-breakdown.md, "State"). It renders the popup only while openRoster is set.
// openRoster, setOpenRoster: the open card { team, tab, index } | null, see App.jsx. The other props are the
// state and handlers of App that the Breakdown tab and the Add to squad button use.
export function RosterPopupHost({
  openRoster,
  setOpenRoster,
  rosters,
  setup,
  parsedRosters,
  squadBlock,
  hiddenSquads,
  mySide,
  ownSquad,
  handleBreakdownChoose,
  handleSquadToggle,
}) {
  const sideColors = useSideColors()
  // The selected threat value of the Breakdown tab of each roster: { host, guest } → { code, threat, filters } |
  // null. code: the roster code it belongs to; null means the first value. Not saved. See
  // docs/features/squad-breakdown.md, "State".
  const [breakdownChoice, setBreakdownChoice] = useState({ host: null, guest: null })
  // The threat values that the game can still have, or all crisis threats when the rosters have none
  const breakdownThreats = useMemo(() => {
    const threats = possibleThreats(setup, parsedRosters, (code) => rosterCard(code)?.threat)
    return threats.length > 0 ? threats : CRISIS_THREATS
  }, [setup, parsedRosters])

  // The Breakdown tab of the open roster popup, only while the squad of that roster is not placed
  // (docs/features/squad-breakdown.md). Without it, a popup left on that tab shows the first tab with cards.
  let popupBreakdown = null
  let popupSquad = null
  let rosterPopupTab = openRoster?.tab
  if (openRoster && rosters[openRoster.team]) {
    const { team } = openRoster
    if (!placedSides(setup)[team]) {
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
      popupBreakdown = {
        threats: breakdownThreats,
        threat:
          choice && breakdownThreats.includes(choice.threat) ? choice.threat : breakdownThreats[0],
        filters: choice?.filters ?? DEFAULT_FILTERS,
        onThreatChange: (threat) => store({ threat }),
        onFiltersChange: (filters) => store({ filters }),
        // Whether a click chooses a squad, the reason when not, and the squad characters this browser may show
        chooseBlock: squadBlock(team),
        squadCharacters:
          hiddenSquads && team !== mySide
            ? []
            : (hiddenSquads ? ownSquad : setup.squads[team]).characters,
        onChoose: (places) => handleBreakdownChoose(team, places),
      }
      // The Add to squad button of the card tabs. Not while the squad is blocked (Ready, other roster).
      if (!squadBlock(team)) {
        const current = hiddenSquads ? ownSquad : setup.squads[team]
        popupSquad = {
          has: (tab, index) => current[tab]?.includes(index) ?? false,
          onToggle: (tab, index) => handleSquadToggle(team, tab, index),
        }
      }
    } else if (rosterPopupTab === 'breakdown') {
      const cards = rosterTabs(parsedRosters[team])
      rosterPopupTab = ROSTER_TABS.find((t) => cards[t.key].length > 0)?.key ?? 'characters'
    }
  }

  if (!(openRoster && rosters[openRoster.team])) return null
  const color = sideColors[openRoster.team]
  return (
    <RosterPopup
      title={`${COLOR_NAME[color]} player roster`}
      color={color}
      code={rosters[openRoster.team].code}
      tab={rosterPopupTab}
      index={openRoster.index}
      breakdown={popupBreakdown}
      squad={popupSquad}
      onTabChange={(tab) => setOpenRoster((prev) => prev && { ...prev, tab, index: 0 })}
      onIndexChange={(index) =>
        setOpenRoster((prev) => (!prev || index === prev.index ? prev : { ...prev, index }))
      }
      onClose={() => setOpenRoster(null)}
    />
  )
}
