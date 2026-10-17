// The index math of the fan carousel (Carousel.jsx). Embla loops only when the slides fill the viewport, so
// in fan mode the cards are repeated until they do. A slide has a position (0 to total - 1, the order in the
// DOM and in Embla) and a card (position % count).

// Slides in the loop at least. A fan slide is narrower than a card, and the viewport is at most the stage.
const MIN_SLIDES = 16

export function loopCopies(count, fan) {
  return fan && count > 1 ? Math.ceil(MIN_SLIDES / count) : 1
}

// d wrapped to the short way around a loop of n: (-n/2, n/2], a tie goes forward
export function shortWay(d, n) {
  const m = ((d % n) + n) % n
  return m > n / 2 ? m - n : m
}

// The position of the slide to scroll to so that card `card` is shown, the short way from position `from`
export function targetPosition(from, card, count, total) {
  return (from + shortWay(card - (from % count), count) + total) % total
}

// What a slide at position `pos` shows when the position `sel` is in the middle. offset: the signed
// distance to the middle on the loop. rel: the same, clamped to the fan (-2 to 2). visible: false for
// a repeat of a card that is closer on the other side. Without it a small deck would show the same card
// twice, or the same card on both sides of the shown card.
export function slideInFan(pos, sel, count, total) {
  const offset = shortWay(pos - sel, total)
  const own = shortWay(pos - sel, count)
  return {
    offset,
    rel: Math.max(-2, Math.min(2, own)),
    visible: offset === own,
  }
}
