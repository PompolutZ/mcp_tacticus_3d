import { CARD_SIZES } from '../rosters/layout.js'
import { rosterCard } from '../rosters/cards.js'
import { chooserOf, crisisRows } from '../setup/setup.js'
import { TYPE, pickButton } from '../setup/deckButton.js'
import { isYou, playerName, possessive } from '../setup/names.js'
import { ChooseFrame } from './ChooseFrame.jsx'
import { CrisisFace } from './CrisisCompare.jsx'

// The Choose 1 overlay of the game setup, in the first and second step (docs/features/setup-game.md, "Crisis
// cards"): the 2 drawn cards side by side, large, each with a "Choose this card!" button. A comic frame like
// the roster popup (rosters/roster.css), styled further by crisis.css; the header is blue for secures and
// red for extracts. The button is the Choose chip of the table: same action (onPick = setupActions.pick),
// same lock and title (setup/deckButton.js, pickButton). The other player sees the cards and a note, no
// button. In the second step the first chosen card shows to the left, small, with a caption and no button,
// set apart from the 2 choices (the overlay opens by itself, so the player cannot see the first pick
// otherwise). A pick closes the overlay. The parent (App.jsx) owns the open state. setup: the real setup.
// parsed: { host, guest } → parsed roster | null.
export function CrisisChoose({ setup, parsed, ctx, onPick, onClose }) {
  const rows = crisisRows(setup, parsed)
  const row = rows.find((r) => r.use)
  if (!row) return null
  const chosen = rows.find((r) => r.drawn && !r.use)
  const noun = `${TYPE[row.type].toLowerCase()}s`
  const owner = isYou(row.team, ctx) ? 'your' : possessive(row.team, ctx)
  const title = `Choose 1 of ${owner} ${noun}!`
  // The buttons belong to the chooser. In a multiplayer room, the other player has none.
  const chooser = chooserOf(setup)
  const active = !ctx.mySide || ctx.mySide === chooser
  const [w, h] = CARD_SIZES[row.type]
  const [cw, ch] = chosen ? CARD_SIZES[chosen.type] : [0, 1]
  return (
    <ChooseFrame
      className={chosen ? 'crisis-choose--chosen' : ''}
      style={{ '--card-ratio': w / h, '--chosen-ratio': cw / ch }}
      tone={row.type === 'secure' ? 'blue' : 'red'}
      tag={`${playerName(row.team, ctx)} · ${noun} · pick one`}
      title={title}
      onClose={onClose}
    >
      <div className="roster-comic-stage crisis-choose-stage">
        <div className="crisis-choose-row">
          {chosen && (
            <figure className="crisis-choose-chosen">
              <div
                style={{
                  '--card-w': 'calc(var(--card-h) * var(--chosen-scale) * var(--chosen-ratio))',
                }}
              >
                <CrisisFace code={chosen.codes[0]} kind={chosen.type} />
              </div>
              <figcaption>Chosen {TYPE[chosen.type].toLowerCase()}</figcaption>
            </figure>
          )}
          <div
            className="crisis-choose-cards"
            style={{ '--card-w': 'calc(var(--card-h) * var(--card-ratio))' }}
          >
            {row.codes.map((code) => {
              const { locked, title: buttonTitle } = pickButton(
                setup,
                rosterCard(code)?.name ?? code,
                ctx,
              )
              return (
                <div key={code} className="crisis-choose-card">
                  <CrisisFace code={code} kind={row.type} />
                  {active && (
                    <button
                      type="button"
                      className="comic-go"
                      aria-disabled={locked !== null}
                      title={buttonTitle}
                      onClick={
                        locked === null
                          ? () => {
                              onPick(code)
                              onClose()
                            }
                          : undefined
                      }
                    >
                      Choose this card!
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
        {!active && (
          <p className="crisis-choose-note">
            Waiting for {playerName(chooser, ctx)} to choose a card.
          </p>
        )}
      </div>
    </ChooseFrame>
  )
}
