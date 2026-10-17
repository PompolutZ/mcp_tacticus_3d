import { useEffect, useState } from 'react'
import useEmblaCarousel from 'embla-carousel-react'

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
// Embla loops only when all cards but one fill the viewport. With fewer cards the carousel does not loop.
// The buttons and the arrow keys then go the long way to the other end.
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
  // Only the first index is an option. A changed option would restart Embla without the animation.
  // No containScroll: without the loop, every card must still get its own place in the middle.
  const [options] = useState({ startIndex: index, loop: true, containScroll: false })
  const [viewportRef, api] = useEmblaCarousel(options)
  const step = (s) => api?.scrollTo((index + s + count) % count)

  useEffect(() => {
    if (!api) return
    const onSelect = () => onIndexChange(api.selectedScrollSnap())
    api.on('select', onSelect)
    return () => {
      api.off('select', onSelect)
    }
  }, [api, onIndexChange])

  useEffect(() => {
    if (api && api.selectedScrollSnap() !== index) api.scrollTo(index)
  }, [api, index])

  // The signed distance of slide i to the shown card, the short way around the loop
  const rel = (i) => {
    const d = (i - index + count) % count
    return Math.max(-2, Math.min(2, d > count / 2 ? d - count : d))
  }

  return (
    <div
      className={fan ? 'carousel carousel--fan' : 'carousel'}
      style={style}
      aria-roledescription="carousel"
    >
      <div className="carousel-viewport" ref={viewportRef}>
        <div className="carousel-slides">
          {Array.from({ length: count }, (_, i) => (
            <div
              key={i}
              className={
                i === index
                  ? 'carousel-slide'
                  : fan
                    ? 'carousel-slide carousel-slide--fan'
                    : 'carousel-slide carousel-slide--side'
              }
              data-dist={fan ? Math.abs(rel(i)) : undefined}
              style={fan ? { '--rel': rel(i) } : undefined}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${count}`}
              // After a drag, Embla stops the click, so a drag does not move the carousel twice
              onClick={i === index ? undefined : () => api?.scrollTo(i)}
            >
              {renderSlide(i, i === index)}
            </div>
          ))}
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
