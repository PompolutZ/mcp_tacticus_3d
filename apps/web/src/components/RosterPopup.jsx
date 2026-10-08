import { useMemo, useRef, useState } from 'react'
import { assetUrl } from '../assets/index.js'
import { PLATE_COLORS, ROSTER_TABS, jarvisRosterUrl, parseRosterText, rosterCard, rosterTabs } from '../rosters/cards.js'
import { CARD_SIZES } from '../rosters/layout.js'
import { Overlay } from './Overlay.jsx'
import { Carousel } from './Carousel.jsx'

const TEAM_NAMES = { blue: 'Blue', red: 'Red' }

// One player's roster in a full-screen popup, opened by a click on a roster card on the table
// (RosterCards.jsx), or by Roster on a room tile in the lobby (Lobby.jsx). It has a tab for each card group, and each tab shows its cards in a carousel.
// No panel: the title, the tabs, the cards and the buttons lie on a dark, blurred backdrop, the same as
// the image of CardPopup.jsx. The cross button in the screen corner or a click on the backdrop closes
// the popup. Only the cards, the buttons and the links take pointer events (see index.css), so a click
// next to them also goes to the backdrop. The link under the title opens the roster in the Jarvis roster
// validator, in a new browser tab.
// The parent owns the open tab and card: App (openRoster) on the table, because App handles all keys,
// and RoomRosterPopup in the lobby. Escape closes the popup, and the left and right arrows move the
// carousel. A dialog, so it renders through Overlay.
// code: the stored MCT code of the roster. tab: a key of ROSTER_TABS. index: the shown card of that tab.
export function RosterPopup({ team, code, tab, index, onTabChange, onIndexChange, onClose }) {
  const parsed = useMemo(() => parseRosterText(code), [code])
  const tabs = useMemo(() => rosterTabs(parsed), [parsed])
  // A carousel drag can end on the backdrop. The click then goes to the backdrop. So the backdrop
  // closes the popup only when the press also started on the backdrop.
  const pressedBackdrop = useRef(false)
  const title = `${TEAM_NAMES[team]} player roster`

  return (
    <Overlay
      className="card-popup roster-popup-backdrop"
      onPointerDown={e => { pressedBackdrop.current = e.target === e.currentTarget }}
      onClick={e => { if (pressedBackdrop.current && e.target === e.currentTarget) onClose() }}
    >
      <button type="button" className="popup-close" aria-label="Close" onClick={onClose}>×</button>
      <div className="roster-popup" role="dialog" aria-modal="true" aria-label={title}>
        <h2 className={`roster-popup-title roster-popup-title--${team}`}>{title}</h2>
        <JarvisLink href={jarvisRosterUrl(parsed)}>Open this roster on Jarvis</JarvisLink>
        <div className="roster-popup-tabs" role="tablist">
          {ROSTER_TABS.map(t => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={t.key === tab}
              className={t.key === tab ? 'chip chip--active' : 'chip'}
              disabled={tabs[t.key].length === 0}
              onClick={() => { if (t.key !== tab) onTabChange(t.key) }}
            >
              {t.label}
            </button>
          ))}
        </div>
        {/* A new tab gets a new carousel, which starts at the index that App gives */}
        <CardCarousel key={tab} cards={tabs[tab]} index={index} onIndexChange={onIndexChange} />
      </div>
    </Overlay>
  )
}

// The cards of one tab in the carousel (Carousel.jsx). All cards have the same height (--card-h in
// index.css). All cards of a tab have the same size, so the first card gives the card width of the tab.
// The viewport is 2 character slides wide, so the loop needs 3 character cards, or about 6 Team Tactic or
// crisis cards (5 on a small screen).
function CardCarousel({ cards, index, onIndexChange }) {
  const [w, h] = CARD_SIZES[cards[0].kind]
  return (
    <Carousel
      count={cards.length}
      index={index}
      onIndexChange={onIndexChange}
      style={{ '--card-w': `calc(var(--card-h) * ${w / h})` }}
      renderSlide={(i, active) => <PopupCard card={cards[i]} active={active} />}
    />
  )
}

// One card at popup size, with the aspect ratio of the card on the table. A card with a back image
// (rosters/cards.js) flips with a click on it or with the Flip button: a character card to its Injured
// side, a Team Tactic card to its back. Only the card in the middle (active) flips: a click on a side
// card goes to its slide, which moves the card to the middle. Each card keeps its side while the tab is
// open. A card without an image is a plate with the name and the MCT code, the same as on the table.
// The footer under the card holds the card switch, the Flip button, the link to the card page on Jarvis
// and the Infinity Gems of a character as text lines, as the app has no gem images. The card switch, at
// the left, shows when the character has more than one card (variants in rosters/cards.js), for example
// Emma Frost and her Diamond form. The shown card keeps its side.
function PopupCard({ card, active }) {
  const [flipped, setFlipped] = useState(false)
  const [variant, setVariant] = useState(0)
  const info = rosterCard(card.code)
  const shown = info.variants?.[variant] ?? info
  const name = variant > 0 ? `${info.name}, ${shown.label}` : info.name
  const [w, h] = CARD_SIZES[card.kind]
  // --card-w comes from CardCarousel
  const size = { width: 'var(--card-w)', aspectRatio: `${w} / ${h}` }
  const flip = () => { if (active) setFlipped(v => !v) }

  let face
  if (shown.image && shown.back) {
    face = (
      <div className={flipped ? 'carousel-card roster-popup-flip roster-popup-flip--back' : 'carousel-card roster-popup-flip'} style={size} onClick={flip}>
        <div className="roster-popup-flip-inner">
          <img className="roster-popup-card roster-popup-side" src={assetUrl(shown.image)} alt={name} draggable={false} />
          <img className="roster-popup-card roster-popup-side roster-popup-side--back" src={assetUrl(shown.back)} alt={`${name}, other side`} draggable={false} />
        </div>
      </div>
    )
  } else if (shown.image) {
    face = <img className="carousel-card roster-popup-card" style={size} src={assetUrl(shown.image)} alt={name} draggable={false} />
  } else {
    face = (
      <div className="carousel-card roster-popup-card roster-popup-plate" style={{ ...size, background: PLATE_COLORS[card.kind] }}>
        <span className="roster-popup-plate-name">{info.name}</span>
        <span className="roster-popup-plate-code">{info.code}</span>
        {info.kind === 'character' && !info.model && <span className="roster-popup-plate-mark">No model</span>}
      </div>
    )
  }

  return (
    <>
      {face}
      <div className="carousel-footer roster-popup-card-footer">
        <div className="roster-popup-card-actions">
          {info.variants && (
            <div className="roster-popup-variants" role="tablist" aria-label={`Cards of ${info.name}`}>
              {info.variants.map((v, i) => (
                <button
                  key={i}
                  type="button"
                  role="tab"
                  aria-selected={i === variant}
                  className={i === variant ? 'chip chip--active' : 'chip'}
                  onClick={() => setVariant(i)}
                >
                  {v.label}
                </button>
              ))}
            </div>
          )}
          {shown.image && shown.back && <button type="button" className="chip roster-popup-flip-button" onClick={flip}>Flip</button>}
          <JarvisLink className="roster-popup-card-jarvis" href={info.jarvisUrl}>Open on Jarvis</JarvisLink>
        </div>
        {card.gems.map((gem, g) => (
          <div key={`${g}-${gem}`} className="roster-popup-gem">+ {rosterCard(gem)?.name ?? gem}</div>
        ))}
      </div>
    </>
  )
}

// A link with the Jarvis logo that opens a Jarvis page in a new browser tab
function JarvisLink({ href, className, children }) {
  return (
    <a className={className ? `jarvis-link ${className}` : 'jarvis-link'} href={href} target="_blank" rel="noreferrer" draggable={false}>
      <img className="jarvis-link-logo" src={assetUrl('jarvis-logo.webp')} alt="" draggable={false} />
      {children}
    </a>
  )
}
