import { useMemo, useState } from 'react'
import { assetUrl } from '../assets/index.js'
import {
  PLATE_COLORS,
  ROSTER_TABS,
  jarvisRosterUrl,
  parseRosterText,
  rosterCard,
  rosterTabs,
} from './cards.js'
import { CARD_SIZES } from './layout.js'
import { CardPopup } from './CardPopup.jsx'
import { Dialog } from '../ui/Dialog.jsx'
import { Carousel } from '../ui/Carousel.jsx'
import TacticFaceScaled from '../tactics/TacticFaceScaled.jsx'
import { BreakdownTab } from './BreakdownTab.jsx'
import '../rooms/comicBase.js'
import './roster.css'

// The card popup content of a gem: its drawn face, else its image
function gemPopupCard(code) {
  const info = rosterCard(code)
  if (!info) return null
  return {
    src: assetUrl(info.image),
    alt: info.name,
    tacticKey: info.faceKey ?? undefined,
  }
}

// One player's roster in a framed comic dialog (docs/features/roster.md, "Roster popup"), opened by a click
// on a roster card on the table (RosterCards.jsx), or by Roster on a room tile in the lobby (Lobby.jsx) and
// the join page. A blue header with the title, the tab row and the link to the whole roster on Jarvis, and
// under it a stage with the cards in a fan carousel (Carousel.jsx, fan) and the controls. The look comes from
// roster.css and the .comic variables (rooms/comic.css), so the same popup shows in the lobby and on the
// table. The cross button at the top right corner of the frame, Escape or a click on the backdrop closes the
// popup.
// The parent owns the open tab and card: App (openRoster) on the table, because App handles all keys,
// and RoomRosterPopup in the lobby. Escape closes the popup, and the left and right arrows move the
// carousel. A dialog, so it uses Dialog.
// title: the heading. color: 'blue' | 'red' tints the header, or missing: a neutral header (the caller knows
// it, not the side color store, which belongs to the open table). roomCode, seat: the small line above the title,
// "Room K7Q2-M9XD · host"; it shows only when the caller gives both. code: the stored MCT code of the roster.
// tab: a key of ROSTER_TABS, or 'breakdown'. index: the shown card of that tab.
// breakdown: { threats, threat, filters, onThreatChange, onFiltersChange, chooseBlock, squadCharacters,
// onChoose } for the Breakdown tab after the card tabs (see
// BreakdownTab.jsx and docs/features/squad-breakdown.md), or missing: no such tab, as in the lobby.
// squad: { has(tab, index), onToggle(tab, index) }, or missing. With it, a character and Team Tactic card has
// an Add to squad / Remove from squad button (docs/features/setup-game.md, "Squads").
export function RosterPopup({
  title,
  color,
  roomCode,
  seat,
  code,
  tab,
  index,
  breakdown,
  squad,
  onTabChange,
  onIndexChange,
  onClose,
}) {
  const parsed = useMemo(() => parseRosterText(code), [code])
  const tabs = useMemo(() => rosterTabs(parsed), [parsed])

  return (
    <Dialog
      backdropClassName="card-popup roster-popup-backdrop"
      className="comic roster-comic roster-comic--popup"
      closeClassName="roster-comic-close"
      label={title}
      onClose={onClose}
    >
      <header className={`roster-comic-head roster-comic-head--${color ?? 'neutral'}`}>
        <div className="roster-comic-heading">
          {roomCode && seat && (
            <div className="roster-comic-tag">
              Room {roomCode} · {seat}
            </div>
          )}
          <h2 className="roster-comic-title">{title}</h2>
        </div>
        <div className="roster-comic-head-side">
          <JarvisLink className="comic-button pop" href={jarvisRosterUrl(parsed)}>
            Open whole roster on Jarvis
          </JarvisLink>
          <div className="roster-comic-tabs" role="tablist" aria-label="Card type">
            {ROSTER_TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={t.key === tab}
                className="roster-comic-tab"
                disabled={tabs[t.key].length === 0}
                onClick={() => {
                  if (t.key !== tab) onTabChange(t.key)
                }}
              >
                {t.label} <span className="roster-comic-tab-count">{tabs[t.key].length}</span>
              </button>
            ))}
            {breakdown && (
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'breakdown'}
                className="roster-comic-tab"
                disabled={parsed.characters.length === 0}
                onClick={() => {
                  if (tab !== 'breakdown') onTabChange('breakdown')
                }}
              >
                Breakdown
              </button>
            )}
          </div>
        </div>
      </header>
      <div className="roster-comic-stage">
        {tab === 'breakdown' && breakdown ? (
          <div className="roster-comic-breakdown">
            <BreakdownTab parsed={parsed} breakdown={breakdown} />
          </div>
        ) : (
          // A new tab gets a new carousel, which starts at the index that App gives
          <CardCarousel
            key={tab}
            cards={tabs[tab]}
            index={index}
            onIndexChange={onIndexChange}
            squad={squad && (tab === 'characters' || tab === 'tactics') ? { ...squad, tab } : null}
          />
        )}
      </div>
    </Dialog>
  )
}

// The cards of one tab in the fan carousel (Carousel.jsx) and the controls under it. All cards have the same
// height (--card-h in roster.css). All cards of a tab have the same size, so the first card gives the card
// width of the tab. The side of each card (flipped) and its shown variant live here, not in the slide, so the
// controls under the carousel act on the card in the middle. Each card keeps its side and variant while the
// tab is open (a new tab remounts this component).
// The viewport is as wide as the stage in every tab. Embla loops only when the slides fill it, so a tab with
// few cards does not loop: the buttons and keys still wrap to the other end, and the drag stops at the ends
// (docs/features/roster.md, "Roster popup").
function CardCarousel({ cards, index, onIndexChange, squad }) {
  const [w, h] = CARD_SIZES[cards[0].kind]
  const [flipped, setFlipped] = useState({})
  const [variants, setVariants] = useState({})
  const [gemCard, setGemCard] = useState(null)

  return (
    <Carousel
      fan
      count={cards.length}
      index={index}
      onIndexChange={onIndexChange}
      style={{ '--card-w': `calc(var(--card-h) * ${w / h})` }}
      renderSlide={(i, active) => (
        <PopupCard
          card={cards[i]}
          variant={variants[i] ?? 0}
          flipped={!!flipped[i]}
          onFlip={() => {
            if (active) setFlipped((f) => ({ ...f, [i]: !f[i] }))
          }}
        />
      )}
      renderNav={({ index: shownIndex, count, prev, next }) => {
        const card = cards[shownIndex]
        const info = rosterCard(card.code)
        const shown = info.variants?.[variants[shownIndex] ?? 0] ?? info
        const canFlip = Boolean(shown.image && shown.back)
        const inSquad = squad ? squad.has(squad.tab, shownIndex) : null
        return (
          <div className="roster-comic-footer">
            <div className="roster-comic-nav">
              <button
                type="button"
                className="roster-comic-square pop"
                aria-label="Previous card"
                disabled={count < 2}
                onClick={prev}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M15 5l-7 7 7 7" />
                </svg>
              </button>
              <div className="roster-comic-count" aria-live="polite">
                Card {shownIndex + 1} of {count}
              </div>
              <button
                type="button"
                className="roster-comic-square pop"
                aria-label="Next card"
                disabled={count < 2}
                onClick={next}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M9 5l7 7-7 7" />
                </svg>
              </button>
              {canFlip && (
                <button
                  type="button"
                  className="roster-comic-flip-button pop"
                  aria-pressed={Boolean(flipped[shownIndex])}
                  onClick={() => setFlipped((f) => ({ ...f, [shownIndex]: !f[shownIndex] }))}
                >
                  Flip!
                </button>
              )}
              <JarvisLink className="comic-button pop" href={info.jarvisUrl}>
                This card on Jarvis
              </JarvisLink>
            </div>
            <div className="roster-comic-extras">
              {info.variants && (
                <div
                  className="roster-comic-variants"
                  role="tablist"
                  aria-label={`Cards of ${info.name}`}
                >
                  {info.variants.map((v, i) => (
                    <button
                      key={i}
                      type="button"
                      role="tab"
                      aria-selected={i === (variants[shownIndex] ?? 0)}
                      className="roster-comic-chip"
                      onClick={() => setVariants((vs) => ({ ...vs, [shownIndex]: i }))}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              )}
              {squad && (
                <button
                  type="button"
                  className="roster-comic-chip"
                  aria-pressed={inSquad}
                  onClick={() => squad.onToggle(squad.tab, shownIndex)}
                >
                  {inSquad ? 'Remove from squad' : 'Add to squad'}
                </button>
              )}
              {card.gems.map((gem, g) => (
                <button
                  key={`${g}-${gem}`}
                  type="button"
                  className="roster-comic-gem"
                  title="Open the gem card"
                  onClick={() => setGemCard(gemPopupCard(gem))}
                >
                  + {rosterCard(gem)?.name ?? gem}
                </button>
              ))}
            </div>
            {/* The wrapper stops the click that closes the gem card from also closing this popup */}
            <div style={{ display: 'contents' }} onClick={(e) => e.stopPropagation()}>
              <CardPopup card={gemCard} onClose={() => setGemCard(null)} />
            </div>
          </div>
        )
      }}
    />
  )
}

// One card at popup size, with the aspect ratio of the card on the table. A card with a back image
// (rosters/cards.js) flips with a click on it or with the Flip! button: a character card to its Injured
// side, a Team Tactic card to its back. Only the card in the middle flips (onFlip checks it): a click on a
// side card goes to its slide, which moves the card to the middle. A card without an image is a plate with
// the name and the MCT code, the same as on the table. variant: the shown card of a character with more than
// one card (variants in rosters/cards.js), for example Emma Frost and her Diamond form. The controls under
// the carousel (CardCarousel) switch the variant and the side.
function PopupCard({ card, variant, flipped, onFlip }) {
  const info = rosterCard(card.code)
  const shown = info.variants?.[variant] ?? info
  const name = variant > 0 ? `${info.name}, ${shown.label}` : info.name
  const [w, h] = CARD_SIZES[card.kind]
  // --card-w comes from CardCarousel
  // A grunt card is portrait (808x1404): it has the height of a character card of the slide, centered in it
  const size = shown.portrait
    ? {
        height: `calc(var(--card-w) * ${h / w})`,
        width: 'auto',
        aspectRatio: '808 / 1404',
        margin: '0 auto',
      }
    : { width: 'var(--card-w)', aspectRatio: `${w} / ${h}` }

  // A Team Tactic card with a drawn face: the front is the face component, not an image
  const drawn = shown.faceKey ?? null
  if (shown.image && shown.back) {
    return (
      <div
        className={
          flipped
            ? 'carousel-card roster-comic-flip roster-comic-flip--back'
            : 'carousel-card roster-comic-flip'
        }
        style={size}
        onClick={onFlip}
      >
        <div className="roster-comic-flip-inner">
          {drawn ? (
            <div className="roster-comic-card roster-comic-side" role="img" aria-label={name}>
              <TacticFaceScaled tacticKey={drawn} />
            </div>
          ) : (
            <img
              className="roster-comic-card roster-comic-side"
              src={assetUrl(shown.image)}
              alt={name}
              draggable={false}
            />
          )}
          <img
            className="roster-comic-card roster-comic-side roster-comic-side--back"
            src={assetUrl(shown.back)}
            alt={`${name}, other side`}
            draggable={false}
          />
        </div>
      </div>
    )
  }
  if (shown.image) {
    return (
      <img
        className="carousel-card roster-comic-card"
        style={size}
        src={assetUrl(shown.image)}
        alt={name}
        draggable={false}
      />
    )
  }
  return (
    <div
      className="carousel-card roster-comic-card roster-comic-plate"
      style={{ ...size, background: PLATE_COLORS[card.kind] }}
    >
      <span className="roster-comic-plate-name">{info.name}</span>
      <span className="roster-comic-plate-code">{info.code}</span>
      {info.kind === 'character' && !info.model && (
        <span className="roster-comic-plate-mark">No model</span>
      )}
    </div>
  )
}

// A link with an arrow icon that opens a Jarvis page in a new browser tab
function JarvisLink({ href, className, children }) {
  return (
    <a className={className} href={href} target="_blank" rel="noreferrer" draggable={false}>
      {children}
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6" />
      </svg>
    </a>
  )
}
