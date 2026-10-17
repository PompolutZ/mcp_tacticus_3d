import { useEffect, useMemo, useState } from 'react'
import { ROSTER_TABS, parseRosterText, rosterTabs } from './cards.js'
import { CARD_STEP_KEYS } from '../keyboard.js'
import { RosterPopup } from './RosterPopup.jsx'

// The roster popup of the table (RosterPopup.jsx) for a roster of a room. It opens on the first tab with
// cards. On the table, App owns the tab and the card, because App handles all keys there. The
// lobby has no key handler, so this component owns them: the left and right
// arrows show the previous or next card. The tab is a loop, the same as on the table.
// title, color, roomCode, seat: for RosterPopup. code: the stored MCT code of the roster.
export function RoomRosterPopup({ title, color, roomCode, seat, code, onClose }) {
  const tabs = useMemo(() => rosterTabs(parseRosterText(code)), [code])
  const [tab, setTab] = useState(() => ROSTER_TABS.find((t) => tabs[t.key].length > 0).key)
  const [index, setIndex] = useState(0)
  const count = tabs[tab].length

  useEffect(() => {
    function handleKeyDown(e) {
      if (CARD_STEP_KEYS[e.code]) setIndex((i) => (i + CARD_STEP_KEYS[e.code] + count) % count)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [count])

  return (
    <RosterPopup
      title={title}
      color={color}
      roomCode={roomCode}
      seat={seat}
      code={code}
      tab={tab}
      index={index}
      onTabChange={(next) => {
        setTab(next)
        setIndex(0)
      }}
      onIndexChange={setIndex}
      onClose={onClose}
    />
  )
}
