import * as THREE from 'three'

// Tool footprints painted onto the table and terrain by their materials.
// Each tool takes one slot and writes its rectangle and colors to it every frame.
// The shader paints every surface under a rectangle that faces up enough.

const MAX_FOOTPRINTS = 4
// Surfaces with a world normal Y below this are walls and are not painted (about 60° slope)
const FACE_UP_MIN = 0.5
// Outline width in screen pixels
const LINE_PX = 1.5

// Shared by all patched materials, so one write reaches every surface
const uniforms = {
  // center x, center z, half length, half width
  uFpRect: { value: Array.from({ length: MAX_FOOTPRINTS }, () => new THREE.Vector4()) },
  // cos(yaw), sin(yaw)
  uFpDir: { value: Array.from({ length: MAX_FOOTPRINTS }, () => new THREE.Vector2(1, 0)) },
  // fill rgb, fill opacity. Opacity 0 means the slot is free.
  uFpFill: { value: Array.from({ length: MAX_FOOTPRINTS }, () => new THREE.Vector4()) },
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
uniform vec2 uFpDir[FP_MAX];
uniform vec4 uFpFill[FP_MAX];
uniform vec3 uFpLine[FP_MAX];`

// Derivatives are taken before any branch, because they are undefined inside non-uniform flow.
// The normal comes from the world position, so it is correct with any mesh normals and scale.
const FRAGMENT_MAIN = /* glsl */`
{
  vec3 fpN = normalize(cross(dFdx(vFpWorldPos), dFdy(vFpWorldPos)));
  float fpPx = max(fwidth(vFpWorldPos.x), fwidth(vFpWorldPos.z)) * ${LINE_PX.toFixed(2)};
  if (fpN.y > ${FACE_UP_MIN.toFixed(2)}) {
    for (int i = 0; i < FP_MAX; i++) {
      if (uFpFill[i].a <= 0.0) continue;
      // World XZ to tool-local XZ, the same as toLocal() in RulerTool
      vec2 d = vFpWorldPos.xz - uFpRect[i].xy;
      vec2 cs = uFpDir[i];
      vec2 l = vec2(d.x * cs.x - d.y * cs.y, d.x * cs.y + d.y * cs.x);
      vec2 inside = uFpRect[i].zw - abs(l);
      float edge = min(inside.x, inside.y);
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
    // pose: { x, z, yaw } as from toolPose() in RulerTool
    set(pose, halfLength, halfWidth, fill, opacity, line) {
      uniforms.uFpRect.value[i].set(pose.x, pose.z, halfLength, halfWidth)
      uniforms.uFpDir.value[i].set(Math.cos(pose.yaw), Math.sin(pose.yaw))
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
