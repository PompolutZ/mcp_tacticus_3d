# Feature: Key and mouse controls as in TTS

Status: WASD pan, arrow keys, Space, right drag, middle drag, trackpad gestures, Q / E on characters and tools, F, R, L, 0, and number keys over the dice tray done. The rest is a list of differences, not started.

## Goal

The users of the app are active TTS players. They already know the TTS controls. Therefore the app uses the same keys and mouse buttons as TTS wherever the app has the same action. Then a player does not have to learn new controls.

## Sources

- **TTS bindings.** TTS stores its key bindings (the cInput library) in `~/Library/Preferences/com.berserk-games.tabletop-simulator.plist`. Read them with `defaults read com.berserk-games.tabletop-simulator <key>`. `cInput_descr` has the action names. `cInput_modifierStr` has the main key of each action, at the same index. `cInput_alt_modifierStr` and `cInput_alt_inpStr` have the second binding. `cInput_defaults` has the defaults. Read on 2026-10-02.
- **TTS knowledge base.** [Basic controls](https://kb.tabletopsimulator.com/player-guides/basic-controls/) and [advanced controls](https://kb.tabletopsimulator.com/player-guides/advanced-controls/). They describe the mouse buttons and the number keys.
- **The mod.** `onScriptingButtonDown` in the Blue/Red Tool Tray and Blue/Red Dice Tray scripts (`Mods/Workshop/3036795456.json`).
- **The app.** `src/keyboard.js`, `handleKeyDown` in `src/App.jsx`, `src/components/KeyboardCamera.jsx`, and `OrbitControls` (drei, with the three-stdlib defaults).

## Mouse

| Input | TTS | App | Same |
|---|---|---|---|
| Left click on a piece | Pick up | Select | No |
| Left drag on a piece | Move it | Move it, only if it is already selected | Partly |
| Left drag on the empty table | Box select | Turn the camera | No |
| Right drag on the empty table | Turn the camera | Turn the camera | Yes |
| Right click on a piece | Context menu. While holding a piece: tap it | Nothing. The piece handlers take only the left button, so a right drag on a piece turns the camera | No |
| Middle drag | Pan | Pan | Yes |
| Middle click | Zoom to the pointer, click again to zoom back. On a piece: flip | Nothing | No |
| Scroll wheel | Zoom. While holding a piece: rotate it | Zoom | Yes, for the camera |
| Shift, Ctrl or Cmd + left or right drag | Not in the sources | Pan | — |
| Two-finger swipe on a trackpad | Not in the sources | Pan | — |
| Pinch on a trackpad, or Ctrl + scroll | Not in the sources | Zoom | — |

The camera buttons are in `CAMERA_MOUSE_BUTTONS` in `src/App.jsx`. Left drag still turns the camera, because the app has no box select and a trackpad has no easy right drag.

The mouse wheel and the trackpad gestures are in `src/components/WheelCamera.jsx`. OrbitControls gets no wheel event. It still zooms on a touch screen. The browser reports a mouse wheel and a two-finger swipe as the same wheel event, with no flag for the device. Therefore the app guesses from the deltas. The rules are for a Mac. A Mac trackpad sends whole pixels and starts a swipe with small steps. A Mac mouse wheel sends steps of 4.000244 px or more. A mouse that scrolls smoothly (the Magic Mouse, some Logitech mice) can count as a trackpad, so it pans. Then Ctrl + scroll zooms. A pinch is a wheel event with `ctrlKey` set in Chrome, Firefox and Safari.

Wheel input is smoothed. A wheel event does not move the camera at once. Each frame, the camera does a part of the zoom or pan that is left: `1 − e^(−dt / time)`. So the speed is the same at every frame rate. The time is 0.08 s for a mouse wheel step and 0.03 s for a trackpad swipe or pinch. Both are picked by look. One mouse wheel step zooms 5%, the same step as OrbitControls. Before 2026-10-02 the wheel zoom was OrbitControls, which jumps the whole step in one frame, and a tester said that zoom felt choppier than in TTS. Space ends the zoom and pan that are left.

The app shows a warning when the browser draws WebGL on the CPU (SwiftShader, llvmpipe, softpipe, Microsoft Basic Render Driver), for example with hardware acceleration off. See `src/renderer.js`.

## Keyboard: TTS defaults

Bindings on this Mac are the TTS defaults. The only change is Scripting 1–10, which is moved from the number pad to the number row (see the next section).

| Key | TTS action | App | Same |
|---|---|---|---|
| W A S D | Pan the camera | Pan the camera | Yes |
| Arrow keys | Turn the camera | Turn the camera around the point it looks at. Left / Right turn the view left / right, Up / Down tilt it up / down | Yes |
| Space | Reset the camera. In first-person mode: fly up | Moves the camera back to the start view at once. The app has no first-person mode | Yes |
| Z | Zoom to the pointer, press again to zoom back | Nothing | No |
| P | Camera mode: third person, first person, top-down | Nothing | No |
| Ctrl | First-person mode: fly down | Nothing | No |
| F | Flip | Flips the crisis token under the pointer, the card of the character under the pointer (its model or its tray card), or the Team Tactic card under the pointer. With nothing under the pointer: the piece selected last, a token or the card of a character | Partly |
| Q / E | Rotate the piece | Turns the dragged character or tool, else the one under the pointer, 15° around its center. Q turns counter-clockwise, E clockwise (seen from above). A token has a turn handle, no key | Partly |
| T | Tap (turn 90°) | Nothing | No |
| R | Raise | Lifts the model under the pointer 6", or puts it back down. With no model under the pointer: puts every lifted model back down | Partly |
| L | Lock | Locks or unlocks the terrain piece under the pointer. Only terrain has a lock. Every terrain piece starts locked. A locked piece cannot be selected or deleted | Partly |
| Delete / Backspace | Delete the hovered or selected piece | Deletes the piece under the pointer: a character token on the table, a crisis token that a character holds, a token pile, a Team Tactic card, or an unlocked terrain piece. Other pieces cannot be deleted with a key | Partly |
| G | Group | Nothing | No |
| U | Place under | Nothing | No |
| Alt (hold, over a piece) | Zoomed preview, works best for cards | Click a card to open it in a popup | Partly |
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

Q / E turn a piece 15° per press. 15° is `PointerRotationSnap` in the same plist, the TTS default (read on 2026-10-05). A key held for more than 0.3 s turns the piece on at 90° per second, the speed of the arrow keys. The app does not use the key repeat of the system, so the speed is the same on every computer. A held key keeps turning the piece of the press, also when the pointer leaves it. Each turn is smoothed in the same way as the wheel zoom: each frame, the piece does `1 − e^(−dt / 0.06 s)` of the turn that is left. The delay, the speed and the smoothing time are picked by look. The center of a character is its base center. The center of a movement tool is its hinge. A turn moves both ends of a tool, so a snapped tool is free after it. While a drag turns a snapped tool or bends a tool, Q / E do nothing.

F flips the piece under the pointer first. A crisis token without a back does not flip. F over it does nothing, also when another token is selected. F over a model flips the character card, not the model. In TTS, F over a figurine turns the figurine upside down, which players do not need.

R is a toggle. In TTS, a player lifts a model by holding it with the mouse. In the app, the model stays up, so the same player can select the token under it and measure. The model goes straight up 6" and comes back down to the same place, with no physics. A model that was asleep (at rest) sleeps again, so physics does not move it from its place. A Q / E turn during the lift stays after it. A drag ends the lift, and the model drops where it is released. Place on a lifted model also ends the lift: the model stands at the new place. The height is 6", so the tallest model measured (Sentinel Prime MK4, 5.28") can slide under a lifted model during a Throw or Push (README "Throw / Push"). The smoothing (the same as Q / E) is picked by look. The TTS knowledge base does not describe the TTS Raise key.

## Start view

For now every player is Blue. Blue sits at +z. The start view stands behind the blue table edge and looks down at 45°, at a point 6" from the mat center toward Blue, from 46" away. In a 16:10 window it shows the whole mat, the blue trays and the red trays. Space returns to it. The values are `CAMERA_TARGET` and `CAMERA_POSITION` in `src/App.jsx`.

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
| 1–9, pointer over the player's own dice tray | Clears the tray and adds that number of dice | Adds that number of dice, 0 adds 10. It does not clear the tray. A tray holds at most 42 dice. See `docs/feature-dice-rolling.md` | Partly |

The app also snaps a tool, key 6 included, when the pointer is over a crisis token. The mod only checks characters. The piece does not have to be selected first: the key selects it.

## Keys only in the app

| Key | App |
|---|---|
| Escape | Cancels a token drag, or closes the card or tray popup, or closes the dice menu. Otherwise it clears the selection and removes the selected tools |

## Differences to decide

In order of how often a TTS player will notice them:

1. **Left drag on the empty table.** It turns the camera. In TTS it box-selects, and the app has no box select.
2. **Left drag on a piece.** In TTS a player drags a piece at once. In the app the piece must be selected first.
3. **Q / E** to turn a token.
4. **Alt (hold)** over a card to show it large, as the click popup does now.
5. **Number key with no character under the pointer.** The mod only removes the tool. The app toggles it, so a second press spawns the tool again.
6. **Number keys over a dice tray.** The mod clears the tray first. The app only adds dice.
