# Feature: Key and mouse controls as in TTS

Status: partly built.

Not built yet:

- The TTS keys that the tables mark "No", and the points of [Differences to decide](#differences-to-decide).

## Goal

The users of the app are active TTS players. They already know the TTS controls. Therefore the app uses the same keys and mouse buttons as TTS wherever the app has the same action. Then a player does not have to learn new controls.

## Sources

- **TTS bindings.** TTS stores its key bindings (the cInput library) in `~/Library/Preferences/com.berserk-games.tabletop-simulator.plist`. Read them with `defaults read com.berserk-games.tabletop-simulator <key>`. `cInput_descr` has the action names. `cInput_modifierStr` has the main key of each action, at the same index. `cInput_alt_modifierStr` and `cInput_alt_inpStr` have the second binding. `cInput_defaults` has the defaults. Read on 2026-10-02.
- **TTS knowledge base.** [Basic controls](https://kb.tabletopsimulator.com/player-guides/basic-controls/) and [advanced controls](https://kb.tabletopsimulator.com/player-guides/advanced-controls/). They describe the mouse buttons and the number keys.
- **The mod.** `onScriptingButtonDown` in the Blue/Red Tool Tray and Blue/Red Dice Tray scripts (`Mods/Workshop/3036795456.json`).
- **The app.** `keyAction` in `src/keyboard.js`, `src/useTableKeys.js`, `src/hover.js`, `src/components/KeyboardCamera.jsx`, and `OrbitControls` (drei, with the three-stdlib defaults).

## Mouse

| Input | TTS | App | Same |
|---|---|---|---|
| Left click on a piece | Pick up | Select | No |
| Left drag on a piece | Move it | Move it at once and select it. A piece that is already selected stays selected | Yes |
| Left drag on the empty table | Box select | Turn the camera | No |
| Right drag on the empty table | Turn the camera | Turn the camera | Yes |
| Right click on a piece | Context menu. While holding a piece: tap it | Nothing. The piece handlers take only the left button, so a right drag on a piece turns the camera | No |
| Middle drag | Pan | Pan | Yes |
| Middle click | Zoom to the pointer, click again to zoom back. On a piece: flip | Nothing | No |
| Scroll wheel | Zoom. While holding a piece: rotate it | Zoom. While dragging a piece: turn it 15° per step (wheel up left, wheel down right, picked by look) | Yes |
| Shift, Ctrl or Cmd + left or right drag | Not in the sources | Pan | — |
| Two-finger swipe on a trackpad | Not in the sources | Pan | — |
| Pinch on a trackpad, or Ctrl + scroll | Not in the sources | Zoom | — |

The camera buttons are in `CAMERA_MOUSE_BUTTONS` in `src/camera.js`. Left drag still turns the camera, because the app has no box select and a trackpad has no easy right drag.

The mouse wheel and the trackpad gestures are in `src/components/WheelCamera.jsx`. OrbitControls gets no wheel event. It still zooms on a touch screen. The browser reports a mouse wheel and a two-finger swipe as the same wheel event, with no flag for the device. Therefore the app guesses from the deltas. The rules are for a Mac. A Mac trackpad sends whole pixels and starts a swipe with small steps. A Mac mouse wheel sends steps of 4.000244 px or more. A mouse that scrolls smoothly (the Magic Mouse, some Logitech mice) can count as a trackpad, so it pans. Then Ctrl + scroll zooms. A pinch is a wheel event with `ctrlKey` set in Chrome, Firefox and Safari.

A mouse wheel step is a bindable input, `WheelUp` or `WheelDown`, with the Shift, Alt and Cmd flags of the event. Shift + wheel reads `deltaX` when `deltaY` is 0. A trackpad swipe, a pinch and Ctrl + wheel are not bindable. The defaults: `anywhere` zooms; `dragging` turns the dragged piece, as Q / E do. During a drag the camera is still, so a zoom binding does nothing then.

Wheel input is smoothed. A wheel event does not move the camera at once. Each frame, the camera does a part of the zoom or pan that is left: `1 − e^(−dt / time)`. So the speed is the same at every frame rate. The time is 0.08 s for a mouse wheel step and 0.03 s for a trackpad swipe or pinch. Both are picked by look. One mouse wheel step zooms 5%, the same step as OrbitControls. Before 2026-10-02 the wheel zoom was OrbitControls, which jumps the whole step in one frame, and a tester said that zoom felt choppier than in TTS. Space ends the zoom and pan that are left.

The app shows a warning when the browser draws WebGL on the CPU (SwiftShader, llvmpipe, softpipe, Microsoft Basic Render Driver), for example with hardware acceleration off. See `src/renderer.js`.

## Hover

A piece under the pointer shows a white outline when this browser can use it with the pointer: a model, a tool, a crisis token, an unlocked terrain piece, a Team Tactic card, a token (in the On row of a tray, a Give source, on the table, a pile), a tray card, a roster card, a setup crisis card, a crisis card, a VP marker, the round marker, the Priority marker, a supply pile, a tool of the own rack, and a die on the shelf of the own tray. A selected piece, a range mark, an overlap and the other player's selection have their own outline, which wins over the white one.

No outline: locked terrain, the table, the mat, the other player's rack and dice tray, dice in the well or in the air, a token that takes no pointer (a drag preview), the turn handle, and the buttons on the table (they have a CSS hover).

## Keyboard: TTS defaults

Bindings on this Mac are the TTS defaults. The only change is Scripting 1–10, which is moved from the number pad to the number row (see the next section).

| Key | TTS action | App | Same |
|---|---|---|---|
| W A S D | Pan the camera | Pan the camera | Yes |
| Arrow keys | Turn the camera | Turn the camera around the point it looks at. Left / Right turn the view left / right, Up / Down tilt it up / down | Yes |
| Space | Reset the camera. In first-person mode: fly up | Moves the camera back to the start view at once. The app has no first-person mode | Yes |
| Z | Zoom to the pointer, press again to zoom back | Nothing | No |
| P | Camera mode: third person, first person, top-down | Ping: an arrow in the color of your side at the pointer, see `ping.md`. The app has no camera modes | No |
| Ctrl | First-person mode: fly down | Nothing | No |
| F | Flip | Flips the crisis token under the pointer, the card of the character under the pointer (its model or its tray card), or the Team Tactic card under the pointer. With nothing under the pointer: the piece selected last, a token or the card of a character | Partly |
| Q / E | Rotate the piece | Turns the dragged character or tool, else the one under the pointer, 15° around its center. Q turns counter-clockwise, E clockwise (seen from above). A token has a turn handle, no key | Partly |
| T | Tap (turn 90°) | Nothing | No |
| R | Raise | Lifts the model under the pointer 6", or puts it back down. With no model under the pointer: puts every lifted model back down | Partly |
| L | Lock | Locks or unlocks the terrain piece under the pointer. Only terrain has a lock. The terrain label shows the state: "Tree - Size 2 - (L)ocked" or "Un(L)ocked". Every terrain piece starts locked. A locked piece cannot be selected or deleted | Partly |
| Delete / Backspace | Delete the hovered or selected piece | Deletes the piece under the pointer: a character token on the table, a crisis token that a character holds, a token pile, a Team Tactic card, an unlocked terrain piece, or a character (over its tray card, after a confirm; its models and tray go). Other pieces cannot be deleted with a key | Partly |
| G | Group | Nothing | No |
| U | Place under | Nothing | No |
| Alt (hold, over a piece) | Zoomed preview, works best for cards | Shows the card under the pointer large, with no backdrop, while Alt is held: a tray card (the side that faces up), a roster card with an image, a setup or scoring board crisis card, a Team Tactic card (the side that faces up), or a model (the card of its character; the second model of a two-card character shows card 2). Moving to another card shows that card, off every card shows nothing. Release Alt, or leave the window, to close it. A click on a card still opens the popup, and Alt does nothing while a popup or a drag is open | Yes |
| Alt + Shift | Peek at the underside | Nothing | No |
| M | Magnify | Nothing | No |
| N | Nudge | Nothing | No |
| − / + | Scale | Nothing | No |
| Tab | Line tool | Nothing. The range and move tools are not free lines | No |
| Ctrl + X / C / V | Cut / copy / paste | Nothing | No |
| Number row 1–9, 0 | Over a deck or a bag: draw that many | Range and move tools. 0 removes every tool (see the next section) | No |
| PageUp / PageDown | Previous / next state | Nothing | No |
| H | Hide the hand | Nothing | No |
| B | Blindfold | Nothing | No |
| Enter | Text chat | Nothing | No |
| C / V (hold) | Voice chat / team voice chat | Nothing | No |
| ? | Help | Nothing | No |
| F11 | Hide the GUI | Nothing | No |
| ` | System console | Nothing | No |

The direction and the speed of the arrow keys (90° per second) are picked by look. They are not compared with TTS yet.

Q / E turn a piece 15° per press. 15° is `PointerRotationSnap` in the same plist, the TTS default. A key held for more than 0.3 s turns the piece on at 90° per second, the speed of the arrow keys. The app does not use the key repeat of the system, so the speed is the same on every computer. A held key keeps turning the piece of the press, also when the pointer leaves it. Each turn is smoothed in the same way as the wheel zoom: each frame, the piece does `1 − e^(−dt / 0.06 s)` of the turn that is left. The delay, the speed and the smoothing time are picked by look. The center of a character is its base center. The center of a movement tool is its hinge. A turn moves both ends of a tool, so a snapped tool is free after it. While a drag turns a snapped tool or bends a tool, Q / E do nothing.

F flips the piece under the pointer first. A crisis token without a back does not flip. F over it does nothing, also when another token is selected. F over a model flips the character card, not the model. In TTS, F over a figurine turns the figurine upside down, which players do not need.

R is a toggle. In TTS, a player lifts a model by holding it with the mouse. In the app, the model stays up, so the same player can select the token under it and measure. The model goes straight up 6" and comes back down to the same place, with no physics. A model that was asleep (at rest) sleeps again, so physics does not move it from its place. A Q / E turn during the lift stays after it. A drag ends the lift, and the model drops where it is released. Place on a lifted model also ends the lift: the model stands at the new place. The height is 6", so the tallest model measured (Sentinel Prime MK4, 5.28") can slide under a lifted model during a Throw or Push (README "Throw / Push"). The smoothing (the same as Q / E) is picked by look. The TTS knowledge base does not describe the TTS Raise key.

## Start view

The host sits at +z. The start view stands behind the host table edge and looks down at 45°, at a point 16.8" from the mat center toward the host, from 46" away. In a 16:10 window it shows the whole mat, the host trays, the host tool rack in front of the dice tray (z up to 27.9") and the guest trays. Its bottom edge meets the table at z = 37.5". Space returns to it. The values are `CAMERA_TARGET` and `CAMERA_POSITION` in `src/camera.js` (`startView`).

## Keyboard: keys of the mod

In TTS, Scripting 1–10 are on the number pad by default. On this Mac they are moved to the number row. The app reads `e.key`, so both the number row and the number pad (with Num Lock on) work.

The mod handles a key only for the player whose tray it is (Blue or Red).

| Key | Mod | App | Same |
|---|---|---|---|
| 1, pointer over a character | Range 2 tool in "Snap 1" mode, snapped to the character | Range 1 (the Range 2 tool in "Snap 1" mode), snapped | Yes |
| 2–5, pointer over a character | Range 2–5 tool, snapped | The same | Yes |
| 7 / 8 / 9, pointer over a character | Short / Medium / Long movement tool, snapped | The same | Yes |
| 6, pointer over a character | Long movement tool in "Toward/Away" mode, snapped | The Toward / Away tool (a copy of the long tool, bent 90°), snapped | Yes |
| 1–5, 7–9, no character under the pointer | Removes that tool from the table | Toggles the tool, the same as its toolbar button | Partly |
| 0 | Returns every tool to the tray | Removes every tool from the table. The selected pieces stay selected | Yes |
| 1–9, pointer over an own dice tray (both trays in a single player room, the own seat in a multiplayer room) | Clears the tray and adds that number of dice | Clears the tray, then adds that number of dice, 0 adds 10. A tray holds at most 42 dice. Over the other player's tray the keys spawn tools. See `docs/features/dice-rolling.md` | Yes |

The app also snaps a tool, key 6 included, when the pointer is over a crisis token. The mod only checks characters. The piece does not have to be selected first: the key selects it. Over a model of a side this browser does not play (the other side in a multiplayer room), the tool snaps to it and the selection does not change. So Place cannot move that model.

## Changing the keys

The keys of the tables above are the defaults. The user can change them in **Settings**. The actions are fixed in code (`ACTIONS` in `src/input/bindings.js`). The user changes only their bindings.

- **A binding** is an input, modifiers and a condition. The input is a key (`KeyQ`, `Digit1`, `Numpad1`, a modifier key such as `AltLeft`) or a mouse wheel step (`WheelUp`, `WheelDown`). The modifiers are any of Shift, Ctrl, Alt and Cmd.
- **Exact modifiers.** `Shift+Q` does not trigger the `Q` binding, and `Q` does not trigger `Shift+Q`.
- **Conditions.** `anywhere`, `overPiece`, `dragging`, `overDiceTray`, `popup`. Each action allows only the ones that make sense. Add dice allows only `overDiceTray`. Next card allows only `popup`.
- **Order.** One input can have several bindings. The one whose condition is true now and comes first in this order wins: `popup`, `dragging`, `overDiceTray`, `overPiece`, `anywhere`. So `1` over the own dice tray adds a die, else it spawns Range 1.
- **One action, several inputs.** The action list shows each as a chip. The number keys are two bindings, the number row and the number pad.
- **Conflict.** Two actions cannot have the same input, modifiers and condition. When the user binds a taken one, the old binding is removed and the popup says "Removed from <action>".
- **Wheel.** Only zoom and "Turn piece left / right" take a wheel step, and zoom takes nothing else. Shift + wheel can be bound. A trackpad swipe, a pinch and Ctrl + wheel cannot.
- **Held actions** (pan, turn the camera, turn a piece, card peek) end at the keyup of the main key. A modifier released earlier does not end them.
- **Reserved combos.** The browser or the system keeps Cmd+W, Cmd+Q, Cmd+T, Cmd+N, Cmd+Tab, Cmd+H, Cmd+M, Ctrl+W, Ctrl+T, Ctrl+N and Ctrl+Tab (`RESERVED` in `bindings.js`; Shift and Alt do not matter). The page never gets them, so the capture refuses them and says why. Ctrl + wheel is refused too. Any other Cmd or Ctrl combo that is bound calls `preventDefault`.
- **Capture.** **+** on a row starts it. The next key press with its modifiers, or the next wheel step over the capture box, is the input. A modifier key alone counts when it is released with no other key pressed meanwhile. Any key can be captured, Escape too. While it runs, the table keys and the Escape of the popup do nothing. **Cancel** ends it. Then a select picks the condition (the first allowed one, `anywhere` when allowed). With one allowed condition there is no select.
- **Names.** `KeyQ` shows Q, `Digit1` shows 1, `Numpad1` shows Num 1, the arrows show ← → ↑ ↓, `Escape` shows Esc, `WheelUp` shows Wheel up. A modifier shows `⇧ ⌃ ⌥ ⌘` on a Mac, else `Shift Ctrl Alt Win`. A chip shows its condition when the action allows more than one.
- **Reset.** A row with changed bindings has **Reset**. **Reset all keys** restores every default. A user who removed Escape can still close the popup with its close button.
- **Storage.** Only the actions that differ from the defaults are stored (`docs/features/table-tools.md`, "Settings menu"). An action that is not stored uses its defaults, so a new action in a later version gets its default keys.

## Settings popup

**Settings** in the toolbar opens a popup. Its **Keys** section lists every action with its bindings and edits them (see [Changing the keys](#changing-the-keys)). Its **Mouse** section lists the mouse controls, from `src/settings/controls.js` (`MOUSE_ROWS`, not editable). A change of a mouse control in this document changes that list in the same step. While the popup is open, the keys of the table do nothing, and Escape closes it, except during a key capture.

## Keys only in the app

| Key | App |
|---|---|
| Escape | Cancels a token drag, or closes the card, tray or settings popup, or closes the dice menu, or collapses the Log. Otherwise it clears the selection and removes the selected tools |

## Differences to decide

In order of how often a TTS player will notice them:

1. **Left drag on the empty table.** It turns the camera. In TTS it box-selects, and the app has no box select.
2. **Q / E** to turn a token.
3. **Number key with no character under the pointer.** The mod only removes the tool. The app toggles it, so a second press spawns the tool again.
