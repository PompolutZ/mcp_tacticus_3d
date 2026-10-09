import { useEffect, useRef, useState } from 'react'
import { avatarUrl } from '../auth/avatar.js'
import { DISCORD_ON, devLogin, login, logout } from '../auth/session.js'
import { useUser } from '../auth/useUser.js'

// The login part of the lobby header (docs/plans/implement-backend/06-login.md, decision 15). Renders
// nothing when login is off.
export function UserMenu() {
  const { status, user } = useUser()
  if (status === 'off' || status === 'loading') return null
  if (status === 'error')
    return (
      <div className="user-menu user-menu-error">
        Login not available: the server does not answer.
      </div>
    )
  if (status === 'in') return <LoggedIn user={user} />
  return <LoggedOut />
}

function LoggedOut() {
  const [name, setName] = useState('')
  const [error, setError] = useState(null)

  async function handleDevLogin(e) {
    e.preventDefault()
    setError(await devLogin(name))
  }

  return (
    <div className="user-menu">
      {DISCORD_ON && (
        <>
          <button type="button" className="chip user-login" onClick={login}>
            Log in with Discord
          </button>
          <p className="user-menu-note">Your opponent sees your Discord name and avatar.</p>
        </>
      )}
      {import.meta.env.DEV && (
        <form className="user-dev" onSubmit={handleDevLogin}>
          <input
            className="user-dev-name"
            value={name}
            maxLength={32}
            placeholder="Dev name"
            aria-label="Dev login name"
            onChange={(e) => setName(e.target.value)}
          />
          <button type="submit" className="chip">
            Dev login
          </button>
          {error && <span className="user-menu-note">{error}</span>}
        </form>
      )}
    </div>
  )
}

function LoggedIn({ user }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  // Escape and a click outside close the menu
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    const onDown = (e) => !ref.current?.contains(e.target) && setOpen(false)
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown)
    }
  }, [open])

  return (
    <div className="user-menu" ref={ref}>
      <button type="button" className="chip user-button" onClick={() => setOpen((o) => !o)}>
        <img className="user-avatar" src={avatarUrl(user, 56)} alt="" draggable={false} />
        <span>{user.name}</span>
      </button>
      {open && (
        <div className="user-popup">
          <button type="button" className="chip" onClick={logout}>
            Log out
          </button>
        </div>
      )}
    </div>
  )
}
