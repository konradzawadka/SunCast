import { HEIGHT_STEP_M, HEIGHT_STEP_SHIFT_M } from './mapViewConstants'
import type { HoveredEdgeLength } from './useMapInteractions'

interface MapOverlayControlsProps {
  orbitEnabled: boolean
  onToggleOrbit: () => void
  meshesVisible: boolean
  onToggleMeshesVisible: () => void
  roofMeshesCount: number
  isDrawing: boolean
  hasActiveFootprint: boolean
  hoveredEdgeLength: HoveredEdgeLength | null
  gizmoScreenPos: { left: number; top: number } | null
  onAdjustHeight: (stepM: number) => void
  showSolveHint: boolean
  onAdjustOrbitCamera: (bearingDeltaDeg: number, pitchDeltaDeg: number) => void
}

export function MapOverlayControls({
  orbitEnabled,
  onToggleOrbit,
  meshesVisible,
  onToggleMeshesVisible,
  roofMeshesCount,
  isDrawing,
  hasActiveFootprint,
  hoveredEdgeLength,
  gizmoScreenPos,
  onAdjustHeight,
  showSolveHint,
  onAdjustOrbitCamera,
}: MapOverlayControlsProps) {
  return (
    <>
      <button type="button" className="map-orbit-toggle" onClick={onToggleOrbit} data-testid="orbit-toggle-button">
        {orbitEnabled ? 'Exit orbit' : 'Orbit'}
      </button>
      <button
        type="button"
        className="map-debug-toggle"
        onClick={onToggleMeshesVisible}
        data-testid="mesh-visibility-toggle-button"
        disabled={!orbitEnabled}
      >
        {meshesVisible ? 'Hide meshes' : 'Show meshes'}
      </button>
      {orbitEnabled && (
        <div className="map-camera-controls">
          <button
            type="button"
            data-testid="map-rotate-left-button"
            onClick={() => onAdjustOrbitCamera(-15, 0)}
            title="Rotate left"
          >
            ⟲
          </button>
          <button
            type="button"
            data-testid="map-rotate-right-button"
            onClick={() => onAdjustOrbitCamera(15, 0)}
            title="Rotate right"
          >
            ⟳
          </button>
          <button
            type="button"
            data-testid="map-pitch-up-button"
            onClick={() => onAdjustOrbitCamera(0, 6)}
            title="Pitch up"
          >
            ↥
          </button>
          <button
            type="button"
            data-testid="map-pitch-down-button"
            onClick={() => onAdjustOrbitCamera(0, -6)}
            title="Pitch down"
          >
            ↧
          </button>
        </div>
      )}
      {orbitEnabled && roofMeshesCount === 0 && !isDrawing && (
        <div className="map-debug-hint" data-testid="map-debug-hint">
          Mesh needs a solved roof (set at least 3 constraints).
        </div>
      )}
      {!isDrawing && hasActiveFootprint && <div className="map-selection-hint">Click a vertex or edge to edit its height</div>}
      {hoveredEdgeLength && !isDrawing && !orbitEnabled && (
        <div
          className="map-edge-hover-label"
          style={{ left: `${hoveredEdgeLength.left}px`, top: `${hoveredEdgeLength.top}px` }}
          data-testid="map-edge-hover-label"
        >
          {hoveredEdgeLength.lengthM.toFixed(2)} m
        </div>
      )}
      {orbitEnabled && gizmoScreenPos && (
        <div className="height-gizmo" style={{ left: `${gizmoScreenPos.left}px`, top: `${gizmoScreenPos.top}px` }}>
          <button
            type="button"
            className="height-gizmo-button"
            onClick={(event) => onAdjustHeight(event.shiftKey ? HEIGHT_STEP_SHIFT_M : HEIGHT_STEP_M)}
          >
            ▲
          </button>
          <button
            type="button"
            className="height-gizmo-button"
            onClick={(event) => onAdjustHeight(event.shiftKey ? -HEIGHT_STEP_SHIFT_M : -HEIGHT_STEP_M)}
          >
            ▼
          </button>
        </div>
      )}
      {orbitEnabled && showSolveHint && hasActiveFootprint && <div className="map-hint">Add heights to solve plane</div>}
    </>
  )
}
