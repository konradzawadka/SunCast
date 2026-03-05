import { useMemo, useState } from 'react'
import { DrawTools } from '../components/DrawTools/DrawTools'
import { MapView } from '../components/MapView/MapView'
import { RoofEditor } from '../components/RoofEditor/RoofEditor'
import { useProjectStore } from '../../state/project-store'
import { validateFootprint } from '../../geometry/solver/validation'
import { solveRoofPlane } from '../../geometry/solver/solveRoofPlane'
import { generateRoofMesh } from '../../geometry/mesh/generateRoofMesh'
import { computeRoofMetrics } from '../../geometry/solver/metrics'
import { RoofSolverError } from '../../geometry/solver/errors'
import type { LngLat, RoofMeshData, SolvedRoofPlane } from '../../types/geometry'

interface SolvedEntry {
  footprintId: string
  solution: SolvedRoofPlane
  mesh: RoofMeshData
  metrics: ReturnType<typeof computeRoofMetrics>
}

export function EditorScreen() {
  const [orbitEnabled, setOrbitEnabled] = useState(false)
  const [selectedVertexIndex, setSelectedVertexIndex] = useState<number | null>(null)
  const [selectedEdgeIndex, setSelectedEdgeIndex] = useState<number | null>(null)
  const [interactionError, setInteractionError] = useState<string | null>(null)
  const {
    state,
    activeFootprint,
    activeConstraints,
    startDrawing,
    cancelDrawing,
    addDraftPoint,
    undoDraftPoint,
    commitFootprint,
    setActiveFootprint,
    deleteFootprint,
    moveVertex,
    moveEdge,
    setVertexHeight,
    setVertexHeights,
    setEdgeHeight,
    clearVertexHeight,
    clearEdgeHeight,
  } = useProjectStore()

  const footprintEntries = useMemo(() => Object.values(state.footprints), [state.footprints])
  const footprints = useMemo(() => footprintEntries.map((entry) => entry.footprint), [footprintEntries])

  const activeFootprintErrors = validateFootprint(activeFootprint)

  const vertexCount = activeFootprint?.vertices.length ?? 0
  const safeSelectedVertexIndex =
    !activeFootprint ||
    state.isDrawing ||
    selectedVertexIndex === null ||
    selectedVertexIndex < 0 ||
    selectedVertexIndex >= vertexCount
      ? null
      : selectedVertexIndex
  const safeSelectedEdgeIndex =
    !activeFootprint || state.isDrawing || selectedEdgeIndex === null || selectedEdgeIndex < 0 || selectedEdgeIndex >= vertexCount
      ? null
      : selectedEdgeIndex
  const constraintMap = useMemo(
    () => new Map(activeConstraints.vertexHeights.map((constraint) => [constraint.vertexIndex, constraint.heightM])),
    [activeConstraints.vertexHeights],
  )

  const applyVertexHeight = (vertexIndex: number, heightM: number): boolean => {
    const applied = setVertexHeight(vertexIndex, heightM)
    if (!applied) {
      setInteractionError('Max 3 height points')
      return false
    }
    setInteractionError(null)
    return true
  }

  const applyEdgeHeight = (edgeIndex: number, heightM: number): boolean => {
    const applied = setEdgeHeight(edgeIndex, heightM)
    if (!applied) {
      setInteractionError('Max 3 height points')
      return false
    }
    setInteractionError(null)
    return true
  }

  const moveVertexIfValid = (vertexIndex: number, point: LngLat): boolean => {
    if (!activeFootprint) {
      return false
    }
    const nextVertices = [...activeFootprint.vertices]
    if (vertexIndex < 0 || vertexIndex >= nextVertices.length) {
      return false
    }
    nextVertices[vertexIndex] = point
    const errors = validateFootprint({ ...activeFootprint, vertices: nextVertices })
    if (errors.length > 0) {
      return false
    }
    moveVertex(vertexIndex, point)
    setInteractionError(null)
    return true
  }

  const moveEdgeIfValid = (edgeIndex: number, delta: LngLat): boolean => {
    if (!activeFootprint) {
      return false
    }
    const vertexTotal = activeFootprint.vertices.length
    if (edgeIndex < 0 || edgeIndex >= vertexTotal) {
      return false
    }
    const [deltaLon, deltaLat] = delta
    const start = edgeIndex
    const end = (edgeIndex + 1) % vertexTotal
    const nextVertices = [...activeFootprint.vertices]
    nextVertices[start] = [nextVertices[start][0] + deltaLon, nextVertices[start][1] + deltaLat]
    nextVertices[end] = [nextVertices[end][0] + deltaLon, nextVertices[end][1] + deltaLat]
    const errors = validateFootprint({ ...activeFootprint, vertices: nextVertices })
    if (errors.length > 0) {
      return false
    }
    moveEdge(edgeIndex, delta)
    setInteractionError(null)
    return true
  }

  const applyHeightStep = (stepM: number) => {
    if (!activeFootprint) {
      return
    }

    if (safeSelectedVertexIndex !== null) {
      const current = constraintMap.get(safeSelectedVertexIndex) ?? 0
      applyVertexHeight(safeSelectedVertexIndex, current + stepM)
      return
    }

    if (safeSelectedEdgeIndex !== null) {
      const vertexTotal = activeFootprint.vertices.length
      const start = safeSelectedEdgeIndex
      const end = (safeSelectedEdgeIndex + 1) % vertexTotal
      const nextStart = (constraintMap.get(start) ?? 0) + stepM
      const nextEnd = (constraintMap.get(end) ?? 0) + stepM
      const applied = setVertexHeights([
        { vertexIndex: start, heightM: nextStart },
        { vertexIndex: end, heightM: nextEnd },
      ])
      if (!applied) {
        setInteractionError('Max 3 height points')
        return
      }
      setInteractionError(null)
    }
  }

  const solved = useMemo(() => {
    const solvedEntries: SolvedEntry[] = []
    let activeError: string | null = null

    for (const entry of footprintEntries) {
      const errors = validateFootprint(entry.footprint)
      if (errors.length > 0) {
        if (entry.footprint.id === state.activeFootprintId) {
          activeError = errors[0]
        }
        continue
      }

      try {
        const solution = solveRoofPlane(entry.footprint, entry.constraints)
        const mesh = generateRoofMesh(entry.footprint, solution.vertexHeightsM)
        const metrics = computeRoofMetrics(solution.plane, mesh)
        solvedEntries.push({
          footprintId: entry.footprint.id,
          solution,
          mesh,
          metrics,
        })
      } catch (error) {
        if (entry.footprint.id !== state.activeFootprintId) {
          continue
        }

        activeError =
          error instanceof RoofSolverError
            ? `${error.code}: ${error.message}`
            : error instanceof Error
              ? error.message
              : 'Failed to solve roof plane'
      }
    }

    const activeSolved = state.activeFootprintId
      ? solvedEntries.find((entry) => entry.footprintId === state.activeFootprintId) ?? null
      : null

    return {
      entries: solvedEntries,
      activeSolved,
      activeError,
    }
  }, [footprintEntries, state.activeFootprintId])

  return (
    <div className="editor-layout">
      <aside className="editor-panel">
        <h2>SunCast Editor</h2>
        <p className="subtitle">Geometry-first roof modeling on satellite imagery</p>

        <DrawTools
          isDrawing={state.isDrawing}
          pointCount={state.drawDraft.length}
          onStart={() => {
            setSelectedVertexIndex(null)
            setSelectedEdgeIndex(null)
            setInteractionError(null)
            startDrawing()
          }}
          onUndo={undoDraftPoint}
          onCancel={() => {
            cancelDrawing()
            setSelectedVertexIndex(null)
            setSelectedEdgeIndex(null)
            setInteractionError(null)
          }}
          onCommit={() => {
            commitFootprint()
            setSelectedVertexIndex(null)
            setSelectedEdgeIndex(null)
            setInteractionError(null)
          }}
        />

        <section className="panel-section">
          <h3>Footprints</h3>
          {footprints.length === 0 ? (
            <p>No footprints yet.</p>
          ) : (
            <div className="footprint-list">
              {footprints.map((footprint) => {
                const isActive = footprint.id === state.activeFootprintId
                return (
                  <button
                    key={footprint.id}
                    type="button"
                    className={`footprint-list-item${isActive ? ' footprint-list-item-active' : ''}`}
                    onClick={() => {
                      setActiveFootprint(footprint.id)
                      setSelectedVertexIndex(null)
                      setSelectedEdgeIndex(null)
                      setInteractionError(null)
                    }}
                  >
                    {footprint.id}
                  </button>
                )
              })}
            </div>
          )}

          <button
            type="button"
            disabled={!state.activeFootprintId}
            onClick={() => {
              if (!state.activeFootprintId) {
                return
              }
              deleteFootprint(state.activeFootprintId)
              setSelectedVertexIndex(null)
              setSelectedEdgeIndex(null)
              setInteractionError(null)
            }}
          >
            Delete Active Footprint
          </button>
        </section>

        <RoofEditor
          footprint={activeFootprint}
          vertexConstraints={activeConstraints.vertexHeights}
          selectedVertexIndex={safeSelectedVertexIndex}
          selectedEdgeIndex={safeSelectedEdgeIndex}
          onSetVertex={applyVertexHeight}
          onSetEdge={applyEdgeHeight}
          onClearVertex={clearVertexHeight}
          onClearEdge={clearEdgeHeight}
          onConstraintLimitExceeded={() => setInteractionError('Max 3 height points')}
        />

        <section className="panel-section">
          <h3>Status</h3>
          {activeFootprintErrors.map((error) => (
            <p key={error} className="status-error">
              {error}
            </p>
          ))}
          {interactionError && <p className="status-error">{interactionError}</p>}

          {solved.activeError && <p className="status-error">{solved.activeError}</p>}

          {solved.activeSolved && (
            <>
              {solved.activeSolved.solution.warnings.map((warning) => (
                <p key={`${warning.code}:${warning.message}`} className="status-warning">
                  {warning.code}: {warning.message}
                </p>
              ))}
              <p>Pitch: {solved.activeSolved.metrics.pitchDeg.toFixed(2)} deg</p>
              <p>Downslope azimuth: {solved.activeSolved.metrics.azimuthDeg.toFixed(1)} deg</p>
              <p>Roof area: {solved.activeSolved.metrics.roofAreaM2.toFixed(2)} m2</p>
              <p>
                Height range: {solved.activeSolved.metrics.minHeightM.toFixed(2)}m -{' '}
                {solved.activeSolved.metrics.maxHeightM.toFixed(2)}m
              </p>
              <p>Fit RMS error: {solved.activeSolved.solution.rmsErrorM.toFixed(3)} m</p>
            </>
          )}
        </section>
      </aside>

      <main className="editor-map-wrap">
        <MapView
          footprints={footprints}
          activeFootprint={activeFootprint}
          drawDraft={state.drawDraft}
          isDrawing={state.isDrawing}
          orbitEnabled={orbitEnabled}
          onToggleOrbit={() => setOrbitEnabled((enabled) => !enabled)}
          roofMeshes={solved.entries.map((entry) => entry.mesh)}
          vertexConstraints={activeConstraints.vertexHeights}
          selectedVertexIndex={safeSelectedVertexIndex}
          selectedEdgeIndex={safeSelectedEdgeIndex}
          onSelectVertex={(vertexIndex) => {
            setSelectedVertexIndex(vertexIndex)
            setSelectedEdgeIndex(null)
            setInteractionError(null)
          }}
          onSelectEdge={(edgeIndex) => {
            setSelectedEdgeIndex(edgeIndex)
            setSelectedVertexIndex(null)
            setInteractionError(null)
          }}
          onSelectFootprint={(footprintId) => {
            setActiveFootprint(footprintId)
            setSelectedVertexIndex(null)
            setSelectedEdgeIndex(null)
            setInteractionError(null)
          }}
          onClearSelection={() => {
            setSelectedVertexIndex(null)
            setSelectedEdgeIndex(null)
            setInteractionError(null)
          }}
          onMoveVertex={moveVertexIfValid}
          onMoveEdge={moveEdgeIfValid}
          onMoveRejected={() => setInteractionError('Footprint cannot self-intersect')}
          onAdjustHeight={applyHeightStep}
          showSolveHint={!solved.activeSolved}
          onMapClick={addDraftPoint}
        />
      </main>
    </div>
  )
}
