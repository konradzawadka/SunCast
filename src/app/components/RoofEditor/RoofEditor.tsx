import { useEffect, useMemo, useRef, useState } from 'react'
import type { FootprintPolygon, VertexHeightConstraint } from '../../../types/geometry'

interface RoofEditorProps {
  footprint: FootprintPolygon | null
  vertexConstraints: VertexHeightConstraint[]
  selectedVertexIndex: number | null
  selectedEdgeIndex: number | null
  onSetVertex: (idx: number, value: number) => boolean
  onSetEdge: (idx: number, value: number) => boolean
  onClearVertex: (idx: number) => void
  onClearEdge: (idx: number) => void
  onConstraintLimitExceeded: () => void
}

function indexByVertex(constraints: VertexHeightConstraint[]): Map<number, number> {
  return new Map(constraints.map((c) => [c.vertexIndex, c.heightM]))
}

export function RoofEditor({
  footprint,
  vertexConstraints,
  selectedVertexIndex,
  selectedEdgeIndex,
  onSetVertex,
  onSetEdge,
  onClearVertex,
  onClearEdge,
  onConstraintLimitExceeded,
}: RoofEditorProps) {
  const [vertexInputs, setVertexInputs] = useState<Record<number, string>>({})
  const [edgeInputs, setEdgeInputs] = useState<Record<number, string>>({})
  const vertexInputRefs = useRef<Record<number, HTMLInputElement | null>>({})
  const edgeInputRefs = useRef<Record<number, HTMLInputElement | null>>({})

  const vertexIndex = useMemo(() => indexByVertex(vertexConstraints), [vertexConstraints])

  useEffect(() => {
    if (selectedVertexIndex === null) {
      return
    }
    const input = vertexInputRefs.current[selectedVertexIndex]
    if (!input) {
      return
    }
    input.focus()
    input.select()
  }, [selectedVertexIndex])

  useEffect(() => {
    if (selectedEdgeIndex === null) {
      return
    }
    const input = edgeInputRefs.current[selectedEdgeIndex]
    if (!input) {
      return
    }
    input.focus()
    input.select()
  }, [selectedEdgeIndex])

  useEffect(() => {
    if (selectedVertexIndex === null) {
      return
    }
    const current = vertexIndex.get(selectedVertexIndex)
    if (current === undefined) {
      return
    }
    setVertexInputs((prev) => ({
      ...prev,
      [selectedVertexIndex]: current.toFixed(2),
    }))
  }, [selectedVertexIndex, vertexIndex])

  useEffect(() => {
    if (selectedEdgeIndex === null || !footprint) {
      return
    }
    const startHeight = vertexIndex.get(selectedEdgeIndex)
    const endHeight = vertexIndex.get((selectedEdgeIndex + 1) % footprint.vertices.length)
    if (startHeight === undefined || endHeight === undefined || startHeight !== endHeight) {
      return
    }
    setEdgeInputs((prev) => ({
      ...prev,
      [selectedEdgeIndex]: startHeight.toFixed(2),
    }))
  }, [selectedEdgeIndex, vertexIndex, footprint])

  if (!footprint) {
    return (
      <section className="panel-section">
        <h3>Constraints</h3>
        <p>Draw a footprint polygon first.</p>
      </section>
    )
  }

  const vertexCount = footprint.vertices.length

  return (
    <section className="panel-section">
      <h3>Constraints</h3>
      <p>Set exactly 3 vertex heights in meters. Edge edit is a helper that sets both endpoint vertices.</p>

      <h4>Vertex Heights</h4>
      <div className="constraint-grid">
        {footprint.vertices.map((_, idx) => {
          const current = vertexIndex.get(idx)
          const textValue = vertexInputs[idx] ?? ''
          const isSelectedByEdge =
            selectedEdgeIndex !== null && (idx === selectedEdgeIndex || idx === (selectedEdgeIndex + 1) % vertexCount)
          const isSelected = selectedVertexIndex === idx || isSelectedByEdge

          return (
            <div key={`vertex-${idx}`} className={`constraint-row${isSelected ? ' constraint-row-selected' : ''}`}>
              <span>V{idx}</span>
              <input
                ref={(node) => {
                  vertexInputRefs.current[idx] = node
                }}
                type="number"
                step="0.01"
                placeholder={current !== undefined ? current.toFixed(2) : 'm'}
                value={textValue}
                onChange={(event) =>
                  setVertexInputs((prev) => ({
                    ...prev,
                    [idx]: event.target.value,
                  }))
                }
              />
              <button
                type="button"
                onClick={() => {
                  const value = Number(textValue)
                  if (!Number.isFinite(value)) {
                    return
                  }
                  const applied = onSetVertex(idx, value)
                  if (!applied) {
                    onConstraintLimitExceeded()
                    return
                  }
                  setVertexInputs((prev) => ({ ...prev, [idx]: '' }))
                }}
              >
                Set
              </button>
              <button type="button" onClick={() => onClearVertex(idx)} disabled={current === undefined}>
                Clear
              </button>
            </div>
          )
        })}
      </div>

      <h4>Edge Heights</h4>
      <div className="constraint-grid">
        {Array.from({ length: vertexCount }).map((_, idx) => {
          const startVertex = idx
          const endVertex = (idx + 1) % vertexCount
          const startHeight = vertexIndex.get(startVertex)
          const endHeight = vertexIndex.get(endVertex)
          const current =
            startHeight !== undefined && endHeight !== undefined && startHeight === endHeight ? startHeight : undefined
          const textValue = edgeInputs[idx] ?? ''
          const isSelected = selectedEdgeIndex === idx

          return (
            <div key={`edge-${idx}`} className={`constraint-row${isSelected ? ' constraint-row-selected' : ''}`}>
              <span>
                E{idx} (V{idx}-V{(idx + 1) % vertexCount})
              </span>
              <input
                ref={(node) => {
                  edgeInputRefs.current[idx] = node
                }}
                type="number"
                step="0.01"
                placeholder={current !== undefined ? current.toFixed(2) : 'm'}
                value={textValue}
                onChange={(event) =>
                  setEdgeInputs((prev) => ({
                    ...prev,
                    [idx]: event.target.value,
                  }))
                }
              />
              <button
                type="button"
                onClick={() => {
                  const value = Number(textValue)
                  if (!Number.isFinite(value)) {
                    return
                  }
                  const applied = onSetEdge(idx, value)
                  if (!applied) {
                    onConstraintLimitExceeded()
                    return
                  }
                  setEdgeInputs((prev) => ({ ...prev, [idx]: '' }))
                }}
              >
                Set
              </button>
              <button
                type="button"
                onClick={() => onClearEdge(idx)}
                disabled={startHeight === undefined && endHeight === undefined}
              >
                Clear
              </button>
            </div>
          )
        })}
      </div>
    </section>
  )
}
