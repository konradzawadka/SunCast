import { useEffect, useState } from 'react'
import { DrawTools } from '../features/map-editor/DrawTools/DrawTools'
import { FootprintPanel } from '../components/FootprintPanel'
import { ObstaclePanel } from '../components/ObstaclePanel'
import { RoofEditor } from '../components/RoofEditor/RoofEditor'
import { StatusPanel } from '../components/StatusPanel'
import type { SunCastSidebarModel } from '../hooks/useSunCastController'
import { DevTools } from '../features/debug/DevTools'
import { TutorialIntroOverlay } from '../features/tutorial/Tutorial/TutorialIntroOverlay'

interface SunCastSidebarProps {
  model: SunCastSidebarModel
}

export function SunCastSidebar({ model }: SunCastSidebarProps) {
  const [tutorialIntroVisible, setTutorialIntroVisible] = useState(false)
  const activeEditorTab = model.editMode

  useEffect(() => {
    if (!tutorialIntroVisible) {
      return
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setTutorialIntroVisible(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [tutorialIntroVisible])

  return (
    <aside className="sun-cast-sidebar">
      <div className="sun-cast-sidebar-title-row">
        <h2>SunCast</h2>
        <button
          type="button"
          className="sun-cast-tutorial-trigger"
          onClick={() => setTutorialIntroVisible(true)}
          aria-label="Start tutorial"
          title="Start guided tutorial"
          data-testid="start-tutorial-button"
        >
          ?
        </button>
      </div>
      {tutorialIntroVisible && (
        <TutorialIntroOverlay
          onStartInteractiveTutorial={() => {
            setTutorialIntroVisible(false)
            model.onStartTutorial()
          }}
          onClose={() => setTutorialIntroVisible(false)}
        />
      )}
      <p className="subtitle">Draw your roof and get short-term and long-term production forecasts.</p>
      {model.shareError && <p className="status-error">{model.shareError}</p>}
      {!model.shareError && model.shareSuccess && <p className="status-success">{model.shareSuccess}</p>}

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
        editMode={model.editMode}
        isDrawingRoof={model.isDrawingRoof}
        isDrawingObstacle={model.isDrawingObstacle}
        roofPointCount={model.drawDraftCountRoof}
        obstaclePointCount={model.drawDraftCountObstacle}
        onSetEditMode={model.onSetEditMode}
        onStartRoofDrawing={model.onStartDrawing}
        onUndoRoofDrawing={model.onUndoDrawing}
        onCancelRoofDrawing={model.onCancelDrawing}
        onCommitRoofDrawing={model.onCommitDrawing}
        onStartObstacleDrawing={model.onStartObstacleDrawing}
        onUndoObstacleDrawing={model.onUndoObstacleDrawing}
        onCancelObstacleDrawing={model.onCancelObstacleDrawing}
        onCommitObstacleDrawing={model.onCommitObstacleDrawing}
      />

      <section className="sun-cast-editor-tabs-shell">


        {activeEditorTab === 'roof' ? (
          <div role="tabpanel" id="editor-panel-roof" aria-labelledby="editor-tab-roof">
            <FootprintPanel
              footprints={model.footprints}
              activeFootprintId={model.activeFootprintId}
              selectedFootprintIds={model.selectedFootprintIds}
              activeFootprintKwp={model.activeFootprint?.kwp ?? null}
              onShareProject={model.onShareProject}
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
          </div>
        ) : (
          <div role="tabpanel" id="editor-panel-obstacles" aria-labelledby="editor-tab-obstacles">
            <ObstaclePanel
              obstacles={model.obstacles}
              activeObstacle={model.activeObstacle}
              selectedObstacleIds={model.selectedObstacleIds}
              onSelectObstacle={model.onSelectObstacle}
              onSetActiveObstacleKind={model.onSetActiveObstacleKind}
              onSetActiveObstacleHeight={model.onSetActiveObstacleHeight}
              onDeleteActiveObstacle={model.onDeleteActiveObstacle}
            />
          </div>
        )}
      </section>

      <StatusPanel
        footprintErrors={model.footprintErrors}
        interactionError={model.interactionError}
        solverError={model.solverError}
        warnings={model.warnings}
        basePitchDeg={model.basePitchDeg}
        pitchAdjustmentPercent={model.pitchAdjustmentPercent}
        adjustedPitchDeg={model.adjustedPitchDeg}
        onSetPitchAdjustmentPercent={model.onSetPitchAdjustmentPercent}
        azimuthDeg={model.azimuthDeg}
        roofAreaM2={model.roofAreaM2}
        minHeightM={model.minHeightM}
        maxHeightM={model.maxHeightM}
        fitRmsErrorM={model.fitRmsErrorM}
        activeFootprintLatDeg={model.activeFootprintLatDeg}
        activeFootprintLonDeg={model.activeFootprintLonDeg}
      />
    </aside>
  )
}
