import { useState } from 'react'

// Warnings that stay until the player closes them. storageFailed: the room could not use IndexedDB.
// serverWarning: the text of the server warning, or null. versionMismatch: the other player uses another
// version. schemaMismatch: the other player's table data version differs, so the table does not sync. lifted: the phase buttons are in the bottom right corner, so the warnings stack above them.
// softwareRenderer: the name of the WebGL renderer when it runs on the CPU, or null.
export function HudWarnings({
  lifted = false,
  storageFailed,
  serverWarning,
  versionMismatch,
  schemaMismatch,
  softwareRenderer,
  onSoftwareRendererClose,
}) {
  // The room could not use IndexedDB (storageFailed), and the player has not closed the warning yet
  const [storageWarning, setStorageWarning] = useState(storageFailed)
  // The server warning text that the player closed. A new text shows again.
  const [closedServerWarning, setClosedServerWarning] = useState(null)
  // The player closed the version warning (docs/features/peer-to-peer.md, "Connect flow"). It shows again after the next mismatch.
  const [versionClosed, setVersionClosed] = useState(false)
  if (!versionMismatch && versionClosed) setVersionClosed(false)
  return (
    <div className={`hud-warnings${lifted ? ' hud-warnings--lifted' : ''}`}>
      {storageWarning && (
        <div className="hud-warning" role="alert">
          <span>
            Room not saved: browser storage is not available. Changes on this table are lost when
            the page closes.
          </span>
          <button type="button" className="chip" onClick={() => setStorageWarning(false)}>
            Close
          </button>
        </div>
      )}
      {serverWarning && serverWarning !== closedServerWarning && (
        <div className="hud-warning" role="alert">
          <span>{serverWarning}</span>
          <button
            type="button"
            className="chip"
            onClick={() => setClosedServerWarning(serverWarning)}
          >
            Close
          </button>
        </div>
      )}
      {schemaMismatch && (
        <div className="hud-warning" role="alert">
          <span>
            Your opponent uses a different version of the table data. The table does not sync. Both
            players should reload the page.
          </span>
        </div>
      )}
      {versionMismatch && !schemaMismatch && !versionClosed && (
        <div className="hud-warning" role="alert">
          <span>
            Your opponent uses a different version of the app. Both players should reload the page.
          </span>
          <button type="button" className="chip" onClick={() => setVersionClosed(true)}>
            Close
          </button>
        </div>
      )}
      {softwareRenderer && (
        <div className="hud-warning" role="alert" title={softwareRenderer}>
          <span>
            The browser draws the 3D view without the graphics card (software rendering), so the app
            is slow. Turn on hardware acceleration in the browser settings.
          </span>
          <button type="button" className="chip" onClick={onSoftwareRendererClose}>
            Close
          </button>
        </div>
      )}
    </div>
  )
}
