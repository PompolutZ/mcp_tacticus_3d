import { UserMenu } from './UserMenu.jsx'

// The header of the lobby and of the join page: the title and the login part
export function LobbyHeader() {
  return (
    <header className="lobby-header">
      <div>
        <h1 className="lobby-title">MCP Assist 3D</h1>
        <p className="lobby-subtitle">A game table for Marvel Crisis Protocol</p>
      </div>
      <UserMenu />
    </header>
  )
}
