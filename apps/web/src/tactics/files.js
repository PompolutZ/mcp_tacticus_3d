// Names of the tactic card files in src/assets/tactics/. The keys are in cards.json.
// scripts/migrate-tactics.mjs writes the files with these names.
// Plain functions without Vite imports, so that the script can use them too.

// Back of a tactic card: the name on full-colour art. Every card has its own back.
export const tacticCardBack = (key) => `tactics/${key}-back.webp`
