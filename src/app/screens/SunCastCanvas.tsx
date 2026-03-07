import { MapView } from '../components/MapView/MapView'
import { SunDailyChartPanel } from '../components/SunDailyChartPanel'
import { SunOverlayColumn, type SelectedRoofSunInput } from '../components/SunOverlayColumn'
import { SunProjectionStatus } from '../components/SunProjectionStatus'
import type { SunProjectionResult } from '../../geometry/sun/sunProjection'
import type { FootprintPolygon, RoofMeshData, VertexHeightConstraint } from '../../types/geometry'

interface SunCastCanvasProps {
  footprints: FootprintPolygon[]
  activeFootprint: FootprintPolygon | null
  selectedFootprintIds: string[]
  drawDraft: Array<[number, number]>
  isDrawing: boolean
  orbitEnabled: boolean
  roofMeshes: RoofMeshData[]
  vertexConstraints: VertexHeightConstraint[]
  selectedVertexIndex: number | null
  selectedEdgeIndex: number | null
  showSolveHint: boolean
  sunProjectionEnabled: boolean
  hasValidSunDatetime: boolean
  sunDatetimeError: string | null
  sunProjectionResult: SunProjectionResult | null
  sunDatetimeRaw: string
  sunDailyDateRaw: string
  sunDailyTimeZone: string
  selectedRoofInputs: SelectedRoofSunInput[]
  hasSolvedActiveRoof: boolean
  onToggleOrbit: () => void
  onSelectVertex: (vertexIndex: number) => void
  onSelectEdge: (edgeIndex: number) => void
  onSelectFootprint: (footprintId: string, multiSelect: boolean) => void
  onClearSelection: () => void
  onMoveVertex: (vertexIndex: number, point: [number, number]) => boolean
  onMoveEdge: (edgeIndex: number, delta: [number, number]) => boolean
  onMoveRejected: () => void
  onAdjustHeight: (stepM: number) => void
  onMapClick: (point: [number, number]) => void
  onBearingChange: (bearingDeg: number) => void
  onPitchChange: (pitchDeg: number) => void
  onInitialized: () => void
  onToggleSunProjectionEnabled: (enabled: boolean) => void
  onSunDatetimeInputChange: (datetimeIsoRaw: string) => void
}

export function SunCastCanvas({
  footprints,
  activeFootprint,
  selectedFootprintIds,
  drawDraft,
  isDrawing,
  orbitEnabled,
  roofMeshes,
  vertexConstraints,
  selectedVertexIndex,
  selectedEdgeIndex,
  showSolveHint,
  sunProjectionEnabled,
  hasValidSunDatetime,
  sunDatetimeError,
  sunProjectionResult,
  sunDatetimeRaw,
  sunDailyDateRaw,
  sunDailyTimeZone,
  selectedRoofInputs,
  hasSolvedActiveRoof,
  onToggleOrbit,
  onSelectVertex,
  onSelectEdge,
  onSelectFootprint,
  onClearSelection,
  onMoveVertex,
  onMoveEdge,
  onMoveRejected,
  onAdjustHeight,
  onMapClick,
  onBearingChange,
  onPitchChange,
  onInitialized,
  onToggleSunProjectionEnabled,
  onSunDatetimeInputChange,
}: SunCastCanvasProps) {
  return (
    <main className="sun-cast-canvas">
      <MapView
        footprints={footprints}
        activeFootprint={activeFootprint}
        selectedFootprintIds={selectedFootprintIds}
        drawDraft={drawDraft}
        isDrawing={isDrawing}
        orbitEnabled={orbitEnabled}
        onToggleOrbit={onToggleOrbit}
        roofMeshes={roofMeshes}
        vertexConstraints={vertexConstraints}
        selectedVertexIndex={selectedVertexIndex}
        selectedEdgeIndex={selectedEdgeIndex}
        onSelectVertex={onSelectVertex}
        onSelectEdge={onSelectEdge}
        onSelectFootprint={onSelectFootprint}
        onClearSelection={onClearSelection}
        onMoveVertex={onMoveVertex}
        onMoveEdge={onMoveEdge}
        onMoveRejected={onMoveRejected}
        onAdjustHeight={onAdjustHeight}
        showSolveHint={showSolveHint}
        onMapClick={onMapClick}
        onBearingChange={onBearingChange}
        onPitchChange={onPitchChange}
        onInitialized={onInitialized}
      />

      <SunOverlayColumn
        datetimeIso={sunDatetimeRaw}
        timeZone={sunDailyTimeZone}
        selectedRoofs={selectedRoofInputs}
        onDatetimeInputChange={onSunDatetimeInputChange}
        expanded={hasSolvedActiveRoof && !isDrawing}
      >
        {hasSolvedActiveRoof ? (
          <>
            <SunProjectionStatus
              enabled={sunProjectionEnabled}
              hasDatetime={hasValidSunDatetime}
              datetimeError={sunDatetimeError}
              onToggleEnabled={onToggleSunProjectionEnabled}
              result={sunProjectionResult}
            />
            <SunDailyChartPanel
              dateIso={sunDailyDateRaw}
              timeZone={sunDailyTimeZone}
              selectedRoofs={selectedRoofInputs}
            />
          </>
        ) : (
          <section className="panel-section">
            <h3>Sun Tools</h3>
            <p>Solve a roof plane first to enable projection and daily production chart.</p>
          </section>
        )}
      </SunOverlayColumn>
    </main>
  )
}
