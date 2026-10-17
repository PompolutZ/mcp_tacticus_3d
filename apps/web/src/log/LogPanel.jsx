import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { SYMBOLS, SYMBOL_NAMES } from '../dice/faces.js'
import { entryText } from '../dice/history.js'
import { diceIconUrl } from '../tactics/faceIcons.js'
import { useSideColor } from '../table/useSideColors.jsx'
import { BUBBLE_ENTRIES, BUBBLE_SHOW_MS, freshItem, itemKey } from './bubble.js'
import { entrySide, logText, mergeLog } from './log.js'
import { useTableStore } from '../table/TableStoreContext.jsx'
import '../rooms/comicBase.js'
import './log.css'

// A dice symbol: its face icon (the one of the tactic cards), or the bold word for blank, which has no icon
function Icon({ symbol }) {
  const url = diceIconUrl(symbol)
  if (!url) return <b className="log-blank">{SYMBOL_NAMES[symbol]}</b>
  return <img src={url} alt={SYMBOL_NAMES[symbol]} className="log-icon" />
}

// Face icons with counts: { hit: 2, crit: 1 } is "2 [hit] 1 [crit]"
function Counts({ label, counts }) {
  return (
    <span className="log-part">
      <span className="log-label">{label}</span>
      {SYMBOLS.filter((symbol) => counts[symbol] > 0).map((symbol) => (
        <span key={symbol} className="log-count">
          <Icon symbol={symbol} />
          {counts[symbol]}
        </span>
      ))}
    </span>
  )
}

function time(at) {
  return new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// A dice entry (dice/history.js): the side color, the time and the face icons with counts
function DiceEntry({ entry }) {
  // entry.side is a side. The entry has the color of that side.
  const color = useSideColor(entry.side)
  let body
  if (entry.kind === 'clear') body = <span className="log-label">Cleared</span>
  else if (entry.kind === 'change') {
    body = (
      <span className="log-part">
        <span className="log-label">Changed</span>
        <Icon symbol={entry.from} />→<Icon symbol={entry.to} />
      </span>
    )
  } else {
    body = (
      <>
        {entry.roll && <Counts label="Roll" counts={entry.roll} />}
        {entry.crits && <Counts label="Crits" counts={entry.crits} />}
        {entry.reroll?.length > 0 && (
          <span className="log-part">
            <span className="log-label">Reroll</span>
            {entry.reroll.map(([from, to], i) => (
              <span key={i} className="log-count">
                <Icon symbol={from} />→<Icon symbol={to} />
              </span>
            ))}
          </span>
        )}
      </>
    )
  }
  return (
    <div
      className={`log-entry log-entry--${color}${entry.kind === 'clear' ? ' log-entry--clear' : ''}`}
      title={entryText(entry)}
    >
      <span className="log-time">{time(entry.at)}</span>
      {body}
    </div>
  )
}

// An entry of the `log` list: the text is made here, for the viewer (log/log.js)
function LogEntry({ entry, ctx }) {
  const color = useSideColor(entrySide(entry))
  const text = logText(entry, ctx)
  return (
    <div className={`log-entry${color ? ` log-entry--${color}` : ''}`} title={text}>
      <span className="log-time">{time(entry.at)}</span>
      <span>{text}</span>
    </div>
  )
}

function Entry({ item, ctx }) {
  return item.type === 'dice' ? (
    <DiceEntry entry={item.entry} />
  ) : (
    <LogEntry entry={item.entry} ctx={ctx} />
  )
}

// Puts the tail of the bubble under the Log button: the offset from the bubble's right edge to the middle of
// the button. The button is in the top right box (ui/Toolbar.jsx).
function useTail(ref, visible) {
  useLayoutEffect(() => {
    const bubble = ref.current
    if (!visible || !bubble) return undefined
    function place() {
      const button = document.querySelector('[data-hud-button="log"]')
      if (!button) return
      const b = button.getBoundingClientRect()
      const r = bubble.getBoundingClientRect()
      const half = 15
      bubble.style.setProperty(
        '--tail-right',
        `${Math.max(16, r.right - (b.left + b.width / 2) - half)}px`,
      )
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [ref, visible])
}

// The Log bubble under the Log button (docs/features/game-log.md, "Panel"). It shows the dice history `rolls`
// and the game `log`, both oldest first as stored, merged by time with the newest first.
// Closed: no bubble, until an entry is added. Then the bubble shows that entry for BUBBLE_SHOW_MS (log/bubble.js);
// a click opens the log. Open: the last BUBBLE_ENTRIES entries, newest first, scrolling. The names of the
// entries come from the store of the table (nameCtx).
export function LogPanel({ open, onOpen, onClose, rolls, log }) {
  const ctx = useTableStore((s) => s.nameCtx)
  const items = mergeLog(rolls, log)
  // The keys of the entries the bubble has seen (null before the first look), and the entry it flashes
  const known = useRef(null)
  const timer = useRef(null)
  const [flash, setFlash] = useState(null)
  useEffect(() => {
    const next = freshItem(mergeLog(rolls, log), known.current, Date.now())
    known.current = next.known
    if (!next.fresh) return
    setFlash(next.fresh) // eslint-disable-line react-hooks/set-state-in-effect
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setFlash(null), BUBBLE_SHOW_MS)
  }, [rolls, log])
  useEffect(() => () => clearTimeout(timer.current), [])

  const shown = open || flash !== null
  const ref = useRef(null)
  useTail(ref, shown)
  if (!shown) return null
  if (!open) {
    return (
      <div
        ref={ref}
        role="button"
        tabIndex={0}
        className="comic log-bubble log-bubble--flash"
        title="Open the log"
        aria-live="polite"
        onClick={onOpen}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onOpen()}
      >
        <span className="log-caption">Log</span>
        <Entry key={itemKey(flash)} item={flash} ctx={ctx} />
      </div>
    )
  }
  return (
    <div ref={ref} className="comic log-bubble log-bubble--open">
      <div className="log-head">
        <span className="log-caption">Log</span>
        <button
          type="button"
          className="comic-button comic-button--small"
          title="Collapse the log (Esc)"
          onClick={onClose}
        >
          Collapse
        </button>
      </div>
      {items.length === 0 && <div className="log-message">No entries yet</div>}
      <div className="log-list">
        {items.slice(0, BUBBLE_ENTRIES).map((item) => (
          <Entry key={itemKey(item)} item={item} ctx={ctx} />
        ))}
      </div>
    </div>
  )
}
