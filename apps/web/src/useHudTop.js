import { useEffect } from 'react'

// Sets --hud-top on the HUD root: the y under the toolbar row, where the Library, the Log and the
// notice start. The toolbar is one row that does not wrap, so its height changes only with the font
// or the browser zoom; a ResizeObserver follows it. See docs/features/table-tools.md, "Toolbar".
// The gap is a little more than the hard shadow of the top boxes
const GAP = 12

export function useHudTop(rootRef) {
  useEffect(() => {
    const root = rootRef.current
    const bar = root?.querySelector('.hud-top')
    if (!root || !bar) return undefined
    function update() {
      root.style.setProperty('--hud-top', `${bar.offsetTop + bar.offsetHeight + GAP}px`)
    }
    update()
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(update)
    observer.observe(bar)
    return () => observer.disconnect()
  }, [rootRef])
}
