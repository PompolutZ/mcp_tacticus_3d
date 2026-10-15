import { test } from 'node:test'
import assert from 'node:assert/strict'
import { UI_COLORS, uiColorVars } from './uiColors.js'

test('uiColorVars: one --ui-* variable per color, kebab case', () => {
  const vars = uiColorVars()
  assert.equal(Object.keys(vars).length, Object.keys(UI_COLORS).length)
  assert.equal(vars['--ui-tray-plate'], '#20242b')
  assert.equal(vars['--ui-gold-bright'], '#ffd34d')
})
