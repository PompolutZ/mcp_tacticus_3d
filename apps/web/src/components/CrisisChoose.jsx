import { useRef } from 'react'
import { CARD_SIZES } from '../rosters/layout.js'
import { rosterCard } from '../rosters/cards.js'
import { chooserOf, crisisRows } from '../setup/setup.js'
import { TYPE, pickButton } from '../setup/deckButton.js'
import { isYou, playerName, possessive } from '../setup/names.js'
import { Overlay } from './Overlay.jsx'
import { CrisisFace } from './CrisisCompare.jsx'

// The Choose 1 overlay of the game setup, in the first and second step (docs/features/setup-game.md, "Crisis
// cards"): the 2 drawn cards side by side, large, each with a "Choose this card" button. The button is the
// Choose chip of the table: same action (onPick = setupActions.pick), same lock and title (setup/deckButton.js,
// pickButton). The other player and a browsed step see the cards without the button. A pick closes the overlay.
// The popup frame, close button and backdrop are those of CrisisCompare.jsx. The parent (App.jsx) owns the open
// state and the Esc key. setup: the real setup. parsed: { host, guest } → parsed roster | null.
export function CrisisChoose({ setup, parsed, ctx, onPick, onClose }) {
  const pressedBackdrop = useRef(false)
  const row = crisisRows(setup, parsed).find((r) => r.use)
  if (!row) return null
  const owner = isYou(row.team, ctx) ? 'your' : possessive(row.team, ctx)
  // The buttons belong to the chooser. In a multiplayer room, the other player has none.
  const chooser = chooserOf(setup)
  const active = !ctx.mySide || ctx.mySide === chooser
  const [w, h] = CARD_SIZES[row.type]
  return (
    <Overlay
      className="card-popup roster-popup-backdrop"
      onPointerDown={(e) => {
        pressedBackdrop.current = e.target === e.currentTarget
      }}
      onClick={(e) => {
        if (pressedBackdrop.current && e.target === e.currentTarget) onClose()
      }}
    >
      <button type="button" className="popup-close" aria-label="Close" onClick={onClose}>
        ×
      </button>
      <div
        className="roster-popup crisis-choose"
        role="dialog"
        aria-modal="true"
        aria-label={`Choose 1 of ${owner} ${TYPE[row.type]}s`}
      >
        <h2 className="roster-popup-title crisis-choose-title">
          Choose 1 of {owner} {TYPE[row.type]}s
        </h2>
        <div
          className="crisis-choose-cards"
          style={{ '--card-w': `calc(var(--card-h) * ${w / h})` }}
        >
          {row.codes.map((code) => {
            const { locked, title } = pickButton(setup, rosterCard(code)?.name ?? code, ctx)
            return (
              <div key={code} className="crisis-choose-card">
                <CrisisFace code={code} kind={row.type} />
                {active && (
                  <button
                    type="button"
                    className="chip chip--primary"
                    aria-disabled={locked !== null}
                    title={title}
                    onClick={
                      locked === null
                        ? () => {
                            onPick(code)
                            onClose()
                          }
                        : undefined
                    }
                  >
                    Choose this card
                  </button>
                )}
              </div>
            )
          })}
        </div>
        {!active && (
          <p className="crisis-compare-empty">
            Waiting for {playerName(chooser, ctx)} to choose a card.
          </p>
        )}
      </div>
    </Overlay>
  )
}
