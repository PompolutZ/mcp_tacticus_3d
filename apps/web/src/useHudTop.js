import { useEffect } from 'react'
import { scoreboardFits } from './ui/crisisStrip.js'

// Sets CSS variables on the HUD root (docs/features/table-tools.md, "Toolbar"):
// - --hud-top: the y under the toolbar row, where the Library, the Log and the notice start. The toolbar is one
//   row that does not wrap, so its height changes only with the font or the browser zoom. When the scoreboard
//   (ui/Scoreboard.jsx) has moved to a row under the toolbar, --hud-top is under the scoreboard.
// - --score-bottom: the y under the scoreboard, where the crisis strip starts.
// - --streamer-top: the y under the crisis strip, where the Streamer columns start. Not set without a strip.
// The scoreboard sits at the center of the bar. It moves to a row under the bar (data-below on it) when its
// own width does not fit between the boxes of the bar. The width is the max-content width of the scoreboard,
// not its place, so the answer is the same in both rows and nothing flips back and forth.
// stripKey: changes when the crisis strip shows or hides.
// The gap is a little more than the hard shadow of the top boxes
const GAP = 12

// The boxes of the bar that the scoreboard must not cover: the room box, the Setup box, the table tools in
// the middle (only the part that shows, the middle scrolls) and the panel buttons
function barBoxes(bar) {
  const boxes = []
  for (const el of bar.querySelectorAll('.toolbar-left > *, .hud-right')) {
    boxes.push(el.getBoundingClientRect())
  }
  const middle = bar.querySelector('.toolbar-middle')
  const tools = middle ? [...middle.children] : []
  if (middle && tools.length > 0) {
    const edge = middle.getBoundingClientRect()
    const first = tools[0].getBoundingClientRect()
    const last = tools[tools.length - 1].getBoundingClientRect()
    boxes.push({ left: first.left, right: Math.min(last.right, edge.right) })
  }
  return boxes
}

export function useHudTop(rootRef, stripKey) {
  useEffect(() => {
    const root = rootRef.current
    const bar = root?.querySelector('.hud-top')
    if (!root || !bar) return undefined
    const score = bar.querySelector('.scoreboard')
    const strip = root.querySelector('.crisis-strip')
    function update() {
      if (score) {
        const rect = bar.getBoundingClientRect()
        const fits = scoreboardFits(
          rect.left + rect.width / 2,
          score.offsetWidth,
          barBoxes(bar),
          GAP,
        )
        if (fits) score.removeAttribute('data-below')
        else score.setAttribute('data-below', '')
      }
      let bottom = bar.offsetTop + bar.offsetHeight
      let scoreBottom = bottom
      if (score) {
        const scoreEnd = bar.offsetTop + score.offsetTop + score.offsetHeight
        scoreBottom = Math.max(bottom, scoreEnd)
        // Under the toolbar row: the scoreboard moved below the bar
        if (score.hasAttribute('data-below')) bottom = scoreBottom
      }
      root.style.setProperty('--hud-top', `${bottom + GAP}px`)
      root.style.setProperty('--score-bottom', `${scoreBottom + GAP}px`)
      if (strip) {
        root.style.setProperty(
          '--streamer-top',
          `${scoreBottom + GAP + strip.offsetHeight + GAP}px`,
        )
      } else {
        root.style.removeProperty('--streamer-top')
      }
    }
    update()
    // The scoreboard moves at a window width, with no size change of the bar. Table tools come and go.
    window.addEventListener('resize', update)
    const mutations = new MutationObserver(update)
    mutations.observe(bar, { childList: true, subtree: true })
    if (typeof ResizeObserver === 'undefined') {
      return () => {
        window.removeEventListener('resize', update)
        mutations.disconnect()
      }
    }
    const observer = new ResizeObserver(update)
    observer.observe(bar)
    if (score) observer.observe(score)
    if (strip) observer.observe(strip)
    for (const box of bar.querySelectorAll('.toolbar-left > *, .toolbar-middle, .hud-right')) {
      observer.observe(box)
    }
    return () => {
      window.removeEventListener('resize', update)
      mutations.disconnect()
      observer.disconnect()
    }
  }, [rootRef, stripKey])
}
