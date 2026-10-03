import { useMemo } from 'react'
import { TOKEN_EDGE_COLOR, tokenSolidGeometry } from '../tokens/solid.js'

// A token as a solid (see tokens/solid.js), `size` inches wide, with its bottom at y = 0: the image on
// the top and bottom faces, edgeColor on the edge. Other props go to the mesh, for example pointer events.
// The geometry is shared and cached, so it is passed as a prop and not created here.
export default function TokenSolid({ map, size, edgeColor = TOKEN_EDGE_COLOR, ...props }) {
  const geometry = useMemo(() => tokenSolidGeometry(map, size), [map, size])
  return (
    <mesh geometry={geometry} {...props}>
      <meshStandardMaterial attach="material-0" map={map} roughness={1} />
      <meshStandardMaterial attach="material-1" color={edgeColor} roughness={0.6} />
    </mesh>
  )
}
