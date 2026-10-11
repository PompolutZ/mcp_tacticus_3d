# Plan: Image as the background

Requested by the user on 2026-10-11. Status: done. The user tried it and keeps it for now.

## Request

Replace the space background (a dark color and a star field) with an image: a 16:9 wallpaper of Knowhere from the user, `https://i.redd.it/hw0nb97x92k71.png`.

## Facts

- The image is 3840 × 2160 and 9.5 MB as PNG. It is not a 360° panorama, so it cannot wrap around the table without stretching and a seam.
- drei `Environment` applies `backgroundIntensity` to the scene, also without the `background` prop. three.js r169 multiplies a texture background by `scene.backgroundIntensity`. The old `backgroundIntensity={0}` therefore made the image black. It did not affect the old background, because a color background is a clear color and the stars were 3D points.

## Decisions

1. A fixed backdrop: the image fills the screen behind the table and does not move with the camera. It is cropped from the center to the canvas shape and never stretched.
2. The image is WebP at full size: 650 KB, `src/assets/backgrounds/knowhere.webp`.
3. It is not preloaded. The table does not wait for it, and the old dark color shows while it loads.

## Result

- `Scene.jsx`: a `Backdrop` component sets the image as `scene.background`. It sets the texture `repeat` and `offset` for the crop, when the canvas size changes. A `Suspense` shows the old dark color while the image loads. `Stars` is removed.
- `Scene.jsx`: `backgroundIntensity={0}` is removed from `Environment`, with a comment why it must not be set.
- Checks: `pnpm format`, `pnpm lint`, `pnpm --filter web build` pass. The user checked the look in the browser.
