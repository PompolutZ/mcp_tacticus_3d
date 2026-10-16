import { Suspense, memo } from 'react'
import { OtherTool } from './OtherTool.jsx'
import { OtherLos } from './LosTool.jsx'
import { useRenderCount } from '../debug/renderCount.js'
import { useTableStore } from '../table/TableStoreContext.jsx'
import { useOtherPresence } from '../table/useOtherPlayer.jsx'
import { otherTeam } from '../setup/setup.js'

const toolKey = (kind, entry) => `${kind}-${entry.which}-${entry.spawn}`

// The other player's tools. It reads from the store the side, what the other player has selected (presence) and what
// LiveSync received.
function OtherTools({ otherTools, toolModels }) {
  useRenderCount('OtherTools')
  const otherSide = useTableStore((s) => otherTeam(s.ownSide))
  const received = useTableStore((s) => s.received)
  // The kinds of the other player's selected tools, as one string so a ping or a mark does not render this
  const selectedKinds = useOtherPresence((p) => p.tools.join(','))
  const selectedTools = selectedKinds.split(',')
  // The other player's tool target: the last key of their selection, as a tool model
  const otherKey = useOtherPresence((p) => p.selection.at(-1) ?? null)
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
                selected={selectedTools.includes(kind)}
                getLive={() => received.current?.tool(kind) ?? null}
              />
            )
          : entry.pose && (
              <Suspense key={toolKey(kind, entry)} fallback={null}>
                <OtherTool
                  kind={kind}
                  entry={entry}
                  team={otherSide}
                  selected={selectedTools.includes(kind)}
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

export default memo(OtherTools)
