import * as THREE from 'three'

// Tool and token footprints painted onto the table and terrain by their materials.
// Each user takes one slot and writes its shape and colors to it every frame.
// A slot holds one of two shape kinds:
// - rect: one rectangle for each half, going out from the center, plus a round hinge at the center.
//   A straight tool is one long rectangle. Used by the range and movement tools.
// - sector: a quarter circle, corner at the center, out to a radius. Used by the Zone Arc outline.
// The shader paints every surface under a shape that faces up enough.

const MAX_FOOTPRINTS = 6
// Surfaces with a world normal Y below this are walls and are not painted (about 60° slope)
const FACE_UP_MIN = 0.5
// Outline width in screen pixels
const LINE_PX = 1.5
const KIND_RECT = 0
const KIND_SECTOR = 1

// Shared by all patched materials, so one write reaches every surface
const uniforms = {
  // rect: center x, center z, length of each half, half width. sector: center x, center z, radius, unused.
  uFpRect: { value: Array.from({ length: MAX_FOOTPRINTS }, () => new THREE.Vector4()) },
  // rect: cos/sin of the right half, then of the left half. sector: cos/sin of each straight edge.
  uFpDir: { value: Array.from({ length: MAX_FOOTPRINTS }, () => new THREE.Vector4(1, 0, -1, 0)) },
  // fill rgb, fill opacity. Opacity 0 means the slot is free.
  // w is set to 0 on purpose: Vector4() starts with w = 1, so a free slot would paint a black disc at the center.
  uFpFill: { value: Array.from({ length: MAX_FOOTPRINTS }, () => new THREE.Vector4(0, 0, 0, 0)) },
  uFpLine: { value: Array.from({ length: MAX_FOOTPRINTS }, () => new THREE.Vector3()) },
  // 0 = rect, 1 = sector
  uFpKind: { value: Array.from({ length: MAX_FOOTPRINTS }, () => KIND_RECT) },
}
const used = Array.from({ length: MAX_FOOTPRINTS }, () => false)
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
uniform int uFpKind[FP_MAX];

// Distance from d (offset from the tool center) to the edge of one half, positive inside.
// World XZ to half-local XZ, the same as toLocal() in RulerTool. The half spans local x = 0..len.
float fpHalf(vec2 d, vec2 cs, float len, float halfWidth) {
  vec2 l = vec2(d.x * cs.x - d.y * cs.y, d.x * cs.y + d.y * cs.x);
  return min(min(l.x, len - l.x), halfWidth - abs(l.y));
}

// Distance from d (offset from the token center) to the nearest edge of a quarter circle, positive
// inside. cs1, cs2: cos/sin of the two straight edges, cs2 being 90° further than cs1 (see
// alongHalf() in RulerTool: the direction of an angle a is (cos a, 0, −sin a), so d.y here is the
// world z offset). The sector is the intersection of the two half-planes and the disc, so the
// nearest edge is the smallest of the three distances.
float fpSector(vec2 d, vec2 cs1, vec2 cs2, float radius) {
  float e1 = -(d.x * cs1.y + d.y * cs1.x);
  float e2 = d.x * cs2.y + d.y * cs2.x;
  return min(min(e1, e2), radius - length(d));
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
      vec2 d = vFpWorldPos.xz - uFpRect[i].xy;
      float edge;
      if (uFpKind[i] == ${KIND_SECTOR}) {
        edge = fpSector(d, uFpDir[i].xy, uFpDir[i].zw, uFpRect[i].z);
      } else {
        // Inside the shape when inside the hinge or one of the halves. The largest distance is the
        // distance to the outer edge, so no line is drawn where the parts overlap.
        edge = max(
          uFpRect[i].w - length(d),
          max(fpHalf(d, uFpDir[i].xy, uFpRect[i].z, uFpRect[i].w), fpHalf(d, uFpDir[i].zw, uFpRect[i].z, uFpRect[i].w))
        );
      }
      if (edge < 0.0) continue;
      gl_FragColor.rgb = edge < fpPx ? uFpLine[i] : mix(gl_FragColor.rgb, uFpFill[i].rgb, uFpFill[i].a);
    }
  }
}`

// onBeforeCompile for a MeshStandardMaterial that shows tool and token footprints
export function projectFootprints(shader) {
  Object.assign(shader.uniforms, uniforms)
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>${VERTEX_DECL}`)
    .replace('#include <project_vertex>', `#include <project_vertex>${VERTEX_MAIN}`)
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>${FRAGMENT_DECL}`)
    .replace('#include <tonemapping_fragment>', `${FRAGMENT_MAIN}\n#include <tonemapping_fragment>`)
}

function setColors(i, fill, opacity, line) {
  color.set(fill)
  uniforms.uFpFill.value[i].set(color.r, color.g, color.b, opacity)
  color.set(line)
  uniforms.uFpLine.value[i].set(color.r, color.g, color.b)
}

// Takes a free slot. Returns { set, setSector, release }, or null when all slots are used.
export function acquireFootprint() {
  const i = used.indexOf(false)
  if (i < 0) return null
  used[i] = true
  return {
    // Rectangle shape, for a tool. shape: { x, z, right, left } as from toolShape() in RulerTool.
    // length: length of each half.
    set(shape, length, halfWidth, fill, opacity, line) {
      uniforms.uFpKind.value[i] = KIND_RECT
      uniforms.uFpRect.value[i].set(shape.x, shape.z, length, halfWidth)
      uniforms.uFpDir.value[i].set(Math.cos(shape.right), Math.sin(shape.right), Math.cos(shape.left), Math.sin(shape.left))
      setColors(i, fill, opacity, line)
    },
    // Quarter-circle shape, for the Zone Arc. Corner at (x, z), between the world directions of
    // angle1 and angle2 (angle2 is 90° further than angle1), out to radius.
    setSector(x, z, angle1, angle2, radius, fill, opacity, line) {
      uniforms.uFpKind.value[i] = KIND_SECTOR
      uniforms.uFpRect.value[i].set(x, z, radius, 0)
      uniforms.uFpDir.value[i].set(Math.cos(angle1), Math.sin(angle1), Math.cos(angle2), Math.sin(angle2))
      setColors(i, fill, opacity, line)
    },
    release() {
      uniforms.uFpFill.value[i].w = 0
      used[i] = false
    },
  }
}
