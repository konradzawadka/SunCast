import { useEffect, useState } from 'react'
import { DrawTools } from '../features/map-editor/DrawTools/DrawTools'
import { FootprintPanel } from '../components/FootprintPanel'
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
      <p className="panel-hint">Shortcuts: Escape cancels drawing, Ctrl/Cmd+A selects all polygons.</p>
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
