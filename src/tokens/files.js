// Name of the token image file in src/assets/tokens/. The key is in tokens.json.
// scripts/migrate-tokens.mjs writes the files with this name.
// Plain function without Vite imports, so that the script can use it too.
export const characterToken = key => `tokens/${key}.webp`
