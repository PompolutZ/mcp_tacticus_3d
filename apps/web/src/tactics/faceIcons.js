import { assetUrl } from '../assets/index.js'

// Face icons: the Jarvis PNGs as lossless WebP in src/assets/tactic-icons/, named by meaning.
// A later step can replace a file with an SVG without a change in the component.

// Jarvis icon id (the x of `!x` in a body text) -> file name. Jarvis draws the movement icons
// with the range icons. An id that is not here ("Ulik") draws as text, see faceBody.js.
const BODY_ICONS = {
  active: 'active',
  block: 'block',
  critical: 'critical',
  damage: 'damage',
  energy: 'energy',
  failure: 'failure',
  hit: 'hit',
  innate: 'innate',
  leadership: 'leadership',
  movement_large: 'range-large',
  movement_medium: 'range-medium',
  movement_small: 'range-small',
  mystic: 'mystic',
  physical: 'physical',
  power: 'power',
  range: 'range',
  range_large: 'range-large',
  range_medium: 'range-medium',
  range_small: 'range-small',
  reactive: 'reactive',
  size: 'size',
  speed: 'speed',
  threat: 'threat',
  vp: 'vp',
  wild: 'wild',
}

// Other icons of the template, by file name: range, stat-strength, stat-cost, feather.

// URL of a face icon (assets/tactic-icons/<file>.webp), or null when there is none
export function faceIconUrl(file) {
  try {
    return assetUrl(`tactic-icons/${file}.webp`)
  } catch {
    return null
  }
}

// URL of the icon of a body text id, or null for an id without an icon
export const bodyIconUrl = (id) => (BODY_ICONS[id] ? faceIconUrl(BODY_ICONS[id]) : null)

// True when the id has an icon
export const hasBodyIcon = (id) => Object.hasOwn(BODY_ICONS, id)
