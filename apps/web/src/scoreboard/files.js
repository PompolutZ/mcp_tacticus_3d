// Names of the scoring board files in src/assets/. scripts/migrate-scoreboard.mjs writes the files with these
// names. Plain module without Vite imports, so that the script can use it too.

// The board ("Tracker" in the mod) and its texture
export const BOARD_MESH = 'scoreboard/board.glb'
export const BOARD_TEXTURE = 'scoreboard/board.webp'
// The round marker ("Round Tracker" in the mod). It has no texture, only a tint (see board.js).
export const ROUND_MESH = 'scoreboard/round.glb'
// Affiliation token image. The key is in src/scoreboard/affiliations.json.
export const affiliationToken = (key) => `affiliations/${key}.webp`
