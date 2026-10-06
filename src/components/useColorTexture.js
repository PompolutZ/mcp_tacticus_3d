import { useTexture } from '@react-three/drei'
import { SRGBColorSpace } from 'three'

// useTexture for color images (cards, tokens), with every texture marked as sRGB. input: one URL or
// a list of URLs, the same as useTexture.
// drei's useTexture sends every loaded texture to the GPU at once (gl.initTexture). R3F marks a
// texture as sRGB only when it is assigned to a material map. So a texture that is not on a map at
// that moment (the back of a card that lies face up) goes to the GPU as linear. three.js sends a
// texture again only when texture.version changes, not when its colorSpace changes. The shader then
// reads the sRGB colors as linear, and the image looks too light after a flip.
// This hook marks the textures during render, before drei sends them to the GPU.
export function useColorTexture(input) {
  const textures = useTexture(input)
  for (const texture of [textures].flat()) {
    if (texture.colorSpace === SRGBColorSpace) continue
    texture.colorSpace = SRGBColorSpace
    // A texture that is already on the GPU as linear goes there again
    texture.needsUpdate = true
  }
  return textures
}
