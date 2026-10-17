import { useEffect, useState } from 'react'
import { assetUrl } from '../assets/index.js'
import { PLATE_COLORS, rosterCard } from '../rosters/cards.js'
import { CARD_SIZES } from '../rosters/layout.js'
import { CRISIS_TYPES, otherTeam, priorityOf, setupStep } from '../setup/setup.js'
import { TYPE, deckButton } from '../setup/deckButton.js'
import { playerName } from '../setup/names.js'
import { useSideColors } from '../table/useSideColors.jsx'
import { Carousel } from '../ui/Carousel.jsx'
import { Dialog } from '../ui/Dialog.jsx'
import '../rooms/comicBase.js'
import '../rosters/roster.css'
import './crisis.css'

// The crisis compare overlay of the game setup, in the roll off, deck, first and second steps (docs/features/
// setup-game.md, "Crisis cards"). A comic frame like the roster popup (rosters/roster.css: header, folder
// tabs, rays stage, fan carousel, card switch), styled further by crisis.css. Two tabs, Secures and Extracts;
// the header is blue on Secures and red on Extracts. Each tab shows my cards of that type in a fan carousel in
// the top lane and the opponent's cards in the bottom lane, each lane with a plate with the player name. In
// the Sandbox and a single player room (no mySide) the side of the clicked card is on top. In the deck step,
// the button in the header is the deck button of the table ("Choose my secures!" / "Choose my extracts!"):
// same action, same locks and titles (setup/deckButton.js). A click closes the overlay.
// The parent (App.jsx) owns the open state.
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
  const noun = TYPE[tab].toLowerCase()
  const otherName = playerName(sides[1], ctx)

  return (
    <Dialog
      backdropClassName="card-popup roster-popup-backdrop"
      className="comic roster-comic crisis-compare"
      closeClassName="roster-comic-close"
      label="Compare crisis cards"
      onClose={onClose}
    >
      <header
        className={`roster-comic-head crisis-compare-head roster-comic-head--${tab === 'secure' ? 'blue' : 'red'}`}
      >
        <div className="roster-comic-heading">
          <div className="roster-comic-tag">
            {mySide ? 'You' : playerName(top, ctx)} vs {otherName}
          </div>
          <h2 className="roster-comic-title">Compare {noun}s</h2>
        </div>
        {button && (
          <button
            type="button"
            className="crisis-cta"
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
            Choose my {noun}s!
          </button>
        )}
        <div
          className="roster-comic-tabs crisis-compare-tabs"
          role="tablist"
          aria-label="Crisis type"
        >
          {CRISIS_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              role="tab"
              aria-selected={type === tab}
              className="roster-comic-tab"
              onClick={() => setTab(type)}
            >
              {TYPE[type]}s
            </button>
          ))}
        </div>
      </header>
      <div className="roster-comic-stage crisis-compare-stage">
        {sides.map((team) => {
          const codes = parsed[team]?.[tab] ?? []
          const key = `${team}-${tab}`
          const name = playerName(team, ctx)
          const plate = (
            <span className="crisis-plate">
              <span
                className={`crisis-plate-icon crisis-plate-icon--${colors[team]}`}
                aria-hidden="true"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                >
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
                </svg>
              </span>
              {name}
            </span>
          )
          return (
            <section key={team} className="crisis-compare-lane" aria-label={name}>
              {codes.length === 0 ? (
                <div className="crisis-compare-foot">
                  <p className="crisis-compare-empty">No {noun} cards</p>
                  {plate}
                </div>
              ) : (
                <Carousel
                  fan
                  key={key}
                  count={codes.length}
                  index={Math.min(indices[key] ?? Math.floor(codes.length / 2), codes.length - 1)}
                  onIndexChange={(index) =>
                    setIndices((prev) => (prev[key] === index ? prev : { ...prev, [key]: index }))
                  }
                  itemName={TYPE[tab]}
                  style={{
                    '--card-w': `calc(var(--card-h) * ${CARD_SIZES[tab][0] / CARD_SIZES[tab][1]})`,
                  }}
                  renderSlide={(i) => <CrisisFace code={codes[i]} kind={tab} comic />}
                  renderNav={({ index, count, prev, next }) => (
                    <div className="crisis-compare-foot">
                      {plate}
                      <div className="roster-comic-nav">
                        <button
                          type="button"
                          className="roster-comic-square pop"
                          aria-label={`Previous ${noun}`}
                          disabled={count < 2}
                          onClick={prev}
                        >
                          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M15 5l-7 7 7 7" />
                          </svg>
                        </button>
                        <div className="roster-comic-count" aria-live="polite">
                          {TYPE[tab]} {index + 1} of {count}
                        </div>
                        <button
                          type="button"
                          className="roster-comic-square pop"
                          aria-label={`Next ${noun}`}
                          disabled={count < 2}
                          onClick={next}
                        >
                          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}
                />
              )}
            </section>
          )
        })}
      </div>
    </Dialog>
  )
}

// One crisis card at popup size, the image of the roster crisis tab (RosterPopup.jsx). A card without an
// image is a plate with the name and the MCT code. comic: the comic card of the roster popup
// (rosters/roster.css), else the old card of CrisisChoose.
export function CrisisFace({ code, kind, comic = false }) {
  const info = rosterCard(code)
  const [w, h] = CARD_SIZES[kind]
  const size = { width: 'var(--card-w)', aspectRatio: `${w} / ${h}` }
  const p = comic ? 'roster-comic' : 'roster-popup'
  if (info?.image)
    return (
      <img
        className={`carousel-card ${p}-card`}
        style={size}
        src={assetUrl(info.image)}
        alt={info.name}
        draggable={false}
      />
    )
  return (
    <div
      className={`carousel-card ${p}-card ${p}-plate`}
      style={{ ...size, background: PLATE_COLORS[kind] }}
    >
      <span className={`${p}-plate-name`}>{info?.name ?? code}</span>
      <span className={`${p}-plate-code`}>{code}</span>
    </div>
  )
}
