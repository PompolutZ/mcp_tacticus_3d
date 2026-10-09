import { Plane, Raycaster, Vector3 } from 'three'

const TABLE_PLANE = new Plane(new Vector3(0, 1, 0), 0)
const raycaster = new Raycaster()

// Table, board or terrain point under a screen point: the first fixed collider that is not a sensor
// (models, tools and dice are not fixed, so they never catch it), else the table plane. With
// offTable: 'null', a ray that hits no collider gives null (the pointer is off the table).
// scene: { camera, canvas, world, rapier }. Returns a new Vector3.
export function tablePoint(scene, clientX, clientY, { offTable = 'plane' } = {}) {
  const { camera, canvas, world, rapier } = scene
  const rect = canvas.getBoundingClientRect()
  const ndc = {
    x: ((clientX - rect.left) / rect.width) * 2 - 1,
    y: -((clientY - rect.top) / rect.height) * 2 + 1,
  }
  raycaster.setFromCamera(ndc, camera)
  const { origin, direction } = raycaster.ray
  const filter = rapier.QueryFilterFlags.ONLY_FIXED | rapier.QueryFilterFlags.EXCLUDE_SENSORS
  const hit = world.castRay(new rapier.Ray(origin, direction), 1000, true, filter)
  if (hit) return raycaster.ray.at(hit.timeOfImpact, new Vector3())
  if (offTable === 'null') return null
  return raycaster.ray.intersectPlane(TABLE_PLANE, new Vector3())
}
