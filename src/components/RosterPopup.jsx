import { useEffect, useMemo, useRef, useState } from 'react'
import useEmblaCarousel from 'embla-carousel-react'
import { assetUrl } from '../assets/index.js'
import { PLATE_COLORS, ROSTER_TABS, parseRosterText, rosterCard, rosterTabs } from '../rosters/cards.js'
import { CARD_SIZES } from '../rosters/layout.js'
import { Overlay } from './Overlay.jsx'

const TEAM_NAMES = { blue: 'Blue', red: 'Red' }

// One player's roster in a full-screen popup, opened by a click on a roster card on the table
// (RosterCards.jsx). It has a tab for each card group, and each tab shows its cards in a carousel.
// No panel: the title, the tabs, the cards and the buttons lie on a dark, blurred backdrop, the same as
// the image of CardPopup.jsx. The cross button in the screen corner or a click on the backdrop closes
// the popup. Only the cards and the buttons take pointer events (see index.css), so a click next to
// them also goes to the backdrop.
// App owns the open tab and card (openRoster), because App handles all keys: Escape closes the popup,
// and the left and right arrows move the carousel. A dialog, so it renders through Overlay.
// code: the stored MCT code of the roster. tab: a key of ROSTER_TABS. index: the shown card of that tab.
export function RosterPopup({ team, code, tab, index, onTabChange, onIndexChange, onClose }) {
  const tabs = useMemo(() => rosterTabs(parseRosterText(code)), [code])
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
      <button type="button" className="roster-popup-close" aria-label="Close" onClick={onClose}>×</button>
      <div className="roster-popup" role="dialog" aria-modal="true" aria-label={title}>
        <h2 className={`roster-popup-title roster-popup-title--${team}`}>{title}</h2>
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

// The cards of one tab in a loop: after the last card comes the first. The shown card is in the middle.
// The other cards show at the sides, smaller and darker (see .roster-popup-slide--side in index.css): half
// of a character card, more of the narrower cards. A click on a side card moves it to the middle. Embla gives the
// drag, the loop and the slide animation. A drag or a button reports the new card with onIndexChange, and
// App passes it back as index. A new index from App (an arrow key) scrolls the carousel to that card, the
// short way around the loop.
// Embla loops only when all cards but one fill the viewport. The viewport is 2 character slides wide, so
// it needs 3 character cards, or about 6 Team Tactic or crisis cards (5 on a small screen). With fewer
// cards the carousel does not loop. The buttons and the arrow keys then go the long way to the other end.
function CardCarousel({ cards, index, onIndexChange }) {
  // Only the first index is an option. A changed option would restart Embla without the animation.
  // No containScroll: without the loop, every card must still get its own place in the middle.
  const [options] = useState({ startIndex: index, loop: true, containScroll: false })
  const [viewportRef, api] = useEmblaCarousel(options)
  // All cards have the same height (--card-h in index.css). All cards of a tab have the same size, so
  // the first card gives the card width of the tab.
  const [w, h] = CARD_SIZES[cards[0].kind]
  const cardWidth = { '--card-w': `calc(var(--card-h) * ${w / h})` }
  const step = s => api?.scrollTo((index + s + cards.length) % cards.length)

  useEffect(() => {
    if (!api) return
    const onSelect = () => onIndexChange(api.selectedScrollSnap())
    api.on('select', onSelect)
    return () => { api.off('select', onSelect) }
  }, [api, onIndexChange])

  useEffect(() => {
    if (api && api.selectedScrollSnap() !== index) api.scrollTo(index)
  }, [api, index])

  return (
    <div className="roster-popup-carousel" style={cardWidth} aria-roledescription="carousel">
      <div className="roster-popup-viewport" ref={viewportRef}>
        <div className="roster-popup-slides">
          {cards.map((card, i) => (
            <div
              key={`${i}-${card.code}`}
              className={i === index ? 'roster-popup-slide' : 'roster-popup-slide roster-popup-slide--side'}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${cards.length}`}
              // After a drag, Embla stops the click, so a drag does not move the carousel twice
              onClick={i === index ? undefined : () => api?.scrollTo(i)}
            >
              <PopupCard card={card} active={i === index} />
            </div>
          ))}
        </div>
      </div>
      <div className="roster-popup-nav">
        <button type="button" className="chip" aria-label="Previous card" disabled={cards.length < 2} onClick={() => step(-1)}>‹</button>
        <span className="roster-popup-count">Card {index + 1} of {cards.length}</span>
        <button type="button" className="chip" aria-label="Next card" disabled={cards.length < 2} onClick={() => step(1)}>›</button>
      </div>
    </div>
  )
}

// One card at popup size, with the aspect ratio of the card on the table. A card with a back image
// (rosters/cards.js) flips with a click on it or with the Flip button: a character card to its Injured
// side, a Team Tactic card to its back. Only the card in the middle (active) flips: a click on a side
// card goes to its slide, which moves the card to the middle. Each card keeps its side while the tab is
// open. A card without an image is a plate with the name and the MCT code, the same as on the table.
// The footer under the card holds the card switch, the Flip button and the Infinity Gems of a character
// as text lines, as the app has no gem images. The card switch, at the left, shows when the character
// has more than one card (variants in rosters/cards.js), for example Emma Frost and her Diamond form.
// The shown card keeps its side.
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
      <div className={flipped ? 'roster-popup-flip roster-popup-flip--back' : 'roster-popup-flip'} style={size} onClick={flip}>
        <div className="roster-popup-flip-inner">
          <img className="roster-popup-card roster-popup-side" src={assetUrl(shown.image)} alt={name} draggable={false} />
          <img className="roster-popup-card roster-popup-side roster-popup-side--back" src={assetUrl(shown.back)} alt={`${name}, other side`} draggable={false} />
        </div>
      </div>
    )
  } else if (shown.image) {
    face = <img className="roster-popup-card" style={size} src={assetUrl(shown.image)} alt={name} draggable={false} />
  } else {
    face = (
      <div className="roster-popup-card roster-popup-plate" style={{ ...size, background: PLATE_COLORS[card.kind] }}>
        <span className="roster-popup-plate-name">{info.name}</span>
        <span className="roster-popup-plate-code">{info.code}</span>
        {info.kind === 'character' && !info.model && <span className="roster-popup-plate-mark">No model</span>}
      </div>
    )
  }

  return (
    <>
      {face}
      <div className="roster-popup-card-footer">
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
        </div>
        {card.gems.map((gem, g) => (
          <div key={`${g}-${gem}`} className="roster-popup-gem">+ {rosterCard(gem)?.name ?? gem}</div>
        ))}
      </div>
    </>
  )
}
