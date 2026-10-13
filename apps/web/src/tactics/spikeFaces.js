import { assetUrl } from '../assets/index.js'
import { tacticCardBack } from './files.js'
import FACES from './spike-faces.json'

// Spike: the cards whose face is drawn by components/TacticFace.jsx from Jarvis data, not loaded as a
// scan. Keys are the keys of cards.json.
export const spikeFace = (key) => FACES[key] ?? null

// The art under the face: the back image of the card
export const spikeFaceArt = (key) => assetUrl(tacticCardBack(key))
