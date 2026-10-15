import { useLook } from './look.js'

// The material of the face (image) of a card or a token. It is the one place that sets the look of
// all card and token faces. The surface comes from the look store. The default is Unlit, and debug
// mode can switch it to compare (see docs/plans/playtest/playtest-1-bugs.md). Other props (side, alphaTest,
// transparent, attach) go to the material.
export default function FaceMaterial({ map, ...props }) {
  const { surface } = useLook()
  if (surface === 'matte') {
    return <meshPhysicalMaterial map={map} roughness={1} specularIntensity={0} {...props} />
  }
  if (surface === 'unlit') {
    return <meshBasicMaterial map={map} toneMapped={false} {...props} />
  }
  return <meshStandardMaterial map={map} roughness={1} {...props} />
}
