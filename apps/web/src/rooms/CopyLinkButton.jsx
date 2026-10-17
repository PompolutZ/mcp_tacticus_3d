import { useEffect, useRef, useState } from 'react'

// Copies the link of a room (docs/features/rooms.md, "Room"): a small icon button with the result as a text
// beside it for 2 s. The lobby tiles and the toolbar room box use it.
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
    <>
      <button
        type="button"
        className="room-copy"
        title={`Copy the link of room ${code}`}
        aria-label={`Copy the link of room ${code}`}
        onClick={handleClick}
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="9" y="9" width="11" height="11" rx="1" />
          <path d="M5 15V5a2 2 0 0 1 2-2h8" />
        </svg>
      </button>
      <span className="room-copy-result" role="status">
        {result}
      </span>
    </>
  )
}
