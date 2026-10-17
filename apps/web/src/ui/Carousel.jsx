import { useEffect, useState } from 'react'
import useEmblaCarousel from 'embla-carousel-react'
import { loopCopies, shortWay, slideInFan, targetPosition } from './carouselLoop.js'

// Cards in a loop: after the last card comes the first. The shown card is in the middle. The other cards
// show at the sides, smaller and darker (see .carousel-slide--side in index.css). A click on a side card
// moves it to the middle. Embla gives the drag, the loop and the slide animation. A drag or a button
// reports the new card with onIndexChange, and the parent passes it back as index. A new index from the
// parent (an arrow key) scrolls the carousel to that card, the short way around the loop.
// Used by the roster popup (RosterPopup.jsx), the crisis compare overlay and the map picker of a new room
// (NewRoomDialog.jsx).
// fan: the look of the roster popup (rosters/roster.css). The cards fan out: a slide gets --rel (the
// signed distance to the shown card, the short way around the loop) and data-dist (its size, 0 to 2), and the
// css scales, darkens and turns the card by them. The slides have no footer then. renderNav({ index, count,
// prev, next }): the controls in place of the default nav (the parent draws them, with its own
// look); they step the carousel the same way.
// count: number of cards. renderSlide(i, active): the content of slide i. The element that shows the card
// gets the class carousel-card, so it dims at the sides. itemName: the word in "Card 3 of 10". style: CSS
// variables of the slide and viewport sizes, see .carousel in index.css.
// Embla loops only when the slides fill the viewport. A plain carousel with fewer cards does not loop: the
// buttons and the arrow keys then go the long way to the other end. The fan carousel always loops: it
// repeats the cards (loopCopies) until they fill the viewport and maps a slide position back to its card
// (carouselLoop.js). The repeats are aria-hidden, and a card that is closer on the other side is left
// empty, so each card shows once: the shown card in the middle, the others on both sides the short way
// around. A deck of 1 card shows alone; a deck of 2 shows the other card on the right only.
export function Carousel({
  count,
  index,
  onIndexChange,
  renderSlide,
  itemName = 'Card',
  style,
  fan = false,
  renderNav,
}) {
  const copies = loopCopies(count, fan)
  const total = count * copies
  // Only the first index is an option. A changed option would restart Embla without the animation.
  // No containScroll: without the loop, every card must still get its own place in the middle.
  const [options] = useState({ startIndex: index, loop: true, containScroll: false })
  const [viewportRef, api] = useEmblaCarousel(options)
  // The slide position in the middle (0 to total - 1). The parent index is the truth for the card: a new
  // index puts the middle on the nearest copy of that card, before Embla has moved.
  const [selected, setSelected] = useState(index)
  const mid = (selected + shortWay(index - (selected % count), count) + total) % total
  const step = (s) => api?.scrollTo(targetPosition(mid, (index + s + count) % count, count, total))

  useEffect(() => {
    if (!api) return
    const onSelect = () => {
      const pos = api.selectedScrollSnap()
      setSelected(pos)
      onIndexChange(pos % count)
    }
    api.on('select', onSelect)
    return () => {
      api.off('select', onSelect)
    }
  }, [api, onIndexChange, count])

  useEffect(() => {
    if (api && count > 0 && api.selectedScrollSnap() % count !== index)
      api.scrollTo(targetPosition(api.selectedScrollSnap(), index, count, total))
  }, [api, index, count, total])

  return (
    <div
      className={fan ? 'carousel carousel--fan' : 'carousel'}
      style={style}
      aria-roledescription="carousel"
    >
      <div className="carousel-viewport" ref={viewportRef}>
        <div className="carousel-slides">
          {Array.from({ length: total }, (_, pos) => {
            const card = pos % count
            const f = fan ? slideInFan(pos, mid, count, total) : null
            // A repeat of a card, or a card shown on the other side: an empty place for Embla
            if (f && !f.visible) {
              return <div key={pos} className="carousel-slide" aria-hidden="true" />
            }
            const active = fan ? f.offset === 0 : card === index
            return (
              <div
                key={pos}
                className={
                  active
                    ? 'carousel-slide'
                    : fan
                      ? 'carousel-slide carousel-slide--fan'
                      : 'carousel-slide carousel-slide--side'
                }
                data-dist={fan ? Math.abs(f.rel) : undefined}
                style={fan ? { '--rel': f.rel } : undefined}
                role="group"
                aria-roledescription="slide"
                aria-label={`${card + 1} of ${count}`}
                // After a drag, Embla stops the click, so a drag does not move the carousel twice
                onClick={active ? undefined : () => api?.scrollTo(pos)}
              >
                {renderSlide(card, active)}
              </div>
            )
          })}
        </div>
      </div>
      {renderNav ? (
        renderNav({ index, count, prev: () => step(-1), next: () => step(1) })
      ) : (
        <div className="carousel-nav">
          <button
            type="button"
            className="chip"
            aria-label={`Previous ${itemName.toLowerCase()}`}
            disabled={count < 2}
            onClick={() => step(-1)}
          >
            ‹
          </button>
          <span className="carousel-count">
            {itemName} {index + 1} of {count}
          </span>
          <button
            type="button"
            className="chip"
            aria-label={`Next ${itemName.toLowerCase()}`}
            disabled={count < 2}
            onClick={() => step(1)}
          >
            ›
          </button>
        </div>
      )}
    </div>
  )
}
