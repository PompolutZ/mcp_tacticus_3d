import { useLayoutEffect, useRef, useState } from 'react'
import TacticFace, { FACE_WIDTH } from './TacticFace.jsx'

// A Team Tactic face scaled to the width of its parent. The parent sets the size (the 2.5 x 3.5 shape)
// and clips nothing: this fills it. The scale follows the parent's width.
export default function TacticFaceScaled({ tacticKey, onReady }) {
  const ref = useRef(null)
  const [scale, setScale] = useState(0)

  useLayoutEffect(() => {
    const el = ref.current
    const update = () => setScale(el.clientWidth / FACE_WIDTH)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      style={{ position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: 'inherit' }}
    >
      {scale > 0 && (
        <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}>
          <TacticFace tacticKey={tacticKey} onReady={onReady} />
        </div>
      )}
    </div>
  )
}
