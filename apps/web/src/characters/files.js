// Names of the character files in src/assets/characters/<key>/, and the base sizes. The key is in characters.json.
// scripts/migrate-characters.mjs writes the files with these names.
// Plain functions without Vite imports, so that the script can use them too.

const dir = key => `characters/${key}`
// n > 1 only for a character with more than one version in the mod (for example Mephisto: two cards, two models)
const version = n => (n > 1 ? `-${n}` : '')

// 3D model n (from 1): GLB
export const characterModel = (key, n = 1) => `${dir(key)}/model${version(n)}.glb`
// Standee image of a character without a 3D model. side: 'front' | 'back'
export const characterStandee = (key, side) => `${dir(key)}/standee-${side}.webp`
// Stat card n (from 1). side: 'healthy' | 'injured'
export const characterCard = (key, side, n = 1) => `${dir(key)}/card${version(n)}-${side}.webp`
// Portrait of the mod's roster UI
export const characterPortrait = key => `${dir(key)}/portrait.webp`
// Second form (for example Emma Frost in Diamond Form): a 3D model or a standee
export const transformModel = key => `${dir(key)}/transform.glb`
export const transformStandee = (key, side) => `${dir(key)}/transform-standee-${side}.webp`
export const transformPortrait = key => `${dir(key)}/transform-portrait.webp`
// Stat card of a second form that has its own card (the mod's cTCard, for example Emma Frost in Diamond Form).
// side: 'healthy' | 'injured'
export const transformCard = (key, side) => `${dir(key)}/transform-card-${side}.webp`

// Base diameters in inches, by the mod's cBase names. These are the 35, 50 and 65 mm bases of the game.
export const BASE_DIAMETER = { small: 1.37795, medium: 1.9685, large: 2.55906 }
