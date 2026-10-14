import { Component, Fragment } from 'react'
import { reportError } from './errors.js'
import { tooManyErrors } from './restartCount.js'

// Error boundary around the <Canvas>. R3F throws a scene error to the parent of the Canvas, and with no
// boundary React unmounts the whole app (black screen). Here the error is logged and the Canvas mounts
// again with a new key: a new Physics world, and the scene reads the document state again. Three errors
// within 10 s show a Reload button instead of a loop. See docs/features/table-tools.md, "Recovery".
export class SceneBoundary extends Component {
  state = { key: 0, failed: false }
  times = []

  static getDerivedStateFromError() {
    return { error: true }
  }

  componentDidCatch(error) {
    console.error('[scene error] the 3D view failed, mounting it again', error)
    reportError('scene', error)
    const failed = tooManyErrors(this.times, Date.now())
    this.setState((s) => ({ key: s.key + 1, failed, error: false }))
  }

  render() {
    if (this.state.failed) {
      return (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            color: '#fff',
          }}
        >
          <div>The 3D view keeps failing.</div>
          <button type="button" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      )
    }
    if (this.state.error) return null
    return <Fragment key={this.state.key}>{this.props.children}</Fragment>
  }
}
