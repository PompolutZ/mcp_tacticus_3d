import * as THREE from 'three'

// Tool footprints painted onto the table and terrain by their materials.
// Each tool takes one slot and writes its shape and colors to it every frame.
// The shape is one rectangle for each half of the tool, going out from the tool center,
// plus a round hinge at the center. A straight tool is one long rectangle.
// The shader paints every surface under a shape that faces up enough.

const MAX_FOOTPRINTS = 4
// Surfaces with a world normal Y below this are walls and are not painted (about 60° slope)
const FACE_UP_MIN = 0.5
// Outline width in screen pixels
const LINE_PX = 1.5

// Shared by all patched materials, so one write reaches every surface
const uniforms = {
  // center x, center z, length of each half, half width
  uFpRect: { value: Array.from({ length: MAX_FOOTPRINTS }, () => new THREE.Vector4()) },
  // cos(yaw), sin(yaw) of the right half, then of the left half
  uFpDir: { value: Array.from({ length: MAX_FOOTPRINTS }, () => new THREE.Vector4(1, 0, -1, 0)) },
  // fill rgb, fill opacity. Opacity 0 means the slot is free.
  // w is set to 0 on purpose: Vector4() starts with w = 1, so a free slot would paint a black disc at the center.
  uFpFill: { value: Array.from({ length: MAX_FOOTPRINTS }, () => new THREE.Vector4(0, 0, 0, 0)) },
  uFpLine: { value: Array.from({ length: MAX_FOOTPRINTS }, () => new THREE.Vector3()) },
}
const used = new Array(MAX_FOOTPRINTS).fill(false)
const color = new THREE.Color()

const VERTEX_DECL = /* glsl */`
varying vec3 vFpWorldPos;`

const VERTEX_MAIN = /* glsl */`
vFpWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`

const FRAGMENT_DECL = /* glsl */`
#define FP_MAX ${MAX_FOOTPRINTS}
varying vec3 vFpWorldPos;
uniform vec4 uFpRect[FP_MAX];
uniform vec4 uFpDir[FP_MAX];
uniform vec4 uFpFill[FP_MAX];
uniform vec3 uFpLine[FP_MAX];

// Distance from d (offset from the tool center) to the edge of one half, positive inside.
// World XZ to half-local XZ, the same as toLocal() in RulerTool. The half spans local x = 0..len.
float fpHalf(vec2 d, vec2 cs, float len, float halfWidth) {
  vec2 l = vec2(d.x * cs.x - d.y * cs.y, d.x * cs.y + d.y * cs.x);
  return min(min(l.x, len - l.x), halfWidth - abs(l.y));
}`

// Derivatives are taken before any branch, because they are undefined inside non-uniform flow.
// The normal comes from the world position, so it is correct with any mesh normals and scale.
const FRAGMENT_MAIN = /* glsl */`
{
  vec3 fpN = normalize(cross(dFdx(vFpWorldPos), dFdy(vFpWorldPos)));
  float fpPx = max(fwidth(vFpWorldPos.x), fwidth(vFpWorldPos.z)) * ${LINE_PX.toFixed(2)};
  if (fpN.y > ${FACE_UP_MIN.toFixed(2)}) {
    for (int i = 0; i < FP_MAX; i++) {
      if (uFpFill[i].a <= 0.0) continue;
      // Inside the shape when inside the hinge or one of the halves. The largest distance is the
      // distance to the outer edge, so no line is drawn where the parts overlap.
      vec2 d = vFpWorldPos.xz - uFpRect[i].xy;
      float edge = max(
        uFpRect[i].w - length(d),
        max(fpHalf(d, uFpDir[i].xy, uFpRect[i].z, uFpRect[i].w), fpHalf(d, uFpDir[i].zw, uFpRect[i].z, uFpRect[i].w))
      );
      if (edge < 0.0) continue;
      gl_FragColor.rgb = edge < fpPx ? uFpLine[i] : mix(gl_FragColor.rgb, uFpFill[i].rgb, uFpFill[i].a);
    }
  }
}`

// onBeforeCompile for a MeshStandardMaterial that shows tool footprints
export function projectFootprints(shader) {
  Object.assign(shader.uniforms, uniforms)
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>${VERTEX_DECL}`)
    .replace('#include <project_vertex>', `#include <project_vertex>${VERTEX_MAIN}`)
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>${FRAGMENT_DECL}`)
    .replace('#include <tonemapping_fragment>', `${FRAGMENT_MAIN}\n#include <tonemapping_fragment>`)
}

// Takes a free slot. Returns { set, release }, or null when all slots are used.
export function acquireFootprint() {
  const i = used.indexOf(false)
  if (i < 0) return null
  used[i] = true
  return {
    // shape: { x, z, right, left } as from toolShape() in RulerTool. length: length of each half.
    set(shape, length, halfWidth, fill, opacity, line) {
      uniforms.uFpRect.value[i].set(shape.x, shape.z, length, halfWidth)
      uniforms.uFpDir.value[i].set(Math.cos(shape.right), Math.sin(shape.right), Math.cos(shape.left), Math.sin(shape.left))
      color.set(fill)
      uniforms.uFpFill.value[i].set(color.r, color.g, color.b, opacity)
      color.set(line)
      uniforms.uFpLine.value[i].set(color.r, color.g, color.b)
    },
    release() {
      uniforms.uFpFill.value[i].w = 0
      used[i] = false
    },
  }
}
