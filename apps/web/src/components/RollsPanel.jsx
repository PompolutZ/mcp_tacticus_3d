import { SYMBOLS, SYMBOL_NAMES } from '../dice/faces.js'
import { entryText } from '../dice/history.js'
import { assetUrl } from '../assets/index.js'
import { useSideColor } from '../sideColors.js'

function Icon({ symbol }) {
  return (
    <img
      src={assetUrl(`dice/icons/${symbol}.webp`)}
      alt={SYMBOL_NAMES[symbol]}
      className="rolls-icon"
    />
  )
}

// Face icons with counts: { hit: 2, crit: 1 } is "2 [hit] 1 [crit]"
function Counts({ label, counts }) {
  return (
    <span className="rolls-part">
      <span className="rolls-label">{label}</span>
      {SYMBOLS.filter((symbol) => counts[symbol] > 0).map((symbol) => (
        <span key={symbol} className="rolls-count">
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

function Entry({ entry }) {
  // entry.side is a side. The entry has the color of that side.
  const color = useSideColor(entry.side)
  let body
  if (entry.kind === 'clear') body = <span className="rolls-label">Cleared</span>
  else if (entry.kind === 'change') {
    body = (
      <span className="rolls-part">
        <span className="rolls-label">Changed</span>
        <Icon symbol={entry.from} />→<Icon symbol={entry.to} />
      </span>
    )
  } else {
    body = (
      <>
        {entry.roll && <Counts label="Roll" counts={entry.roll} />}
        {entry.crits && <Counts label="Crits" counts={entry.crits} />}
        {entry.reroll?.length > 0 && (
          <span className="rolls-part">
            <span className="rolls-label">Reroll</span>
            {entry.reroll.map(([from, to], i) => (
              <span key={i} className="rolls-count">
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
      className={`rolls-entry rolls-entry--${color}${entry.kind === 'clear' ? ' rolls-entry--clear' : ''}`}
      title={entryText(entry)}
    >
      <span className="rolls-time">{time(entry.at)}</span>
      {body}
    </div>
  )
}

// The roll history HUD panel, opened from a toolbar button. rolls: the entries of the document, oldest
// first (dice/history.js); the newest shows first. See docs/features/dice-rolling.md, "History".
export function RollsPanel({ open, rolls }) {
  if (!open) return null
  return (
    <div className="rolls">
      {rolls.length === 0 && <div className="rolls-message">No rolls yet</div>}
      <div className="rolls-list">
        {rolls
          .slice()
          .reverse()
          .map((entry) => (
            <Entry key={entry.id} entry={entry} />
          ))}
      </div>
    </div>
  )
}
