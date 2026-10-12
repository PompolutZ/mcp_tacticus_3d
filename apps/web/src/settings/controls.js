// The keys and the mouse controls that the Settings popup lists (docs/features/table-tools.md, "Settings
// menu"). Plain words for what the app does, not for TTS. The source is docs/features/key-shortcuts.md: a
// change of a key changes this list in the same step. No React.

export const KEY_ROWS = [
  { keys: 'W A S D', action: 'Move the camera' },
  { keys: 'Arrow keys', action: 'Turn the camera around the point it looks at' },
  { keys: 'Space', action: 'Camera back to the start view' },
  { keys: '1 2 3 4 5', action: 'Range tool, on the piece under the pointer. Again: take it off' },
  { keys: '6', action: 'Toward / Away tool, on the piece under the pointer' },
  { keys: '7 8 9', action: 'Short, medium or long move tool, on the piece under the pointer' },
  { keys: '0', action: 'Take every tool off the table' },
  { keys: '1 – 9, 0 over your dice tray', action: 'Add that many dice (0 adds 10)' },
  { keys: 'Q / E', action: 'Turn the piece under the pointer or the dragged piece left or right' },
  { keys: 'F', action: 'Flip the token or card under the pointer' },
  { keys: 'R', action: 'Lift the model under the pointer, or put it down' },
  { keys: 'P', action: 'Ping: an arrow at the pointer that both players see and hear' },
  { keys: 'L', action: 'Lock or unlock the terrain piece under the pointer' },
  { keys: 'Delete / Backspace', action: 'Delete the piece under the pointer' },
  {
    keys: 'Escape',
    action: 'Close a popup or menu, cancel a drag, else clear the selection and the tools',
  },
  { keys: '← →', action: 'Previous or next card in the roster popup' },
]

export const MOUSE_ROWS = [
  { keys: 'Left click', action: 'Select a piece' },
  { keys: 'Left drag on a selected piece', action: 'Move it' },
  { keys: 'Left or right drag on the table', action: 'Turn the camera' },
  { keys: 'Middle drag', action: 'Move the camera' },
  { keys: 'Shift, Ctrl or Cmd + drag', action: 'Move the camera' },
  { keys: 'Two-finger swipe', action: 'Move the camera' },
  { keys: 'Wheel, pinch, Ctrl + wheel', action: 'Zoom' },
  { keys: 'Click a tool on the rack', action: 'Put the tool on the table, or take it off' },
  {
    keys: 'Drag a tool from the rack',
    action: 'Put it on the piece or the table point under the pointer',
  },
]
