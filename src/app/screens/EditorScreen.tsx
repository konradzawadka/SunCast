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

export function EditorScreen() {
  const [orbitEnabled, setOrbitEnabled] = useState(false)
  const [selectedVertexIndex, setSelectedVertexIndex] = useState<number | null>(null)
  const [selectedEdgeIndex, setSelectedEdgeIndex] = useState<number | null>(null)
  const {
    state,
    startDrawing,
    cancelDrawing,
    addDraftPoint,
    undoDraftPoint,
    commitFootprint,
    setVertexHeight,
    setEdgeHeight,
    clearVertexHeight,
    clearEdgeHeight,
  } = useProjectStore()

  const footprintErrors = validateFootprint(state.footprint)

  const vertexCount = state.footprint?.vertices.length ?? 0
  const safeSelectedVertexIndex =
    !state.footprint || state.isDrawing || selectedVertexIndex === null || selectedVertexIndex < 0 || selectedVertexIndex >= vertexCount
      ? null
      : selectedVertexIndex
  const safeSelectedEdgeIndex =
    !state.footprint || state.isDrawing || selectedEdgeIndex === null || selectedEdgeIndex < 0 || selectedEdgeIndex >= vertexCount
      ? null
      : selectedEdgeIndex

  const solved = useMemo(() => {
    if (!state.footprint || footprintErrors.length > 0) {
      return null
    }

    try {
      const solution = solveRoofPlane(state.footprint, state.constraints)
      const mesh = generateRoofMesh(state.footprint, solution.vertexHeightsM)
      const metrics = computeRoofMetrics(solution.plane, mesh)
      return { solution, mesh, metrics, error: null }
    } catch (error) {
      const message =
        error instanceof RoofSolverError
          ? `${error.code}: ${error.message}`
          : error instanceof Error
            ? error.message
            : 'Failed to solve roof plane'
      return { solution: null, mesh: null, metrics: null, error: message }
    }
  }, [state.constraints, state.footprint, footprintErrors])

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
            startDrawing()
          }}
          onUndo={undoDraftPoint}
          onCancel={() => {
            cancelDrawing()
            setSelectedVertexIndex(null)
            setSelectedEdgeIndex(null)
          }}
          onCommit={() => {
            commitFootprint()
            setSelectedVertexIndex(null)
            setSelectedEdgeIndex(null)
          }}
        />

        <RoofEditor
          footprint={state.footprint}
          vertexConstraints={state.constraints.vertexHeights}
          selectedVertexIndex={safeSelectedVertexIndex}
          selectedEdgeIndex={safeSelectedEdgeIndex}
          onSetVertex={setVertexHeight}
          onSetEdge={setEdgeHeight}
          onClearVertex={clearVertexHeight}
          onClearEdge={clearEdgeHeight}
        />

        <section className="panel-section">
          <h3>Status</h3>
          {footprintErrors.map((error) => (
            <p key={error} className="status-error">
              {error}
            </p>
          ))}

          {solved?.error && <p className="status-error">{solved.error}</p>}

          {solved?.solution && (
            <>
              {solved.solution.warnings.map((warning) => (
                <p key={`${warning.code}:${warning.message}`} className="status-warning">
                  {warning.code}: {warning.message}
                </p>
              ))}
              <p>Pitch: {solved.metrics!.pitchDeg.toFixed(2)} deg</p>
              <p>Downslope azimuth: {solved.metrics!.azimuthDeg.toFixed(1)} deg</p>
              <p>Roof area: {solved.metrics!.roofAreaM2.toFixed(2)} m2</p>
              <p>
                Height range: {solved.metrics!.minHeightM.toFixed(2)}m - {solved.metrics!.maxHeightM.toFixed(2)}m
              </p>
              <p>Fit RMS error: {solved.solution.rmsErrorM.toFixed(3)} m</p>
            </>
          )}
        </section>
      </aside>

      <main className="editor-map-wrap">
        <MapView
          footprint={state.footprint}
          drawDraft={state.drawDraft}
          isDrawing={state.isDrawing}
          orbitEnabled={orbitEnabled}
          onToggleOrbit={() => setOrbitEnabled((enabled) => !enabled)}
          roofMesh={solved?.mesh ?? null}
          vertexConstraints={state.constraints.vertexHeights}
          selectedVertexIndex={safeSelectedVertexIndex}
          selectedEdgeIndex={safeSelectedEdgeIndex}
          onSelectVertex={(vertexIndex) => {
            setSelectedVertexIndex(vertexIndex)
            setSelectedEdgeIndex(null)
          }}
          onSelectEdge={(edgeIndex) => {
            setSelectedEdgeIndex(edgeIndex)
            setSelectedVertexIndex(null)
          }}
          onClearSelection={() => {
            setSelectedVertexIndex(null)
            setSelectedEdgeIndex(null)
          }}
          showSolveHint={!solved?.solution}
          onMapClick={addDraftPoint}
        />
      </main>
    </div>
  )
}
