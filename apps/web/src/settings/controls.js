// The mouse controls that the Settings popup lists (docs/features/table-tools.md, "Settings menu"). Plain
// words for what the app does, not for TTS. The source is docs/features/key-shortcuts.md: a change of a
// mouse control changes this list in the same step. The keys are not here: the popup builds the key table
// from the bindings (settings/KeyBindings.jsx, input/bindings.js). No React.

export const MOUSE_ROWS = [
  { keys: 'Left click', action: 'Select a piece' },
  { keys: 'Left drag on a selected piece', action: 'Move it' },
  { keys: 'Left or right drag on the table', action: 'Turn the camera' },
  { keys: 'Middle drag', action: 'Move the camera' },
  { keys: 'Shift, Ctrl or Cmd + drag', action: 'Move the camera' },
  { keys: 'Two-finger swipe', action: 'Move the camera' },
  {
    keys: 'Wheel, pinch, Ctrl + wheel',
    action: 'Zoom. While dragging a piece, the wheel turns it',
  },
  { keys: 'Click a tool on the rack', action: 'Put the tool on the table, or take it off' },
  {
    keys: 'Drag a tool from the rack',
    action: 'Put it on the piece or the table point under the pointer',
  },
]
