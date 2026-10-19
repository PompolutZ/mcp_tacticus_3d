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
- Selection shade: the one mark that stays. A selected piece is tinted orange, the way a character turns red when its base overlaps another model. One mechanism for every piece type and both tints: `useOutline` in `SelectionOutlines.jsx` is the only owner, and `src/scene/shade.js` has the rule (`shadeFor`: overlap red, selected orange only with the composer off, else none) and the copies (`applyShade`). The shade is a function of the outline mode, which already puts overlap before selected, so overlap wins and two shades never stack. Each mesh gets its own copy of the material (GLB materials are shared) that is disposed when the shade ends, and the original is put back in the same cleanup. Lit materials get the shade as emissive, so textures stay visible; unlit ones (token faces, cards, `MeshBasicMaterial`) have their color moved half way to the shade. The orange is darker than the selected outline color, so it reads as a shade, not a repaint. The other marks (hover, range, other player's selection) get no replacement.
- Antialiasing: with the composer on, the canvas has no antialiasing of its own (the composer has it). With the composer off, the canvas uses the browser's antialiasing. The browser chooses it only when the canvas is made, so a change of the setting makes the `<Canvas>` again (`key` in `App.jsx`). The scene loads again from the table document, the same as the recovery of `SceneBoundary.jsx` (`table-tools.md`, "Recovery"). `src/scene/KeepView.jsx` keeps the camera across it. Dice in the air are lost; dice at rest and every other piece come back from the document.
- The setting is of this browser only. The other player sees no change.
