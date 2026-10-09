import { useEffect, useRef, useState } from 'react'

// Copies the link of a multiplayer room (plan 07, decision 23). The button shows the result for 2 s.
// The caller shows it only while the guest seat is free.
export function CopyLinkButton({ code }) {
  const [result, setResult] = useState(null)
  const timer = useRef(null)

  useEffect(() => () => clearTimeout(timer.current), [])

  async function handleClick() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/#room=${code}`)
      setResult('Link copied')
    } catch {
      setResult('Copy failed')
    }
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setResult(null), 2000)
  }

  return (
    <button
      type="button"
      className="chip"
      title={`Copy the link of room ${code}`}
      onClick={handleClick}
    >
      {result ?? 'Copy link'}
    </button>
  )
}
