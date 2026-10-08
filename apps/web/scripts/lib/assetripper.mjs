// Runs AssetRipper without its browser UI. The UI is only a front end for a local HTTP server,
// so the script starts the server with --headless and calls the same routes that the UI forms post to.

import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const BINARY = path.resolve(import.meta.dirname, '../../tools/AssetRipper.GUI.Free')
const START_TIMEOUT_MS = 60_000

export async function startAssetRipper() {
  if (!fs.existsSync(BINARY)) {
    throw new Error(`AssetRipper is not at ${BINARY}. Get AssetRipper.GUI.Free for macOS arm64 from https://github.com/AssetRipper/AssetRipper/releases and put it (with libcapstone.dylib) in tools/.`)
  }
  // Without --port, AssetRipper picks a free port and prints it
  const proc = spawn(BINARY, ['--headless', '--log=false'], { cwd: path.dirname(BINARY), stdio: ['ignore', 'pipe', 'pipe'] })
  let output = ''
  const url = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`AssetRipper did not start:\n${output}`)), START_TIMEOUT_MS)
    const onData = chunk => {
      output = (output + chunk).slice(-5000)
      const m = /Now listening on: (http:\/\/\S+)/.exec(output)
      if (m) {
        clearTimeout(timer)
        resolve(m[1])
      }
    }
    proc.stdout.on('data', onData)
    proc.stderr.on('data', onData)
    proc.on('exit', code => reject(new Error(`AssetRipper exited with code ${code}:\n${output}`)))
  })
  // Keep reading, so a full pipe does not block the server
  proc.stdout.resume()
  proc.stderr.resume()
  const stop = () => proc.kill()
  process.on('exit', stop)

  // Each route answers with a redirect after the work is done.
  // The body is always read: fetch keeps the connection of a response with an unread body until garbage
  // collection, and a run that converts several bundles then waits for an answer that never comes.
  async function post(route, form = {}) {
    const res = await fetch(url + route, { method: 'POST', body: new URLSearchParams(form), redirect: 'manual' })
    const text = await res.text()
    if (res.status >= 400) throw new Error(`AssetRipper ${route} failed with HTTP ${res.status}: ${text}`)
  }

  return {
    // Loads one bundle and exports it twice into outDir:
    // primary/ has the meshes and prefabs as GLB files, project/ has the prefabs as Unity YAML with all components
    async exportBundle(bundleFile, outDir) {
      fs.rmSync(outDir, { recursive: true, force: true })
      await post('/Reset')
      await post('/LoadFile', { Path: bundleFile })
      await post('/Export/PrimaryContent', { Path: path.join(outDir, 'primary') })
      await post('/Export/UnityProject', { Path: path.join(outDir, 'project') })
    },
    stop,
  }
}
