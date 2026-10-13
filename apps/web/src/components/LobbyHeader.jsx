import { UserMenu } from './UserMenu.jsx'

// The header of the lobby and of the join page: the title and the login part
export function LobbyHeader() {
  return (
    <header className="lobby-header">
      <div>
        <h1 className="lobby-title">Hero Table 3D</h1>
        <p className="lobby-subtitle">A 3D table to have fun with your favourite superheroes</p>
      </div>
      <UserMenu />
    </header>
  )
}
