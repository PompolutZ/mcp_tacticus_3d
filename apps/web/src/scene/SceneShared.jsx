import { useLayoutEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { useTexture, Environment } from '@react-three/drei'
import { projectFootprints } from './footprintProjection.js'
import { useColorTexture } from './useColorTexture.js'
import { matImageUrl } from '../terrain/urls.js'
import { assetUrl } from '../assets/index.js'
import { RigidBody, CuboidCollider } from '@react-three/rapier'
import { DEFAULT_LOOK } from '../table/tableStore.js'
import { FRICTION } from '../physics.js'
import { MAT_SIZE, TABLE_COLLIDER_HALF_H, TABLE_DEPTH, TABLE_WIDTH } from '../table.js'

// Parts of the scene that the game (Scene.jsx) and the terrain page (debug/TerrainPage.jsx) share.

// The mat image. Its own component, so a new mat's image loads inside the mat's Suspense below.
// The image turns by -(matRotation - 180) degrees around Y (docs/features/maps.md, "Mat rotation").
export function Mat({ mat, rotation }) {
  const map = useTexture(matImageUrl(mat))
  const turn = (-(rotation - 180) * Math.PI) / 180
  return (
    <group rotation={[0, turn, 0]}>
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[MAT_SIZE, MAT_SIZE]} />
        <meshStandardMaterial
          map={map}
          roughness={1}
          metalness={0}
          onBeforeCompile={projectFootprints}
        />
      </mesh>
    </group>
  )
}

// The background image: fixed to the screen, "cover" fit (crop, never stretch). three.js draws a
// texture background as a screen quad that stretches to the canvas, so repeat and offset crop the
// image to the canvas aspect, centered.
export function Backdrop() {
  const image = useColorTexture(assetUrl('backgrounds/knowhere.webp'))
  const aspect = useThree((state) => state.size.width / state.size.height)
  useLayoutEffect(() => {
    const imageAspect = image.image.width / image.image.height
    const sx = Math.min(1, aspect / imageAspect)
    const sy = Math.min(1, imageAspect / aspect)
    image.repeat.set(sx, sy)
    image.offset.set((1 - sx) / 2, (1 - sy) / 2)
  }, [image, aspect])
  return <primitive object={image} attach="background" />
}

// Corner lights: one from each table corner at 35° above the table, no shadow. They light the sides of
// models and terrain from 4 sides. Directional, so the table center gets the same light as the corners.
// The intensities (DEFAULT_LOOK) were picked live with the Debug sliders (DebugPanel). The sliders stay
// for later tuning. At 0 the lights are not rendered.
const CORNER_ELEVATION = (35 * Math.PI) / 180
const CORNER_LIGHTS = [
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
].map(([sx, sz]) => {
  const x = (sx * TABLE_WIDTH) / 2
  const z = (sz * TABLE_DEPTH) / 2
  const y = Math.hypot(x, z) * Math.tan(CORNER_ELEVATION)
  return [x, y, z]
})

// The lights of the table: ambient, optional corner lights, the shadow light and the HDR.
// brightness: one factor for every light (the Brightness setting), ambient and corner are the base values.
export function SceneLights({
  ambient = DEFAULT_LOOK.ambient,
  corner = DEFAULT_LOOK.corner,
  brightness = 1,
}) {
  return (
    <>
      <ambientLight intensity={ambient * brightness} />
      {corner > 0 &&
        CORNER_LIGHTS.map((position) => (
          <directionalLight
            key={position.join()}
            position={position}
            intensity={corner * brightness}
          />
        ))}
      {/* The shadow camera looks from the light to the origin, so its x axis runs along the world
          diagonal (x − z), not along world x. The bounds are the mat and both dice trays measured in
          that camera's space: the mat needs x ±25.5, y −23 to 24.7, and the trays reach x = 37.1 and
          y = −33.5. The map is 3072 so that one shadow pixel is about as small as before
          (64" / 3072 ≈ 40" / 2048). */}
      <directionalLight
        position={[10, 30, 10]}
        intensity={0.8 * brightness}
        castShadow
        shadow-mapSize={[3072, 3072]}
        shadow-camera-near={1}
        shadow-camera-far={80}
        shadow-camera-left={-26}
        shadow-camera-right={38}
        shadow-camera-top={25}
        shadow-camera-bottom={-34}
      />
      {/* Same HDR as drei's "city" preset, served with the app instead of from a CDN.
          The light multiplies the texture color. Per unit of intensity, a surface that faces up gets:
          HDR 1.35 (its cos-weighted sky average), directional 0.29, ambient 0.32. A side face gets
          HDR 0.35–0.66, directional 0–0.14, ambient 0.32. The tone mapping is Neutral and card and token
          faces are Unlit, so this light does not change them. It applies to the models, terrain, the mat
          and the dice. With Neutral, a mid tone at a total of 0.91 shows darker than its texture color
          (about sRGB 110 instead of 134, calculated, see docs/plans/playtest/playtest-1-bugs.md). A total of 1.21 (HDR 0.5, directional 1.2, ambient 0.6)
          looked like a strong lamp. Most HDR light comes from above, so it makes tops much brighter than
          sides. Ambient is the same from every side, so part of the light moved from the HDR to ambient.
          Testers said many things looked very dark, so ambient is 1.5 and the corner lights add light to
          the sides. Now a face up gets 0.41 + 0.23 + 0.48 = 1.12, plus the corner lights. */}
      {/* The HDR only lights the scene. backgroundIntensity is not set: drei applies it to the scene,
          and 0 would darken the Backdrop image. */}
      <Environment
        files={assetUrl('hdri/potsdamer_platz_1k.hdr')}
        environmentIntensity={0.3 * brightness}
      />
    </>
  )
}

const TABLE_THICKNESS = 0.5
// The table image of the TTS mod (its TableURL). The image is 3:2, the same as the TTS table. The app table is
// deeper (table.js), so the image fills the table depth and its left and right ends are cut off. The planks
// keep their shape.
function fitTableTexture(texture) {
  const repeatX = TABLE_WIDTH / TABLE_DEPTH / (texture.image.width / texture.image.height)
  texture.repeat.set(repeatX, 1)
  texture.offset.set((1 - repeatX) / 2, 0)
}

// The table surface: a fixed collider so bodies land on it, and the table mesh. Goes inside <Physics>.
export function TableSurface() {
  const tableTexture = useTexture(assetUrl('table.webp'), fitTableTexture)
  return (
    <RigidBody type="fixed" colliders={false}>
      {/* Collider much thicker than the visual so fast bodies can't tunnel through; top stays at y=0 */}
      <CuboidCollider
        args={[TABLE_WIDTH / 2, TABLE_COLLIDER_HALF_H, TABLE_DEPTH / 2]}
        position={[0, -TABLE_COLLIDER_HALF_H, 0]}
        friction={FRICTION}
      />
      <mesh position={[0, -TABLE_THICKNESS / 2, 0]} receiveShadow>
        <boxGeometry args={[TABLE_WIDTH, TABLE_THICKNESS, TABLE_DEPTH]} />
        <meshStandardMaterial
          map={tableTexture}
          roughness={0.8}
          metalness={0.05}
          onBeforeCompile={projectFootprints}
        />
      </mesh>
    </RigidBody>
  )
}
