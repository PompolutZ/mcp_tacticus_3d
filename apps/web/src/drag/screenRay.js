// Screen point to a ray, and the nearest object on it. No React: loads in Node.

// Client pixel to normalized device coordinates ({ x, y } in -1..1) of the canvas
export function ndcFromClient(canvas, clientX, clientY) {
  const rect = canvas.getBoundingClientRect()
  return {
    x: ((clientX - rect.left) / rect.width) * 2 - 1,
    y: -((clientY - rect.top) / rect.height) * 2 + 1,
  }
}

// The value of the entry whose object the raycaster hits nearest, or null. entries: an iterable of
// [value, object]; an entry with no object is skipped. The raycaster already has its ray set.
export function nearestHit(raycaster, entries) {
  let nearest = null
  let nearestDistance = Infinity
  for (const [value, object] of entries) {
    const hit = object && raycaster.intersectObject(object, true)[0]
    if (hit && hit.distance < nearestDistance) {
      nearest = value
      nearestDistance = hit.distance
    }
  }
  return nearest
}
