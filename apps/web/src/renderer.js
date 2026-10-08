// Finds out if the browser draws WebGL without the graphics card. Plain module, no React.

// WebGL renderers that run on the CPU: Chrome's SwiftShader, Mesa's llvmpipe and softpipe (Linux),
// and the Microsoft Basic Render Driver (WARP, Windows). A browser uses one when hardware
// acceleration is off or the graphics driver is blocked.
const SOFTWARE_RENDERER = /swiftshader|llvmpipe|softpipe|basic render driver/i
// What Chrome and Safari give for RENDERER. The real name is then in WEBGL_debug_renderer_info.
const MASKED_RENDERER = 'WebKit WebGL'

// The name of the renderer that draws the WebGL context, or null if the browser does not give it.
// Firefox gives the real name in RENDERER. It warns in the console when a page reads
// WEBGL_debug_renderer_info, so the extension is read only for a masked name.
export function rendererName(context) {
  const name = context.getParameter(context.RENDERER)
  if (name && name !== MASKED_RENDERER) return name
  const info = context.getExtension('WEBGL_debug_renderer_info')
  return info ? context.getParameter(info.UNMASKED_RENDERER_WEBGL) : null
}

export function isSoftwareRenderer(name) {
  return name != null && SOFTWARE_RENDERER.test(name)
}
