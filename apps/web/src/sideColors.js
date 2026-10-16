// The color of each side, { host: 'blue' | 'red', guest: 'blue' | 'red' }. A side key is a seat (+z or -z), not
// a color. The color comes from colorOf in setup/setup.js (docs/features/setup-game.md, "Colors"). App.jsx
// computes it from the setup and writes it to the store of the table (table/tableStore.js), read with
// table/useSideColors.jsxx. The default is the colors before the roll off.
export const DEFAULT_SIDE_COLORS = { host: 'blue', guest: 'red' }
export const COLOR_NAME = { blue: 'Blue', red: 'Red' }
// The hex color of a color, for texts, rings and markers
export const COLOR_HEX = { blue: '#2980b9', red: '#c0392b' }

// The CSS variables of the two colors, set on the document root by main.jsx (index.css reads them)
export function playerColorVars() {
  return { '--player-blue': COLOR_HEX.blue, '--player-red': COLOR_HEX.red }
}

// The hex string as a number, for three.js
export const hexNumber = (hex) => parseInt(hex.slice(1), 16)
