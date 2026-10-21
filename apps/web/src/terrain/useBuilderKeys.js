import { useEffect } from 'react'

// Q / E turn the selected piece by 15° (Q counter-clockwise seen from above), Delete or Backspace removes it.
// Not while a field has the focus, and not with a modifier (Ctrl+Q, Cmd+Backspace are the browser's).
// onTurn(dir): dir 1 is Q, -1 is E. onRemove(): remove the selected piece. Without selectedId the keys do nothing.
export function useBuilderKeys({ selectedId, onTurn, onRemove }) {
  useEffect(() => {
    function onKey(e) {
      if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey) return
      if (!selectedId) return
      const dir = e.code === 'KeyQ' ? 1 : e.code === 'KeyE' ? -1 : 0
      if (dir) {
        e.preventDefault()
        onTurn(dir)
      } else if (e.code === 'Delete' || e.code === 'Backspace') {
        e.preventDefault()
        onRemove()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedId, onTurn, onRemove])
}
