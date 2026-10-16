import { SYMBOLS, SYMBOL_NAMES } from '../dice/faces.js'
import { entryText } from '../dice/history.js'
import { assetUrl } from '../assets/index.js'
import { useSideColor } from '../table/useSideColors.jsx'
import { entrySide, logText, mergeLog } from './log.js'
import { useNames } from '../setup/useNames.js'

function Icon({ symbol }) {
  return (
    <img
      src={assetUrl(`dice/icons/${symbol}.webp`)}
      alt={SYMBOL_NAMES[symbol]}
      className="log-icon"
    />
  )
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

// The Log HUD panel at the top of the right column (docs/features/game-log.md). It shows the dice
// history `rolls` and the game `log`, both oldest first as stored, merged by time with the newest first.
// Collapsed, it is one bar with the newest entry. A click on the bar expands it. mySide, seatPlayers: for
// the names of the entries (setup/useNames.js).
export function LogPanel({ open, onOpen, onClose, rolls, log, mySide, seatPlayers }) {
  const ctx = useNames(mySide, seatPlayers)
  const items = mergeLog(rolls, log)
  if (!open) {
    const newest = items[0]
    const text = !newest
      ? 'No entries yet'
      : newest.type === 'dice'
        ? entryText(newest.entry)
        : logText(newest.entry, ctx)
    return (
      <button type="button" className="log log-bar" title="Open the log" onClick={onOpen}>
        <span className="log-label">Log</span>
        <span className="log-bar-text">{text}</span>
      </button>
    )
  }
  return (
    <div className="log">
      <div className="log-head">
        <span className="log-title">Log</span>
        <button type="button" className="chip" title="Collapse the log (Esc)" onClick={onClose}>
          Collapse
        </button>
      </div>
      {items.length === 0 && <div className="log-message">No entries yet</div>}
      <div className="log-list">
        {items.map((item) => (
          <Entry key={`${item.type}:${item.entry.id}`} item={item} ctx={ctx} />
        ))}
      </div>
    </div>
  )
}
