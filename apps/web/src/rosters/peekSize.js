// The size of the Alt peek card (docs/features/key-shortcuts.md, "Alt"). No React.
import { MAX_PEEK_SIZE, MIN_PEEK_SIZE } from '../settings/settings.js'

// The card fills at most this part of the window at size 1: a margin around it
const WINDOW_FILL = 0.9
// One mouse wheel step multiplies the size by this. Picked by look.
export const PEEK_WHEEL_FACTOR = 1.1
// A trackpad swipe or pinch event multiplies the size by e^(-deltaY × PEEK_TRACKPAD_RATE). Picked by look.
export const PEEK_TRACKPAD_RATE = 0.01

// The card box in px. size: part of the largest box that fits the window for this aspect ratio
// (width / height), so a tall card is limited by the window height and a wide one by the width.
export function peekBox({ windowWidth, windowHeight, aspect, size }) {
  const maxWidth = Math.min(windowWidth * WINDOW_FILL, windowHeight * WINDOW_FILL * aspect)
  const width = maxWidth * size
  return { width, height: width / aspect }
}

// The size after a wheel input. amount: the log of the size factor (above 0 is bigger).
export function zoomPeekSize(size, amount) {
  return Math.min(MAX_PEEK_SIZE, Math.max(MIN_PEEK_SIZE, size * Math.exp(amount)))
}
