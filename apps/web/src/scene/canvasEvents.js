import { events as pointerEvents } from '@react-three/fiber'

// R3F listens for pointer events on the element around the canvas. drei Html puts its HTML into that
// element too, so a click on an Html button (dice keys, game setup buttons) also reaches R3F. R3F aims its
// ray with offsetX and offsetY, which are relative to the button, not to the canvas. So the ray points near
// the top-left corner of the canvas, and an object there, for example a roster card, got the click. With
// this filter, an event that is not on the canvas hits no object. Drags are not changed, because they
// listen on window.
export function canvasEvents(store) {
  return {
    ...pointerEvents(store),
    filter: (hits, state) =>
      state.internal.lastEvent.current?.target === state.gl.domElement ? hits : [],
  }
}
