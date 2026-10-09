// Names of the crisis card and crisis token files in src/assets/crisis/. The keys are in cards.json and tokens.json.
// scripts/migrate-crisis.mjs writes the files with these names.
// Plain functions without Vite imports, so that the script can use them too.

// Face of a crisis card: the side with the text and the setup map
export const crisisCardFace = (key) => `crisis/cards/${key}.webp`
// Back of every crisis card of a type. type: 'secure' | 'extract'
export const crisisCardBack = (type) => `crisis/cards/${type}-back.webp`
// Image of one side of a token
export const crisisToken = (key) => `crisis/tokens/${key}.webp`
// A marker placed on top of a token, for example the damage marker
export const crisisMarker = (key) => `crisis/markers/${key}.webp`
