# Plan: User key bindings

Requested on 2026-10-13. The user wants to change which key or mouse input does each action. The settings stay in localStorage of the browser. In TTS, the mouse wheel also turns a piece (the same as Q / E), so the wheel must be an input that can be bound. Then one action can have several inputs. A binding can also depend on where the pointer is, for example over the dice tray or over a piece.

## Facts

Checked on 2026-10-13:
- `keyAction` in `src/keyboard.js` is the only key dispatcher. One `keydown` listener on `window` runs it (`useWindowKeys`, `useTableKeys.js`). The keys are constants at the top of the file. The user cannot change them.
- Held keys (pan, turn, Q / E) are kept in `heldPan`, `heldTurn`, `heldRotate` in `useTableKeys.js`. Keyup and window blur clear them.
- Number keys use `e.key`, so the number row and the number pad both work. The other keys use `e.code`.
- Over the own dice tray, 1–9 and 0 add dice. Elsewhere they spawn tools. `useHovered.js` keeps `diceTray`, `piece`, `held` and more as refs.
- The wheel is in `src/components/WheelCamera.jsx`: mouse wheel zooms, trackpad swipe pans, pinch and Ctrl + wheel zoom. The device is a guess from the deltas. During a piece drag the wheel does nothing.
- Settings: `src/settings/settings.js`, key `mcp-assist-3d/settings`, `normalize()` fills defaults. The Settings popup (`SettingsPopup.jsx`) shows a read-only list from `src/settings/controls.js`.

## Decisions

1. **Action list is fixed in code.** Each action has an id, a label, and a list of default bindings. The user changes only the bindings. Every action that a key or the wheel triggers today can be bound:
   - Camera: pan up / down / left / right, turn up / down / left / right, reset view, zoom in / out.
   - Pieces: turn left / right, flip, lift, lock, delete, ping, card peek (held).
   - Tools: range 1–5, toward / away, short / medium / long move, clear tools.
   - Dice: add 1–9 dice, add 10 dice.
   - Other: cancel / close (today Escape), previous / next card in the roster popup.
2. **A binding is an input, modifiers, and a condition.**
   - Input: a key code (`KeyQ`, `Digit1`, `Numpad1`, …), or `WheelUp` / `WheelDown`.
   - Modifiers: any set of Shift, Ctrl, Alt, Cmd (Meta). Stored as `{ code, shift, ctrl, alt, meta }`.
   - A modifier key alone can be an input too (`AltLeft`, `AltRight`), for a held action like the card peek.
   - Condition, from a short fixed list: `anywhere`, `overPiece` (over a piece or dragging one), `dragging` (dragging a piece), `overDiceTray` (over the own dice tray), `popup` (a popup is open).
   - Each action allows only the conditions that make sense. Example: add dice allows only `overDiceTray`. Turn piece allows `overPiece` and `dragging`. Next card allows only `popup`.
3. **Same input, several bindings.** An input can have several bindings with different conditions. At the press, the app takes the binding whose condition is true now, in this order: `popup`, `dragging`, `overDiceTray`, `overPiece`, `anywhere`. So `Digit1` over the dice tray adds a die, else it spawns Range 1, as now.
4. **Modifiers match exactly.** `Shift+Q` does not trigger the `Q` binding, and `Q` does not trigger `Shift+Q`. So the user can bind Q and Shift+Q to different actions.
5. **Held actions** (pan, turn the camera, turn a piece, card peek) end at the keyup of the main key. A modifier released earlier does not end them. Window blur ends all.
6. **Conflict:** two actions cannot have the same input, modifiers and condition. When the user binds an input that is taken, the old binding is removed and the popup says which action lost it.
7. **Combos the browser keeps.** The browser or macOS handles some combos before the page, for example Cmd+W, Cmd+Q, Cmd+T, Cmd+Tab. The page cannot use them. The capture refuses a combo from a short list of these and says why. Other Cmd and Ctrl combos call `preventDefault` when bound.
8. **Defaults are the keys of today, plus the wheel:**
   - `WheelUp` / `WheelDown` with `anywhere`: zoom.
   - `WheelUp` / `WheelDown` with `dragging`: turn the dragged piece 15° per wheel step, as TTS. Over a piece that is not dragged, the wheel still zooms, as TTS.
   - Number keys: both `Digit` and `Numpad` codes, so the number pad still works.
   - Escape: cancel / close. Alt (either side): card peek. ← → with `popup`: previous / next card.
9. **Wheel input means the mouse wheel only.** A trackpad swipe still pans and a pinch still zooms. These are not bindable. The device guess of `WheelCamera.jsx` stays. A pinch sends the wheel with `ctrlKey` set, so Ctrl + wheel stays zoom and cannot be bound. Shift + wheel can be bound. Some browsers send Shift + wheel as a sideways scroll (`deltaX`), so the app reads `deltaX` when `deltaY` is 0.
10. **Mouse buttons and drags are not bindable.** They are not hotkeys. The Settings popup lists them read-only, as now.
11. **No library.** The libraries (tinykeys, hotkeys-js, mousetrap) match a key combo to a callback. They do not give the parts this plan needs: the wheel, the conditions and their order, held keys with keyup, and the capture in the popup. Matching a combo is a compare of `e.code` and 4 flags, so own code is simpler than a library plus glue.
12. **Storage:** `settings.js` gets `bindings: { [actionId]: [{ code, shift, ctrl, alt, meta, when }] }`. Only actions the user changed are stored. Every other action uses its defaults, so a new action in a later version gets its default keys. `normalize()` drops unknown actions, inputs and conditions.
13. **Settings popup:** the key table becomes editable. Each action row shows its bindings as chips (combo + condition). A chip has × to remove it. **+** starts capture: the next key press (with its modifiers) or wheel step is the input, then a select picks the condition. Any key can be captured, Escape too. A **Cancel** button ends the capture. Each row has **Reset**, and the popup has **Reset all keys**, so a user who unbinds cancel / close can still fix it with the mouse. The popup itself always closes with its close button.

## Steps

### Step 1: Binding table and resolver

No visible change.
- New `src/input/bindings.js`: the action list, the default bindings, the condition list, and `resolve(input, state)`, which returns the action id or null.
- `keyAction` uses `resolve` for every key: Escape, Alt and the roster arrows too. The text field guard stays. The token and tool drag guards stay: during such a drag only cancel works.
- Combo matching with modifiers. The guard "Ctrl, Alt or Cmd held: do nothing" goes away. A combo with no binding still does nothing.
- `useTableKeys.js`: the held maps use action ids, not key codes.
- `settings.js`: `bindings` field, `normalize`, merge with defaults.
- Tests: `bindings.test.js` (defaults give today's actions for every key of today, condition order, exact modifier match, held action ends at main keyup, conflicts), `settings.test.js` (store, drop unknown).
- Checks: `pnpm format`, `pnpm lint`, tests, `pnpm --filter web build`.

### Step 2: Wheel as an input

- `WheelCamera.jsx`: for a mouse wheel step, call `resolve` with `WheelUp` / `WheelDown` and the modifiers of the event. Zoom when it gives zoom. During a drag it is called too, so it can turn the dragged piece.
- `Scene.jsx`: one turn step from a wheel step, the same 15° and smoothing as Q / E.
- Tests for the wheel bindings in `bindings.test.js`.
- `docs/features/key-shortcuts.md`: Mouse table and wheel section: the wheel turns a dragged piece.
- Checks as in step 1.

### Step 3: Editable bindings in the Settings popup

- `SettingsPopup.jsx` and a new `KeyBindings.jsx`: rows, chips, capture, condition select, conflict message, reset.
- While capture is on, the table keys do nothing (the popup is open, so this is already true).
- `controls.js`: the key list comes from the bindings, not from text. The mouse list stays.
- Input names for the chips: `KeyQ` shows `Q`, `Digit1` shows `1`, `Numpad1` shows `Num 1`, `WheelUp` shows `Wheel up`. Modifiers on a Mac: `⇧ ⌃ ⌥ ⌘`, else `Shift Ctrl Alt Win`.
- The capture refuses the combos of decision 7.
- `docs/features/key-shortcuts.md`: a section "Changing the keys": the binding model, the conditions, the order, the defaults.
- `docs/features/table-tools.md`, "Settings menu": the `bindings` field in the localStorage schema.
- Checks as in step 1.

## Results

### Step 1

Done. `src/input/bindings.js`: actions, defaults (number keys as Digit and Numpad, zoom on WheelUp / WheelDown as data), `match` / `resolve`, `effectiveBindings`, `changedBindings`, `findConflicts`, `cleanBinding`. `keyAction` uses it for every key and now also returns `id` (action id). Held maps in `useTableKeys.js` are by action id, `heldBy` maps the main key code to the action. `settings.bindings` stores only changed actions. `useSettings` gives `bindings` (in use) and `handleBindingsChange`; App passes them and `overPiece` in the key state.
- Differs: the wheel turn of a dragged piece (decision 8) is not a default yet, step 2 adds it. During a drag only cancel works, as before. Cancel allows `anywhere`, `popup`, `dragging`. A modifier with Escape or Alt is now unbound (exact match).

### Step 2

Done. `bindings.js`: `WheelUp` / `WheelDown` with `dragging` are default bindings of turn piece left / right (up = left, picked by look). `WheelCamera.jsx` takes `wheelState()` (App builds it, same state as the keys) and `onTurn(dir)` (App calls `turnPieceRef`, so Scene's `turnPiece` is reused). A mouse wheel step resolves with the Shift, Alt and Cmd flags; zoom or turn runs. Tests in `bindings.test.js`.
- Differs: zoom during a drag stays off even when bound (OrbitControls is off and the view stays still). A trackpad swipe and Ctrl + wheel also do nothing during a drag, as before.

### Step 3

Done. `KeyBindings.jsx` (rows by group, chips, + capture, condition select, Reset, Reset all keys, conflict message) in `SettingsPopup.jsx`. Capture uses window `keydown` / `keyup` listeners in the capture phase with `stopImmediatePropagation`, so App's key handler and the popup Escape do not run. The wheel is read on the capture box. `bindings.js`: `RESERVED` and `reservedReason`, `codeName` / `inputName` (pure, `mac` argument), `detectMac`, `acceptsInput`. `controls.js` keeps only `MOUSE_ROWS`. Tests in `bindings.test.js`.
- Differs: the wheel is refused for actions other than zoom and turn piece, and zoom takes only the wheel (no key handler for zoom exists). A reserved combo or a refused input keeps the capture on. Reserved check ignores Shift and Alt.

- Fix after test: chips always show the condition except `anywhere`; `anywhere` shows "elsewhere" when the same input has another condition in any action (`boundElsewhere`).
