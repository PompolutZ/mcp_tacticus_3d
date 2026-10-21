import { Plane, Raycaster, Vector3 } from 'three'
import { ndcFromClient } from './screenRay.js'

const TABLE_PLANE = new Plane(new Vector3(0, 1, 0), 0)
const raycaster = new Raycaster()

// Table, board or terrain point under a screen point: the first fixed collider that is not a sensor
// (models, tools and dice are not fixed, so they never catch it), else the table plane. With
// offTable: 'null', a ray that hits no collider gives null (the pointer is off the table).
// planeY: a number skips the colliders and gives the point on the horizontal plane at that height (a drag
// that keeps the grabbed point under the pointer), or null when the ray does not meet the plane.
// scene: { camera, canvas, world, rapier }. Returns a new Vector3. With planeY, world and rapier are not used.
export function tablePoint(scene, clientX, clientY, { offTable = 'plane', planeY } = {}) {
  const { camera, canvas, world, rapier } = scene
  raycaster.setFromCamera(ndcFromClient(canvas, clientX, clientY), camera)
  if (planeY !== undefined) {
    return raycaster.ray.intersectPlane(new Plane(new Vector3(0, 1, 0), -planeY), new Vector3())
  }
  const { origin, direction } = raycaster.ray
  const filter = rapier.QueryFilterFlags.ONLY_FIXED | rapier.QueryFilterFlags.EXCLUDE_SENSORS
  const hit = world.castRay(new rapier.Ray(origin, direction), 1000, true, filter)
  if (hit) return raycaster.ray.at(hit.timeOfImpact, new Vector3())
  if (offTable === 'null') return null
  return raycaster.ray.intersectPlane(TABLE_PLANE, new Vector3())
}
