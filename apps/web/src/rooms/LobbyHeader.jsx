import { UserMenu } from '../auth/UserMenu.jsx'
import { Burst } from './Burst.jsx'
import './comicTheme.js'

// The header of the lobby and of the join page: the logo and the login part. The logo is the page's
// only h1 and links to the lobby.
export function LobbyHeader() {
  return (
    <header className="lobby-header">
      <h1 className="lobby-logo-heading">
        <a className="lobby-logo" href="#">
          <span className="lobby-title">Hero Table</span>
          <Burst size={64}>3D</Burst>
        </a>
      </h1>
      <UserMenu />
    </header>
  )
}
