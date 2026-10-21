import { useId, useState } from 'react'
import { parseRoomCode } from './roomCode.js'

// The example in the join box. The format is in roomCode.js.
const EXAMPLE_CODE = 'K7Q2-M9XD'

// The top of the lobby (docs/features/rooms.md, "Lobby"): the title with New room! and Open sandbox, and the
// box that joins a room by its code. onNewRoom(), onOpenSandbox(): open that page or dialog. onOpenRoom(code):
// open the room page, which handles a code that is not found.
export function LobbyHero({ onNewRoom, onOpenSandbox, onOpenRoom }) {
  return (
    <section className="lobby-hero" aria-labelledby="lobby-hero-title">
      <div className="lobby-hero-main">
        <div className="lobby-hero-tag">Meanwhile, on a table near you…</div>
        <h2 id="lobby-hero-title" className="lobby-hero-title">
          Assemble
          <br />
          at the table!
        </h2>
        <p className="lobby-hero-text">
          A 3D tabletop for your favourite superheroes. Open a room, paste your roster and play —
          solo or head to head.
        </p>
        <div className="lobby-hero-actions">
          <button type="button" className="pop lobby-hero-new" onClick={onNewRoom}>
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M12 4v16M4 12h16" />
            </svg>
            New room!
          </button>
          <button type="button" className="pop lobby-hero-sandbox" onClick={onOpenSandbox}>
            Open sandbox
          </button>
        </div>
      </div>
      <JoinBox onOpenRoom={onOpenRoom} />
    </section>
  )
}

function JoinBox({ onOpenRoom }) {
  const id = useId()
  const [text, setText] = useState('')
  const [error, setError] = useState(false)

  function handleSubmit(event) {
    event.preventDefault()
    const code = parseRoomCode(text)
    if (!code) {
      setError(true)
      return
    }
    setError(false)
    onOpenRoom(code)
  }

  return (
    <div className="lobby-join">
      <form className="lobby-join-form bubble" onSubmit={handleSubmit} noValidate>
        <label htmlFor={id} className="lobby-join-title">
          Got a room code?
        </label>
        <div className="lobby-join-text">
          Type the code your friend shared or paste the link you have received from them and jump
          in.
        </div>
        <div className="lobby-join-row">
          <input
            id={id}
            className="comic-input lobby-join-input"
            value={text}
            placeholder={EXAMPLE_CODE.replace(/[0-9A-Z]/g, 'X')}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            aria-invalid={error}
            aria-describedby={error ? `${id}-error` : undefined}
            onChange={(event) => {
              setText(event.target.value)
              setError(false)
            }}
          />
          <button type="submit" className="pop lobby-join-button">
            Join!
          </button>
        </div>
        {error && (
          <p id={`${id}-error`} className="lobby-join-error" role="alert">
            That is not a room code. Codes look like {EXAMPLE_CODE}.
          </p>
        )}
      </form>
      <div className="lobby-join-note">Codes look like {EXAMPLE_CODE}</div>
    </div>
  )
}
