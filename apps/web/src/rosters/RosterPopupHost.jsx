import { RosterPopup } from './RosterPopup.jsx'
import { ROSTER_TABS, rosterTabs } from './cards.js'
import { COLOR_NAME } from '../sideColors.js'
import { useSideColors } from '../table/useSideColors.jsx'

// The roster popup of the table (RosterPopup.jsx). It renders the popup only while openRoster is set.
// openRoster, setOpenRoster: the open card { team, tab, index } | null, see App.jsx. breakdownFor: from
// useBreakdownChoice, which keeps the Breakdown state (docs/features/squad-breakdown.md, "State"). The other
// props are the state and handlers of App that the Add to squad button uses.
export function RosterPopupHost({
  openRoster,
  setOpenRoster,
  rosters,
  setup,
  parsedRosters,
  breakdownFor,
  squadBlock,
  hiddenSquads,
  ownSquad,
  handleSquadToggle,
}) {
  const sideColors = useSideColors()
  // The Breakdown tab of the open roster popup, only while the squad of that roster is not placed, and in a
  // multiplayer room (hiddenSquads set) only on the own roster (docs/features/squad-breakdown.md). Without it, a popup left on that tab shows the first tab with cards.
  let popupSquad = null
  let rosterPopupTab = openRoster?.tab
  const popupBreakdown =
    openRoster && rosters[openRoster.team] ? breakdownFor(openRoster.team) : null
  if (openRoster && rosters[openRoster.team]) {
    const { team } = openRoster
    if (popupBreakdown) {
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
