// UI colors used in more than one place, in JS (3D materials, canvas, inline styles) and in CSS. index.css
// reads them as the --ui-* variables that main.jsx sets from here before the first render, the same way as
// the player colors (sideColors.js). Plain module, so a test can read it.
export const UI_COLORS = {
  trayPlate: '#20242b',
  orange: '#f5a623',
  gold: '#e8b04a',
  goldBright: '#ffd34d',
  border: '#414a61',
  accent: '#3a7de0',
}

const kebab = (name) => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)

// The CSS variables of the colors: { '--ui-tray-plate': '#20242b', ... }
export function uiColorVars() {
  return Object.fromEntries(Object.entries(UI_COLORS).map(([k, v]) => [`--ui-${kebab(k)}`, v]))
}
