import { useEffect, useState } from 'react'
import TacticFaceScaled from '../components/TacticFaceScaled.jsx'
import { faceKeys, loadFaceText } from '../tactics/faceData.js'

// Dev-only page (#tactic-faces, see Root.jsx): the drawn faces of all Team Tactic cards in a grid, with the
// key and the fitted font size under each card, for the layout check. It is not in the production build.
const SMALL = 15
const WIDTH = 274
const HEIGHT = Math.round((WIDTH * 640) / 457)

export default function TacticFaces() {
  const [keys, setKeys] = useState(null)
  // key -> fitted font size, once the card is fitted
  const [sizes, setSizes] = useState({})
  const [onlySmall, setOnlySmall] = useState(false)

  useEffect(() => {
    loadFaceText().then(() => setKeys(faceKeys()))
  }, [])

  if (!keys) return <p style={{ padding: 16 }}>Loading the card text</p>

  const fitted = Object.keys(sizes)
  const small = fitted.filter((k) => sizes[k] < SMALL)
  return (
    <div
      style={{ padding: 16, height: '100vh', overflow: 'auto', background: '#222', color: '#eee' }}
    >
      <div style={{ position: 'sticky', top: 0, zIndex: 5, background: '#222', paddingBottom: 8 }}>
        <label>
          <input
            type="checkbox"
            checked={onlySmall}
            onChange={(e) => setOnlySmall(e.target.checked)}
          />{' '}
          font &lt; {SMALL} px
        </label>
        <span style={{ marginLeft: 16 }}>
          {fitted.length} / {keys.length} fitted, {small.length} under {SMALL} px
        </span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        {keys.map((key) => {
          const size = sizes[key]
          const hidden = onlySmall && size !== undefined && size >= SMALL
          return (
            <div key={key} style={{ width: WIDTH, display: hidden ? 'none' : 'block' }}>
              <div style={{ position: 'relative', width: WIDTH, height: HEIGHT, borderRadius: 8 }}>
                <TacticFaceScaled
                  tacticKey={key}
                  onReady={(s) =>
                    setSizes((prev) => (prev[key] === s ? prev : { ...prev, [key]: s }))
                  }
                />
              </div>
              <div style={{ fontSize: 12, color: size < SMALL ? '#ff8a80' : '#aaa' }}>
                {key}: {size === undefined ? '...' : `${size} px`}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
