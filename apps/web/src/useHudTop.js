import { useEffect } from 'react'

// Sets --hud-top on the HUD root: the y under the toolbar row, where the Library, the Log and the
// notice start. The toolbar is one row that does not wrap, so its height changes only with the font
// or the browser zoom; a ResizeObserver follows it. When the scoreboard (ui/Scoreboard.jsx) has moved to a row
// under the toolbar (a narrow window), --hud-top is under the scoreboard. See docs/features/table-tools.md, "Toolbar".
// The gap is a little more than the hard shadow of the top boxes
const GAP = 12

export function useHudTop(rootRef) {
  useEffect(() => {
    const root = rootRef.current
    const bar = root?.querySelector('.hud-top')
    if (!root || !bar) return undefined
    const score = bar.querySelector('.scoreboard')
    function update() {
      let bottom = bar.offsetTop + bar.offsetHeight
      // Under the toolbar row: the scoreboard top is at or below the bottom of the bar
      if (score && score.offsetTop >= bar.offsetHeight) {
        bottom = Math.max(bottom, bar.offsetTop + score.offsetTop + score.offsetHeight)
      }
      root.style.setProperty('--hud-top', `${bottom + GAP}px`)
    }
    update()
    // The scoreboard moves under the bar at a window width, with no size change of the bar
    window.addEventListener('resize', update)
    if (typeof ResizeObserver === 'undefined')
      return () => window.removeEventListener('resize', update)
    const observer = new ResizeObserver(update)
    observer.observe(bar)
    if (score) observer.observe(score)
    return () => {
      window.removeEventListener('resize', update)
      observer.disconnect()
    }
  }, [rootRef])
}
