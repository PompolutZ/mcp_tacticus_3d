import { useEffect, useState } from 'react'
import { assetUrl } from '../assets/index.js'
import { characterCard } from '../characters/files.js'
import { characterName, characterStamina } from '../characters/roster.js'
import { characterToken } from '../tokens/files.js'
import { getToken } from '../tokens/tokens.js'
import { Overlay } from './Overlay.jsx'
import TrayControls from './TrayControls.jsx'

function otherSide(side) {
  return side === 'healthy' ? 'injured' : 'healthy'
}

// The whole character tray in a full-screen popup, opened by a click on the tray card (see
// CharacterTray.jsx): the "On" row of tokens, the stat card at full size, and the same controls as
// the 3D tray (TrayControls.jsx). It shows the live character from App state, so a change here or
// on the 3D tray shows in both. The Give sources are not part of the tray (see trays.js), so they
// are not here. Closes with the cross button or a click outside the tray. App also closes it on
// Escape, as App handles all keys. A dialog, so it renders through Overlay (see CardPopup.jsx).
// App mounts it only while a tray is open. onTokenRemove(key): a click on an "On" token removes
// one, the same as on the 3D tray.
export function TrayPopup({ character, heldTokens, onClose, onDamage, onPower, onFlip, onRemove, onTokenRemove, onTokenDrop }) {
  // The other side of the card, shown with a button, because players often read the Injured side
  // while the card is Healthy. A Flip starts again on the side that faces up.
  const [showOther, setShowOther] = useState(false)
  useEffect(() => { setShowOther(false) }, [character.side])

  const name = characterName(character.key)
  const shownSide = showOther ? otherSide(character.side) : character.side
  // Tokens on the character, in the order it got them (see App.jsx, handleCharacterTokenGive).
  const onTokens = Object.entries(character.tokens ?? {})

  return (
    <Overlay className="card-popup" onClick={onClose}>
      <div className="tray-popup" role="dialog" aria-modal="true" aria-label={name} onClick={e => e.stopPropagation()}>
        <div className="tray-popup-top">
          <div className="tray-popup-on">
            {onTokens.map(([key, count]) => (
              <OnToken key={key} tokenKey={key} count={count} onClick={() => onTokenRemove(key)} />
            ))}
          </div>
          <button type="button" className="tray-popup-close" aria-label="Close" onClick={onClose}>×</button>
        </div>
        <img className="tray-popup-card" src={assetUrl(characterCard(character.key, shownSide))} alt={name} />
        <button type="button" className="chip" onClick={() => setShowOther(v => !v)}>
          {showOther ? 'Show side that faces up' : 'Show other side'}
        </button>
        <TrayControls
          character={character}
          stamina={characterStamina(character.key, character.side)}
          onDamage={onDamage}
          onPower={onPower}
          onFlip={onFlip}
          onRemove={onRemove}
          heldTokens={heldTokens}
          onTokenDrop={onTokenDrop}
        />
      </div>
    </Overlay>
  )
}

// A token on the character, with a count badge when the count is above 1. The tooltip shows its
// name and the mod's description, the same as the label of a 3D token (TokenFace.jsx).
function OnToken({ tokenKey, count, onClick }) {
  const token = getToken(tokenKey)
  const name = token?.name ?? tokenKey
  const title = token?.description ? `${name}: ${token.description} (click to remove one)` : `${name} (click to remove one)`
  return (
    <button type="button" className="tray-popup-token" title={title} onClick={onClick}>
      <img src={assetUrl(characterToken(tokenKey))} alt={name} draggable={false} />
      {count > 1 && <span className="tray-popup-token-count">{count}</span>}
    </button>
  )
}
