import { HEIGHT_STEP_M, HEIGHT_STEP_SHIFT_M } from './mapViewConstants'
import type { DrawingAngleHint, HoveredEdgeLength, VertexDragAngleHint } from './useMapInteractions'
import { PlaceSearchPanel } from '../../place-search/PlaceSearchPanel'
import type { PlaceSearchResult } from '../../place-search/placeSearch.types'

interface MapOverlayControlsProps {
  orbitEnabled: boolean
  onToggleOrbit: () => void
  sunPerspectiveEnabled: boolean
  canUseSunPerspective: boolean
  onToggleSunPerspective: () => void
  meshesVisible: boolean
  onToggleMeshesVisible: () => void
  meshCount: number
  isDrawing: boolean
  hasActiveFootprint: boolean
  hoveredEdgeLength: HoveredEdgeLength | null
  drawingAngleHint: DrawingAngleHint | null
  vertexDragAngleHint: VertexDragAngleHint | null
  drawLengthInput: string
  onDrawLengthInputChange: (value: string) => void
  onDrawLengthInputSubmit: () => void
  gizmoScreenPos: { left: number; top: number } | null
  onAdjustHeight: (stepM: number) => void
  showSolveHint: boolean
  onAdjustOrbitCamera: (bearingDeltaDeg: number, pitchDeltaDeg: number) => void
  onPlaceSearchSelect: (result: PlaceSearchResult) => void
}

export function MapOverlayControls({
  orbitEnabled,
  onToggleOrbit,
  sunPerspectiveEnabled,
  canUseSunPerspective,
  onToggleSunPerspective,
  meshesVisible,
  onToggleMeshesVisible,
  meshCount,
  isDrawing,
  hasActiveFootprint,
  hoveredEdgeLength,
  drawingAngleHint,
  vertexDragAngleHint,
  drawLengthInput,
  onDrawLengthInputChange,
  onDrawLengthInputSubmit,
  gizmoScreenPos,
  onAdjustHeight,
  showSolveHint,
  onAdjustOrbitCamera,
  onPlaceSearchSelect,
}: MapOverlayControlsProps) {
  return (
    <>
      <div className="map-place-search">
        <PlaceSearchPanel onSelectResult={onPlaceSearchSelect} />
      </div>
      <button
        type="button"
        className="map-orbit-toggle"
        onClick={onToggleOrbit}
        title="Toggle orbit editing view for 3D interaction."
        data-testid="orbit-toggle-button"
      >
        {orbitEnabled ? 'Exit orbit' : 'Orbit'}
      </button>
      <button
        type="button"
        className="map-sun-perspective-toggle"
        onClick={onToggleSunPerspective}
        title="Align camera to sun direction (requires orbit and computed sun position)."
        data-testid="sun-perspective-toggle-button"
        disabled={!orbitEnabled || !canUseSunPerspective}
      >
        {sunPerspectiveEnabled ? 'Exit sun view' : 'Sun view'}
      </button>
      <button
        type="button"
        className="map-debug-toggle"
        onClick={onToggleMeshesVisible}
        title="Show/hide roof and obstacle meshes in orbit mode."
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
      {orbitEnabled && meshCount === 0 && !isDrawing && (
        <div className="map-debug-hint" data-testid="map-debug-hint">
          Meshes need a solved roof or at least one obstacle.
        </div>
      )}
      {hoveredEdgeLength && !isDrawing && !orbitEnabled && (
        <div
          className="map-edge-hover-label"
          style={{ left: `${hoveredEdgeLength.left}px`, top: `${hoveredEdgeLength.top}px` }}
          data-testid="map-edge-hover-label"
        >
          {hoveredEdgeLength.lengthM.toFixed(2)} m
        </div>
      )}
      {drawingAngleHint && isDrawing && !orbitEnabled && (
        <div
          className="map-draw-angle-label"
          style={{ left: `${drawingAngleHint.left}px`, top: `${drawingAngleHint.top}px` }}
          data-testid="map-draw-angle-label"
        >
          {drawingAngleHint.lengthM.toFixed(2)} m
          {drawingAngleHint.secondPointPreview && drawingAngleHint.azimuthDeg !== null && drawingAngleHint.angleFromSouthDeg !== null
            ? ` | az ${drawingAngleHint.azimuthDeg.toFixed(1)} deg | S ${drawingAngleHint.angleFromSouthDeg.toFixed(1)} deg`
            : drawingAngleHint.angleDeg !== null
              ? ` | ${drawingAngleHint.angleDeg.toFixed(1)} deg`
              : ''}
          {drawingAngleHint.snapped ? ' snap' : ''}
          <label className="map-draw-length-input-wrap" onMouseDown={(event) => event.stopPropagation()}>
            <span>Edge</span>
            <input
              type="number"
              min={0}
              step={0.01}
              inputMode="decimal"
              placeholder={drawingAngleHint.lengthM.toFixed(2)}
              value={drawLengthInput}
              title="Set exact edge length (m). Press Enter to commit point."
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => onDrawLengthInputChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  event.stopPropagation()
                  onDrawLengthInputSubmit()
                }
              }}
              className="map-draw-length-input"
              data-testid="map-draw-length-input"
            />
            <span>m</span>
          </label>
        </div>
      )}
      {vertexDragAngleHint && !isDrawing && !orbitEnabled && (
        <div
          className="map-edge-hover-label"
          style={{ left: `${vertexDragAngleHint.left}px`, top: `${vertexDragAngleHint.top}px` }}
          data-testid="map-vertex-angle-label"
        >
          {vertexDragAngleHint.angleDeg.toFixed(1)} deg
        </div>
      )}
      {orbitEnabled && gizmoScreenPos && (
        <div className="height-gizmo" style={{ left: `${gizmoScreenPos.left}px`, top: `${gizmoScreenPos.top}px` }}>
          <button
            type="button"
            className="height-gizmo-button"
            onClick={(event) => onAdjustHeight(event.shiftKey ? HEIGHT_STEP_SHIFT_M : HEIGHT_STEP_M)}
            title={`Increase selected geometry height (+${HEIGHT_STEP_M.toFixed(2)} m, Shift for +${HEIGHT_STEP_SHIFT_M.toFixed(2)} m).`}
          >
            ▲
          </button>
          <button
            type="button"
            className="height-gizmo-button"
            onClick={(event) => onAdjustHeight(event.shiftKey ? -HEIGHT_STEP_SHIFT_M : -HEIGHT_STEP_M)}
            title={`Decrease selected geometry height (-${HEIGHT_STEP_M.toFixed(2)} m, Shift for -${HEIGHT_STEP_SHIFT_M.toFixed(2)} m).`}
          >
            ▼
          </button>
        </div>
      )}
      {orbitEnabled && showSolveHint && hasActiveFootprint && <div className="map-hint">Add heights to solve plane</div>}
    </>
  )
}
