import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'

// A tool rests this long (no change of pose, bend, snap or mode) before it is written to the document
export const REST_TIME = 0.3

// Writes the stored fields of a tool once none of them changed for REST_TIME. read() runs on every frame, because
// the pose is in the body, not in React state. It gives { cur, entry, onStore }: the fields now, the entry in the
// document and the writer, or null while there is nothing to write. same(a, b): true when two sets of fields are
// equal (entry may have missing fields).
export function useRestStore(read, same) {
  const rest = useRef({ seen: null, time: 0, written: false })
  useFrame((_, dt) => {
    const now = read()
    if (!now) return
    const { cur, entry, onStore } = now
    const r = rest.current
    if (!r.seen || !same(cur, r.seen)) {
      rest.current = { seen: cur, time: 0, written: false }
      return
    }
    r.time += dt
    if (r.written || r.time < REST_TIME || same(cur, entry)) return
    r.written = true
    onStore(cur)
  })
}
