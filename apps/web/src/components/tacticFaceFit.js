// Font size of the text on a Team Tactic face: the largest size, in 0.5 px steps from START down to MIN,
// where the title, the attack panel, the text and the footer fit in the card with at least GAP px
// above the footer and below the title. Sets --fs on the card element, returns the size.
// card: the .tactic-face element. It must be in the document, with its fonts loaded.
const START = 19.5
const MIN = 12
const STEP = 0.5
const GAP = 14
// Space between the title and the attack panel, and the sum of the other fixed margins
const TITLE_MARGIN = 28

export function fitFace(card) {
  const main = card.querySelector('.tactic-face-main')
  const title = card.querySelector('.tactic-face-title')
  const atks = card.querySelector('.tactic-face-atks')
  const foot = card.querySelector('.tactic-face-foot')

  const fits = () => {
    // The text block can grow past its flex share while it is measured
    const flex = main.style.flex
    main.style.flex = '0 0 auto'
    const mainHeight = main.offsetHeight
    main.style.flex = flex
    const need =
      title.offsetHeight +
      TITLE_MARGIN +
      atks.offsetHeight +
      GAP +
      mainHeight +
      GAP +
      foot.offsetHeight
    return need <= card.clientHeight
  }

  let size = START
  card.style.setProperty('--fs', `${size}px`)
  while (!fits() && size > MIN) {
    size -= STEP
    card.style.setProperty('--fs', `${size}px`)
  }
  return size
}
