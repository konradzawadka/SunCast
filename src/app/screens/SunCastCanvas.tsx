import { MapView } from '../features/map-editor/MapView/MapView'
import { SunDailyChartPanel } from '../features/sun-tools/SunDailyChartPanel'
import { SunOverlayColumn } from '../features/sun-tools/SunOverlayColumn'
import { SunProjectionStatus } from '../features/sun-tools/SunProjectionStatus'
import type { SunCastCanvasModel } from '../hooks/useSunCastController'

interface SunCastCanvasProps {
  model: SunCastCanvasModel
}

export function SunCastCanvas({ model }: SunCastCanvasProps) {
  return (
    <main className="sun-cast-canvas">
      <MapView
        editMode={model.editMode}
        footprints={model.footprints}
        activeFootprint={model.activeFootprint}
        selectedFootprintIds={model.selectedFootprintIds}
        drawDraftRoof={model.drawDraftRoof}
        isDrawingRoof={model.isDrawingRoof}
        obstacles={model.obstacles}
        activeObstacle={model.activeObstacle}
        selectedObstacleIds={model.selectedObstacleIds}
        drawDraftObstacle={model.drawDraftObstacle}
        isDrawingObstacle={model.isDrawingObstacle}
        orbitEnabled={model.orbitEnabled}
        onToggleOrbit={model.onToggleOrbit}
        sunProjectionResult={model.sunProjectionResult}
        shadingEnabled={model.shadingEnabled}
        shadingHeatmapFeatures={model.shadingHeatmapFeatures}
        shadingComputeState={model.shadingComputeState}
        roofMeshes={model.roofMeshes}
        obstacleMeshes={model.obstacleMeshes}
        vertexConstraints={model.vertexConstraints}
        selectedVertexIndex={model.selectedVertexIndex}
        selectedEdgeIndex={model.selectedEdgeIndex}
        onSelectVertex={model.onSelectVertex}
        onSelectEdge={model.onSelectEdge}
        onSelectFootprint={model.onSelectFootprint}
        onSelectObstacle={model.onSelectObstacle}
        onClearSelection={model.onClearSelection}
        onMoveVertex={model.onMoveVertex}
        onMoveEdge={model.onMoveEdge}
        onMoveObstacleVertex={model.onMoveObstacleVertex}
        onMoveRejected={model.onMoveRejected}
        onAdjustHeight={model.onAdjustHeight}
        showSolveHint={model.showSolveHint}
        onMapClick={model.onMapClick}
        onCloseDrawing={model.onCloseDrawing}
        onObstacleMapClick={model.onObstacleMapClick}
        onCloseObstacleDrawing={model.onCloseObstacleDrawing}
        onBearingChange={model.onBearingChange}
        onPitchChange={model.onPitchChange}
        onGeometryDragStateChange={model.onGeometryDragStateChange}
        mapNavigationTarget={model.mapNavigationTarget}
        onPlaceSearchSelect={model.onPlaceSearchSelect}
        onInitialized={model.onInitialized}
      />

      <SunOverlayColumn
        datetimeIso={model.sunDatetimeRaw}
        timeZone={model.sunDailyTimeZone}
        selectedRoofs={model.selectedRoofInputs}
        onDatetimeInputChange={model.onSunDatetimeInputChange}
        productionComputationEnabled={model.productionComputationEnabled}
        expanded={model.hasSolvedActiveRoof && !model.isDrawingRoof && !model.isDrawingObstacle}
      >
        {model.hasSolvedActiveRoof ? (
          <>
            <SunProjectionStatus
              enabled={model.sunProjectionEnabled}
              hasDatetime={model.hasValidSunDatetime}
              datetimeError={model.sunDatetimeError}
              onToggleEnabled={model.onToggleSunProjectionEnabled}
              result={model.sunProjectionResult}
            />
            <SunDailyChartPanel
              dateIso={model.sunDailyDateRaw}
              timeZone={model.sunDailyTimeZone}
              selectedRoofs={model.selectedRoofInputs}
              computationEnabled={model.productionComputationEnabled}
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
