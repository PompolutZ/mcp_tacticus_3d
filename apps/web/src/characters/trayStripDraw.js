import { UI_COLORS } from '../uiColors.js'
import { BUTTON_ZONE, INJURED_FILL, INJURED_LINE } from './trayControls.js'

// Canvas drawing of the parts of the 3D controls strip (TrayStrip3D.jsx). The look follows the DOM
// controls (index.css, .tray-counter and .chip), at PX_PER_INCH canvas pixels per inch. Not tested: it
// only paints.
export const PX_PER_INCH = 160

const PANEL = 'rgba(23, 26, 35, 0.92)'
const PANEL_HOVER = 'rgba(42, 48, 66, 0.96)'
const BUTTON = '#1f2330'
const BUTTON_HOVER = '#2a3042'
const LINE = '#2c3242'
const TEXT = '#e6e8ee'
const WARN = '#e2574c'
const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif'

function box(ctx, x, y, w, h, radius, fill, stroke) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, radius)
  ctx.fillStyle = fill
  ctx.fill()
  ctx.lineWidth = 3
  ctx.strokeStyle = stroke
  ctx.stroke()
}

// A chip (Flip, Remove, a gem): text on a rounded box. warn: the Remove color. disabled: faded.
// hover: lighter box and border.
export function drawChip(
  ctx,
  width,
  height,
  { text, warn = false, disabled = false, hover = false },
) {
  const w = width * PX_PER_INCH
  const h = height * PX_PER_INCH
  ctx.clearRect(0, 0, w, h)
  ctx.globalAlpha = disabled ? 0.4 : 1
  const edge = warn ? WARN : hover ? UI_COLORS.border : LINE
  box(ctx, 2, 2, w - 4, h - 4, 12, hover ? BUTTON_HOVER : BUTTON, edge)
  ctx.fillStyle = warn ? WARN : TEXT
  ctx.font = `${0.225 * PX_PER_INCH}px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, w / 2, h / 2 + 2)
  ctx.globalAlpha = 1
}

// A counter: - button, icon, value/max, + button. icon: an image, or null while it loads. hover: the
// part under the pointer ('dec', 'inc', 'body') or null, drawn lighter.
export function drawCounter(
  ctx,
  width,
  height,
  { icon, value, max, warn, injured = false, hover = null },
) {
  const w = width * PX_PER_INCH
  const h = height * PX_PER_INCH
  ctx.clearRect(0, 0, w, h)
  const fill = injured ? INJURED_FILL : hover === 'body' ? PANEL_HOVER : PANEL
  box(ctx, 2, 2, w - 4, h - 4, 14, fill, injured ? INJURED_LINE : LINE)
  const side = h - 0.12 * PX_PER_INCH
  const pad = 0.06 * PX_PER_INCH
  const buttons = [
    ['dec', pad, '−'],
    ['inc', w - pad - side, '+'],
  ]
  for (const [zone, x, label] of buttons) {
    box(
      ctx,
      x,
      pad,
      side,
      side,
      10,
      hover === zone ? BUTTON_HOVER : BUTTON,
      hover === zone ? UI_COLORS.border : LINE,
    )
    ctx.fillStyle = TEXT
    ctx.font = `${0.72 * side}px ${FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, x + side / 2, pad + side / 2 + 2)
  }
  const inner = BUTTON_ZONE * PX_PER_INCH
  const iconSize = 0.34 * PX_PER_INCH
  if (icon) ctx.drawImage(icon, inner + 4, (h - iconSize) / 2, iconSize, iconSize)
  ctx.fillStyle = warn ? WARN : TEXT
  ctx.font = `${warn ? 'bold ' : ''}${0.29 * PX_PER_INCH}px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const textLeft = inner + 4 + iconSize
  ctx.fillText(`${value}/${max}`, (textLeft + w - inner) / 2, h / 2 + 2)
}
