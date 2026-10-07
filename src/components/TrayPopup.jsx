import { useEffect, useState } from 'react'
import { assetUrl } from '../assets/index.js'
import { characterCard, transformCard } from '../characters/files.js'
import { trayCards } from '../characters/models.js'
import { characterName, characterStamina } from '../characters/roster.js'
import { HELD_SIZE_U, trayHeldCardPoint } from '../characters/trays.js'
import { tokenInfo } from '../crisis/cards.js'
import { crisisToken } from '../crisis/files.js'
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
// are not here. The objective tokens the character holds show on the card image, at the same place
// as on the 3D card. They only show here: a player moves or drops them on the 3D card. Closes with
// the cross button or a click outside the tray. App also closes it on
// Escape, as App handles all keys. A dialog, so it renders through Overlay (see CardPopup.jsx).
// App mounts it only while a tray is open. onTokenRemove(key): a click on an "On" token removes
// one, the same as on the 3D tray. heldTokens: the crisis tokens this character holds. A character
// whose second form has its own card shows that card under the first, as on the 3D tray; the held
// tokens lie on the first card.
export function TrayPopup({ character, heldTokens, onClose, onDamage, onPower, onFlip, onRemove, onTokenRemove }) {
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
        <div className="tray-popup-card">
          <img src={assetUrl(characterCard(character.key, shownSide))} alt={name} />
          {heldTokens.map(token => <HeldToken key={token.id} token={token} />)}
        </div>
        {trayCards(character) === 2 && (
          <div className="tray-popup-card">
            <img src={assetUrl(transformCard(character.key, shownSide))} alt={`${name}, second form`} />
          </div>
        )}
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

// A crisis token the character holds, on the card image, the face that is up. Its place on the
// image is its place on the 3D card (trays.js, heldAt), as a percentage of the image size.
function HeldToken({ token }) {
  const key = token.up === 'front' ? token.frontKey : (token.backKey ?? token.frontKey)
  const name = tokenInfo(key)?.name ?? key
  const { u, v } = trayHeldCardPoint(token.heldAt)
  const style = { left: `${u * 100}%`, top: `${v * 100}%`, width: `${HELD_SIZE_U * 100}%` }
  return <img className="tray-popup-held" src={assetUrl(crisisToken(key))} alt={name} title={name} style={style} />
}
