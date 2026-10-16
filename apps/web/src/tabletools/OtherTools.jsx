import { Suspense } from 'react'
import { OtherTool } from './OtherTool.jsx'
import { OtherLos } from './LosTool.jsx'
import { useRenderCount } from '../debug/renderCount.js'

const toolKey = (kind, entry) => `${kind}-${entry.which}-${entry.spawn}`

// The other player's tools. otherLook: what LiveSync shows of that player (selection, tools). received:
// the ref of what LiveSync received (Scene.jsx).
export default function OtherTools({ otherTools, otherSide, otherLook, toolModels, received }) {
  useRenderCount('OtherTools')
  // The other player's tool target: the last key of their selection, as a tool model
  const otherKey = otherLook.selection.at(-1)
  const otherTarget = otherKey
    ? (toolModels.find((model) => `${model.kind}:${model.id}` === otherKey) ?? null)
    : null

  return (
    <>
      {Object.entries(otherTools).map(([kind, entry]) =>
        kind === 'los'
          ? entry.pose && (
              <OtherLos
                key={toolKey(kind, entry)}
                entry={entry}
                models={toolModels}
                selected={otherLook.tools.includes(kind)}
                getLive={() => received.current?.tool(kind) ?? null}
              />
            )
          : entry.pose && (
              <Suspense key={toolKey(kind, entry)} fallback={null}>
                <OtherTool
                  kind={kind}
                  entry={entry}
                  team={otherSide}
                  selected={otherLook.tools.includes(kind)}
                  target={otherTarget}
                  rangeFrom={
                    kind === 'range' && entry.which === 1 && entry.snap
                      ? (toolModels.find(
                          (model) => model.kind === entry.snap.kind && model.id === entry.snap.id,
                        ) ?? null)
                      : null
                  }
                  getLive={() => received.current?.tool(kind) ?? null}
                />
              </Suspense>
            ),
      )}
    </>
  )
}
