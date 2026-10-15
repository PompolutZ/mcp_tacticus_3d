import { useEffect, useState } from 'react'
import { assetUrl } from '../assets/index.js'
import { PLATE_COLORS, rosterCard } from '../rosters/cards.js'
import { CARD_SIZES } from '../rosters/layout.js'
import { CRISIS_TYPES, otherTeam, priorityOf, setupStep } from '../setup/setup.js'
import { TYPE, deckButton } from '../setup/deckButton.js'
import { playerName } from '../setup/names.js'
import { useSideColors } from '../sideColors.js'
import { Carousel } from '../ui/Carousel.jsx'
import { Dialog } from '../ui/Dialog.jsx'

// The crisis compare overlay of the game setup, in the roll off, deck, first and second steps (docs/features/
// setup-game.md, "Crisis cards"). Two tabs, Compare Secures and Compare Extracts. Each tab shows my cards of
// that type in a carousel in the top half and the opponent's cards in the bottom half, each half with the
// player name. In the Sandbox and a single player room (no mySide) the side of the clicked card is on top.
// In the deck step, the button under the tabs is the deck button of the table ("Choose Secures" / "Choose
// Extracts"): same action, same locks and titles (setup/deckButton.js). A click closes the overlay.
// The popup frame, close button and backdrop are those of Dialog.jsx. The parent (App.jsx) owns the open
// state.
// open: { team, type, code }, the clicked card (only its team and type are used). setup: the viewed
// setup. parsed: { host, guest } → parsed roster | null. ctx: names (setup/useNames.js). stepRef: the overlay
// puts a function there that moves the top carousel (the arrow keys). onChoose(type): setupActions.deck.
export function CrisisCompare({ open, setup, parsed, ctx, mySide, stepRef, onChoose, onClose }) {
  const colors = useSideColors()
  const [tab, setTab] = useState(open.type)
  // The shown card of each carousel: { 'host-secure': 3, ... }. Missing: the middle card, so 5 cards all show.
  const [indices, setIndices] = useState({})
  const top = mySide ?? open.team
  const sides = [top, otherTeam(top)]
  const deck = setupStep(setup) === 'deck'
  // The deck buttons belong to the Priority player: deck of `type` is played on their own cards
  const priority = priorityOf(setup)

  const topKey = `${top}-${tab}`
  const topCount = parsed[top]?.[tab].length ?? 0
  useEffect(() => {
    stepRef.current = (step) => {
      if (topCount < 2) return
      setIndices((prev) => ({
        ...prev,
        [topKey]: ((prev[topKey] ?? Math.floor(topCount / 2)) + step + topCount) % topCount,
      }))
    }
    return () => {
      stepRef.current = null
    }
  }, [stepRef, topKey, topCount])

  const button =
    deck && priority && parsed[priority] ? deckButton(setup, priority, tab, parsed, ctx) : null

  return (
    <Dialog
      backdropClassName="card-popup roster-popup-backdrop"
      className="roster-popup crisis-compare"
      label="Compare crisis cards"
      onClose={onClose}
    >
      <div className="roster-popup-tabs" role="tablist">
        {CRISIS_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            role="tab"
            aria-selected={type === tab}
            className={type === tab ? 'chip chip--active' : 'chip'}
            onClick={() => setTab(type)}
          >
            Compare {TYPE[type]}s
          </button>
        ))}
      </div>
      {button && (
        <button
          type="button"
          className="chip chip--primary"
          disabled={button.disabled}
          aria-disabled={button.locked !== null}
          title={button.title}
          onClick={
            button.locked === null
              ? () => {
                  onChoose(tab)
                  onClose()
                }
              : undefined
          }
        >
          Choose {TYPE[tab]}s
        </button>
      )}
      {sides.map((team) => {
        const codes = parsed[team]?.[tab] ?? []
        const key = `${team}-${tab}`
        return (
          <section key={team} className="crisis-compare-half">
            <h2 className={`roster-popup-title roster-popup-title--${colors[team]}`}>
              {playerName(team, ctx)}
            </h2>
            {codes.length === 0 ? (
              <p className="crisis-compare-empty">No {TYPE[tab]} cards</p>
            ) : (
              <Carousel
                key={key}
                count={codes.length}
                index={Math.min(indices[key] ?? Math.floor(codes.length / 2), codes.length - 1)}
                onIndexChange={(index) =>
                  setIndices((prev) => (prev[key] === index ? prev : { ...prev, [key]: index }))
                }
                itemName={TYPE[tab]}
                style={{
                  '--card-ratio': CARD_SIZES[tab][0] / CARD_SIZES[tab][1],
                  '--card-w': 'calc(var(--card-h) * var(--card-ratio))',
                }}
                renderSlide={(i) => <CrisisFace code={codes[i]} kind={tab} />}
              />
            )}
          </section>
        )
      })}
    </Dialog>
  )
}

// One crisis card at popup size, the image of the roster crisis tab (RosterPopup.jsx). A card without an
// image is a plate with the name and the MCT code.
export function CrisisFace({ code, kind }) {
  const info = rosterCard(code)
  const [w, h] = CARD_SIZES[kind]
  const size = { width: 'var(--card-w)', aspectRatio: `${w} / ${h}` }
  if (info?.image)
    return (
      <img
        className="carousel-card roster-popup-card"
        style={size}
        src={assetUrl(info.image)}
        alt={info.name}
        draggable={false}
      />
    )
  return (
    <div
      className="carousel-card roster-popup-card roster-popup-plate"
      style={{ ...size, background: PLATE_COLORS[kind] }}
    >
      <span className="roster-popup-plate-name">{info?.name ?? code}</span>
      <span className="roster-popup-plate-code">{code}</span>
    </div>
  )
}
