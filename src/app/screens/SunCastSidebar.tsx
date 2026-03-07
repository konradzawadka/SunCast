import { DrawTools } from '../features/map-editor/DrawTools/DrawTools'
import { FootprintPanel } from '../components/FootprintPanel'
import { RoofEditor } from '../components/RoofEditor/RoofEditor'
import { StatusPanel } from '../components/StatusPanel'
import type { SunCastSidebarModel } from '../hooks/useSunCastController'
import { DevTools } from '../features/debug/DevTools'

interface SunCastSidebarProps {
  model: SunCastSidebarModel
}

export function SunCastSidebar({ model }: SunCastSidebarProps) {
  return (
    <aside className="sun-cast-sidebar">
      <div className="sun-cast-sidebar-title-row">
        <h2>SunCast</h2>
        <button
          type="button"
          className="sun-cast-tutorial-trigger"
          onClick={model.onStartTutorial}
          aria-label="Start tutorial"
          title="Start tutorial"
          data-testid="start-tutorial-button"
        >
          ?
        </button>
      </div>
      <p className="subtitle">Draw your roof and get short-term and long-term production forecasts.</p>

      {import.meta.env.DEV && (
        <DevTools
          footprintEntries={model.footprintEntries}
          onSelectVertex={model.onDevSelectVertex}
          onSelectEdge={model.onDevSelectEdge}
          onClearSelection={model.onDevClearSelection}
          onImportEntries={model.onDevImportEntries}
        />
      )}

      <DrawTools
        isDrawing={model.isDrawing}
        pointCount={model.drawDraftCount}
        onStart={model.onStartDrawing}
        onUndo={model.onUndoDrawing}
        onCancel={model.onCancelDrawing}
        onCommit={model.onCommitDrawing}
      />

      <FootprintPanel
        footprints={model.footprints}
        activeFootprintId={model.activeFootprintId}
        selectedFootprintIds={model.selectedFootprintIds}
        activeFootprintKwp={model.activeFootprint?.kwp ?? null}
        onSelectFootprint={model.onSelectFootprint}
        onSetActiveFootprintKwp={model.onSetActiveFootprintKwp}
        onDeleteActiveFootprint={model.onDeleteActiveFootprint}
      />

      <RoofEditor
        footprint={model.activeFootprint}
        vertexConstraints={model.activeConstraints.vertexHeights}
        selectedVertexIndex={model.selectedVertexIndex}
        selectedEdgeIndex={model.selectedEdgeIndex}
        onSetVertex={model.onSetVertex}
        onSetEdge={model.onSetEdge}
        onClearVertex={model.onClearVertex}
        onClearEdge={model.onClearEdge}
        onConstraintLimitExceeded={model.onConstraintLimitExceeded}
      />

      <StatusPanel
        footprintErrors={model.footprintErrors}
        interactionError={model.interactionError}
        solverError={model.solverError}
        warnings={model.warnings}
        pitchDeg={model.pitchDeg}
        azimuthDeg={model.azimuthDeg}
        roofAreaM2={model.roofAreaM2}
        minHeightM={model.minHeightM}
        maxHeightM={model.maxHeightM}
        fitRmsErrorM={model.fitRmsErrorM}
      />
    </aside>
  )
}
