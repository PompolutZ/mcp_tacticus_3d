// Name of the token image file in src/assets/tokens/. The key is in tokens.json.
// scripts/migrate-tokens.mjs writes the files with this name.
// Plain function without Vite imports, so that the script can use it too.
// An affiliation token (key `affiliation-<slug>`, see affiliationTokens.js) has its image in src/assets/affiliations/.
export const AFFILIATION_PREFIX = 'affiliation-'
export const characterToken = (key) =>
  key.startsWith(AFFILIATION_PREFIX)
    ? `affiliations/${key.slice(AFFILIATION_PREFIX.length)}.webp`
    : `tokens/${key}.webp`

// Default width of a character token image, in inches, and the slot size of a tray row. Here and not in
// tokens.js, so plain modules such as characters/trays.js can use it without the JSON import. The mod
// spawns a circle token as a tile with scale tSmall = 0.375, and a tile with scale 1 is 2" wide (see
// scripts/README.md). The other tokens (conditions, Activated, Dazed) are a Custom_Token in TTS,
// whose size was not measured, so they use the same width. Every token image is square.
export const TOKEN_SIZE = 0.75
