import { assetUrl } from '../assets/index.js'
import { crisisMarker } from '../crisis/files.js'
import { characterToken } from '../tokens/files.js'

// Damage and Power reuse the mod's own counter tokens ("1 Damage", "1 Power"), see
// docs/features/character-trays.md, "Tokens from the TTS mod". The DOM controls (TrayControls.jsx) and
// the 3D strip (TrayStrip3D.jsx) draw the same images.
export const COUNTER_ICONS = {
  damage: assetUrl(crisisMarker('damage')),
  power: assetUrl(characterToken('1-power')),
}
