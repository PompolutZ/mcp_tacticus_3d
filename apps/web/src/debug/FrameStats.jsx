import { useEffect, useSyncExternalStore } from 'react'
import { addAfterEffect, addEffect, useThree } from '@react-three/fiber'

// The numbers are averaged over this time and sent to the panel once per period
const PERIOD_MS = 500

// Latest numbers for DebugPanel, or null before the first period ends
let latest = null
const listeners = new Set()

function publish(stats) {
  latest = stats
  for (const listener of listeners) listener()
}

function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// Latest numbers from FrameStats: { fps, worstMs, cpuMs, gpuMs, calls, triangles, width, height, dpr }.
// gpuMs is null when the browser cannot measure GPU time. The whole value is null before the first period ends.
export function useFrameStats() {
  return useSyncExternalStore(subscribe, () => latest)
}

// GPU time of a frame, with the EXT_disjoint_timer_query_webgl2 extension. null when the browser
// does not have it (Safari; Firefox without a flag). A result is ready some frames later.
function createGpuTimer(context) {
  const ext = context.getExtension('EXT_disjoint_timer_query_webgl2')
  if (!ext) return null
  // Ended queries without a result yet, oldest first
  const waiting = []
  let active = null
  return {
    begin() {
      if (active) return
      active = context.createQuery()
      context.beginQuery(ext.TIME_ELAPSED_EXT, active)
    },
    end() {
      if (!active) return
      context.endQuery(ext.TIME_ELAPSED_EXT)
      waiting.push(active)
      active = null
    },
    // Calls done(ms) for each query that has its result
    collect(done) {
      // After a disjoint event (for example a GPU clock change) the waiting results are wrong
      const disjoint = context.getParameter(ext.GPU_DISJOINT_EXT)
      while (
        waiting.length > 0 &&
        context.getQueryParameter(waiting[0], context.QUERY_RESULT_AVAILABLE)
      ) {
        const query = waiting.shift()
        if (!disjoint) done(context.getQueryParameter(query, context.QUERY_RESULT) / 1e6)
        context.deleteQuery(query)
      }
    },
    dispose() {
      if (active) context.endQuery(ext.TIME_ELAPSED_EXT)
      for (const query of [...waiting, active]) if (query) context.deleteQuery(query)
    },
  }
}

// Measures every frame and publishes the numbers for DebugPanel. Put inside the Canvas.
// A frame is one pass of the R3F loop: the useFrame callbacks (physics too) and all renders.
export default function FrameStats() {
  const gl = useThree((state) => state.gl)

  useEffect(() => {
    const info = gl.info
    const autoReset = info.autoReset
    // The composer calls render several times in a frame. With autoReset, the counts show only
    // the last call. Without it, they add up until the reset at the start of the next frame.
    info.autoReset = false
    const gpu = createGpuTimer(gl.getContext())
    let periodStart = null
    let lastTimestamp = null
    let frameStart = 0
    let frames = 0
    let worstMs = 0
    let cpuSum = 0
    let gpuSum = 0
    let gpuCount = 0
    let gpuMs = null

    const stopBefore = addEffect(() => {
      frameStart = performance.now()
      info.reset()
      gpu?.begin()
    })

    const stopAfter = addAfterEffect((timestamp) => {
      gpu?.end()
      cpuSum += performance.now() - frameStart
      gpu?.collect((ms) => {
        gpuSum += ms
        gpuCount++
      })
      if (lastTimestamp !== null) worstMs = Math.max(worstMs, timestamp - lastTimestamp)
      lastTimestamp = timestamp
      frames++
      periodStart ??= timestamp
      const elapsed = timestamp - periodStart
      if (elapsed < PERIOD_MS) return

      // Results come some frames late, so a period can have none. The last average is kept then.
      if (gpuCount > 0) gpuMs = gpuSum / gpuCount
      publish({
        fps: (frames * 1000) / elapsed,
        worstMs,
        cpuMs: cpuSum / frames,
        gpuMs,
        calls: info.render.calls,
        triangles: info.render.triangles,
        width: gl.domElement.width,
        height: gl.domElement.height,
        dpr: gl.getPixelRatio(),
      })
      periodStart = timestamp
      frames = 0
      worstMs = 0
      cpuSum = 0
      gpuSum = 0
      gpuCount = 0
    })

    return () => {
      stopBefore()
      stopAfter()
      gpu?.dispose()
      info.autoReset = autoReset
      publish(null)
    }
  }, [gl])

  return null
}
