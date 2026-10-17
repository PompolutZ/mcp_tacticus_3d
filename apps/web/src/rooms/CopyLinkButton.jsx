import { useEffect, useRef, useState } from 'react'

// Copies the link of a multiplayer room (docs/features/rooms.md, "Room"). The button shows the result for 2 s.
// The caller shows it only while the guest seat is free. icon: a small icon button (the lobby tile badge)
// with the result as a text beside it, instead of the text button of the toolbar.
export function CopyLinkButton({ code, icon = false }) {
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

  if (icon)
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
