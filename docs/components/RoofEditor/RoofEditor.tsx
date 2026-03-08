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
  const [edgeSectionOpen, setEdgeSectionOpen] = useState(false)
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
    setEdgeSectionOpen(true)
    const input = edgeInputRefs.current[selectedEdgeIndex]
    if (!input) {
      return
    }
    input.focus()
    input.select()
  }, [selectedEdgeIndex])

  if (!footprint) {
    return (
      <section className="panel-section">
        <h3>Constraints</h3>
        <p>Draw a roof polygon first.</p>
      </section>
    )
  }

  const vertexCount = footprint.vertices.length
  const activeConstraints = vertexConstraints
    .slice()
    .sort((a, b) => a.vertexIndex - b.vertexIndex)
    .map((constraint) => `V${constraint.vertexIndex}=${constraint.heightM.toFixed(2)}m`)

  const applyVertexInput = (idx: number, textValue: string) => {
    if (textValue.trim() === '') {
      return
    }
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
  }

  const applyEdgeInput = (idx: number, textValue: string) => {
    if (textValue.trim() === '') {
      return
    }
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
  }

  return (
    <section className="panel-section">
      <h3>Constraints</h3>
      <p>Set at least 3 vertex heights in meters. Edge edit sets both endpoint vertices and can auto-seed a third point.</p>
      <p>
        Active constraints:{' '}
        {activeConstraints.length > 0 ? activeConstraints.join(', ') : 'none'}
      </p>

      <div data-testid="vertex-heights-panel">
        <h4>Vertex Heights</h4>
        <div className="constraint-grid">
        {footprint.vertices.map((_, idx) => {
          const current = vertexIndex.get(idx)
          const textValue = vertexInputs[idx] ?? (selectedVertexIndex === idx && current !== undefined ? current.toFixed(2) : '')
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
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') {
                    return
                  }
                  event.preventDefault()
                  applyVertexInput(idx, textValue)
                }}
                onBlur={() => applyVertexInput(idx, textValue)}
                data-testid={`vertex-height-input-${idx}`}
              />
              <button
                type="button"
                data-testid={`vertex-height-set-${idx}`}
                onClick={() => applyVertexInput(idx, textValue)}
              >
                Set
              </button>
              <button
                type="button"
                onClick={() => onClearVertex(idx)}
                disabled={current === undefined}
                data-testid={`vertex-height-clear-${idx}`}
              >
                Clear
              </button>
            </div>
          )
          })}
        </div>
      </div>

      <details open={edgeSectionOpen} onToggle={(event) => setEdgeSectionOpen(event.currentTarget.open)}>
        <summary>Edge Heights</summary>
        <div className="constraint-grid">
          {Array.from({ length: vertexCount }).map((_, idx) => {
            const startVertex = idx
            const endVertex = (idx + 1) % vertexCount
            const startHeight = vertexIndex.get(startVertex)
            const endHeight = vertexIndex.get(endVertex)
            const current =
              startHeight !== undefined && endHeight !== undefined && startHeight === endHeight ? startHeight : undefined
            const textValue =
              edgeInputs[idx] ?? (selectedEdgeIndex === idx && current !== undefined ? current.toFixed(2) : '')
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
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter') {
                      return
                    }
                    event.preventDefault()
                    applyEdgeInput(idx, textValue)
                  }}
                  onBlur={() => applyEdgeInput(idx, textValue)}
                  data-testid={`edge-height-input-${idx}`}
                />
                <button
                  type="button"
                  data-testid={`edge-height-set-${idx}`}
                  onClick={() => applyEdgeInput(idx, textValue)}
                >
                  Set
                </button>
                <button
                  type="button"
                  onClick={() => onClearEdge(idx)}
                  disabled={startHeight === undefined && endHeight === undefined}
                  data-testid={`edge-height-clear-${idx}`}
                >
                  Clear
                </button>
              </div>
            )
          })}
        </div>
      </details>
    </section>
  )
}
