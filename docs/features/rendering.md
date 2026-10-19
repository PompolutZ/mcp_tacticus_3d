# Feature: Rendering

Status: partly built.

## Goal

The table draws smoothly on weak GPUs. Work that gives the same image is not done again.

## Shadow map

The shadow map is drawn again only when a shadow caster changes, not in every frame. Most of the time the table is still: a model moves about once per round, terrain stays until it is removed. So the map is the same in almost every frame, and drawing it is a large part of the GPU work.

- One check in one place (`src/scene/ShadowUpdates.jsx`, rule in `src/scene/shadowChange.js`), not a mark at each place that moves something. A mark is easy to forget (own drag, settling after a drop, the other player's drag, dice, a model or map that loads later, a removed piece), now and in future features.
- Each frame, before the scene is drawn, the check looks at all visible meshes with `castShadow`. The map is drawn again when one was added, removed or hidden, or has another geometry, material or world matrix.
- The matrices are made current before the check, so a shadow does not lag one frame behind its piece.
- The check runs before the composer of `SelectionOutlines.jsx`. When the composer is off (the setting or debug mode), the check also draws the scene, because a frame callback with a positive priority turns off the automatic draw of R3F.
- Not watched: the shadow light and its camera. They do not change while the app runs. If a feature changes them, it sets `gl.shadowMap.needsUpdate = true`.

## Setting: composer off

**Settings → Performance → Faster drawing (no outlines)** (`src/settings/settings.js`, `performance.composer`; default: composer on). The composer of `src/scene/SelectionOutlines.jsx` is the largest GPU cost after the shadow map: it draws the scene to a render target, adds antialiasing (multisampling) and draws the outlines in extra passes. On a weak GPU, turning it off gives a clearly higher frame rate. The debug mode `no-composer` also turns it off, for measuring.

- Lost: the outlines for hover, selection, the other player's selection, the range mark (green or red on the piece a range tool measures against), overlap and the tray swap target. The hover name label stays. The other marks get no replacement.
- Selection ring: the one mark that stays. A selected piece gets a flat ring in the selected outline color on the table under it, drawn over everything. It is made in one place for every piece type (`SelectionRings` in `SelectionOutlines.jsx`, the size from `src/scene/selectionRing.js`): the box of the piece's meshes in the piece's own turned frame, so a card or tool gets a turned, elongated ring. One geometry and one material for all rings. The size and the height are taken when the piece is selected; the ring follows the place and the turn of the piece in every frame, so it follows a drag and a move. A drag lifts the piece, the ring stays on the table.
- Antialiasing: with the composer on, the canvas has no antialiasing of its own (the composer has it). With the composer off, the canvas uses the browser's antialiasing. The browser chooses it only when the canvas is made, so a change of the setting makes the `<Canvas>` again (`key` in `App.jsx`). The scene loads again from the table document, the same as the recovery of `SceneBoundary.jsx` (`table-tools.md`, "Recovery"). `src/scene/KeepView.jsx` keeps the camera across it. Dice in the air are lost; dice at rest and every other piece come back from the document.
- The setting is of this browser only. The other player sees no change.
