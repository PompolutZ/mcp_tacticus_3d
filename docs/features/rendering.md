# Feature: Rendering

Status: partly built.

## Goal

The table draws smoothly on weak GPUs. Work that gives the same image is not done again.

## Shadow map

The shadow map is drawn again only when a shadow caster changes, not in every frame. Most of the time the table is still: a model moves about once per round, terrain stays until it is removed. So the map is the same in almost every frame, and drawing it is a large part of the GPU work.

- One check in one place (`src/scene/ShadowUpdates.jsx`, rule in `src/scene/shadowChange.js`), not a mark at each place that moves something. A mark is easy to forget (own drag, settling after a drop, the other player's drag, dice, a model or map that loads later, a removed piece), now and in future features.
- Each frame, before the scene is drawn, the check looks at all visible meshes with `castShadow`. The map is drawn again when one was added, removed or hidden, or has another geometry, material or world matrix.
- The matrices are made current before the check, so a shadow does not lag one frame behind its piece.
- The check runs before the composer of `SelectionOutlines.jsx`. When the composer is off (debug mode), the check also draws the scene, because a frame callback with a positive priority turns off the automatic draw of R3F.
- Not watched: the shadow light and its camera. They do not change while the app runs. If a feature changes them, it sets `gl.shadowMap.needsUpdate = true`.
