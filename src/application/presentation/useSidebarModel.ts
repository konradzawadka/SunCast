import { useMemo } from 'react'
import type { ImportedFootprintConfigEntry } from '../../app/features/debug/DevTools'
import { clampPitchAdjustmentPercent, type SunCastSidebarModel } from './presentationModel.types'
import type { SunCastPresentationState } from './useSunCastPresentationState'

export function useSidebarModel(state: SunCastPresentationState): SunCastSidebarModel {
  const { projectDocument, editorSession, analysis } = state
  const { store } = projectDocument

  return useMemo(
    () => ({
      editMode: editorSession.editMode,
      isDrawingRoof: store.state.isDrawing,
      isDrawingObstacle: store.state.isDrawingObstacle,
      drawDraftCountRoof: store.state.drawDraft.length,
      drawDraftCountObstacle: store.state.obstacleDrawDraft.length,
      footprints: projectDocument.footprints,
      activeFootprintId: store.state.activeFootprintId,
      selectedFootprintIds: projectDocument.selectedFootprintIds,
      activeFootprint: projectDocument.activeFootprint,
      obstacles: projectDocument.obstacles,
      activeObstacle: projectDocument.activeObstacle,
      selectedObstacleIds: state.selectedObstacleIds,
      activeConstraints: projectDocument.activeConstraints,
      selectedVertexIndex: editorSession.safeSelectedVertexIndex,
      selectedEdgeIndex: editorSession.safeSelectedEdgeIndex,
      footprintEntries: projectDocument.footprintEntries,
      interactionError: editorSession.interactionError,
      solverError: analysis.diagnostics.solverError,
      footprintErrors: state.activeFootprintErrors,
      warnings: analysis.solvedRoofs.activeSolved?.solution.warnings ?? [],
      basePitchDeg: analysis.solvedMetrics.basePitchDeg,
      pitchAdjustmentPercent: state.activePitchAdjustmentPercent,
      adjustedPitchDeg: state.adjustedPitchDeg,
      azimuthDeg: analysis.solvedMetrics.azimuthDeg,
      roofAreaM2: analysis.solvedMetrics.roofAreaM2,
      minHeightM: analysis.solvedMetrics.minHeightM,
      maxHeightM: analysis.solvedMetrics.maxHeightM,
      fitRmsErrorM: analysis.solvedMetrics.fitRmsErrorM,
      activeFootprintLatDeg: state.activeFootprintCentroid?.[1] ?? null,
      activeFootprintLonDeg: state.activeFootprintCentroid?.[0] ?? null,
      onSetEditMode: (mode) => {
        editorSession.setEditMode(mode)
        if (mode === 'roof' && store.state.isDrawingObstacle) {
          store.cancelObstacleDrawing()
        }
        if (mode === 'obstacle' && store.state.isDrawing) {
          store.cancelDrawing()
        }
      },
      onStartDrawing: () => {
        editorSession.setOrbitEnabled(false)
        store.cancelObstacleDrawing()
        editorSession.clearSelectionState()
        store.startDrawing()
      },
      onUndoDrawing: store.undoDraftPoint,
      onCancelDrawing: () => {
        store.cancelDrawing()
        editorSession.clearSelectionState()
      },
      onCommitDrawing: () => {
        store.commitFootprint()
        editorSession.clearSelectionState()
      },
      onStartObstacleDrawing: () => {
        editorSession.setOrbitEnabled(false)
        store.cancelDrawing()
        editorSession.clearSelectionState()
        store.startObstacleDrawing()
      },
      onUndoObstacleDrawing: store.undoObstacleDraftPoint,
      onCancelObstacleDrawing: () => {
        store.cancelObstacleDrawing()
        editorSession.clearSelectionState()
      },
      onCommitObstacleDrawing: () => {
        store.commitObstacle()
        editorSession.clearSelectionState()
      },
      onSelectFootprint: (footprintId, multiSelect) => {
        if (multiSelect) {
          store.toggleFootprintSelection(footprintId)
        } else {
          store.selectOnlyFootprint(footprintId)
        }
        editorSession.clearSelectionState()
      },
      onSelectObstacle: (obstacleId, multiSelect) => {
        if (multiSelect) {
          store.toggleObstacleSelection(obstacleId)
        } else {
          store.selectOnlyObstacle(obstacleId)
        }
        editorSession.clearSelectionState()
      },
      onSetActiveFootprintKwp: (kwp) => {
        store.setActiveFootprintKwp(kwp)
        const footprintId = store.state.activeFootprintId
        if (footprintId) {
          editorSession.setTutorialEditedKwpByFootprint((current) => ({ ...current, [footprintId]: true }))
        }
      },
      onSetActiveObstacleHeight: (heightM) => {
        if (!store.state.activeObstacleId) {
          return
        }
        store.setObstacleHeight(store.state.activeObstacleId, heightM)
      },
      onSetActiveObstacleKind: (kind) => {
        if (!store.state.activeObstacleId) {
          return
        }
        store.setObstacleKind(store.state.activeObstacleId, kind)
      },
      onSetPitchAdjustmentPercent: (pitchAdjustmentPercent) => {
        store.setActivePitchAdjustmentPercent(clampPitchAdjustmentPercent(pitchAdjustmentPercent))
      },
      onDeleteActiveFootprint: () => {
        if (!store.state.activeFootprintId) {
          return
        }
        store.deleteFootprint(store.state.activeFootprintId)
        editorSession.clearSelectionState()
      },
      onDeleteActiveObstacle: () => {
        if (!store.state.activeObstacleId) {
          return
        }
        store.deleteObstacle(store.state.activeObstacleId)
        editorSession.clearSelectionState()
      },
      onSetVertex: editorSession.applyVertexHeight,
      onSetEdge: editorSession.applyEdgeHeight,
      onClearVertex: store.clearVertexHeight,
      onClearEdge: store.clearEdgeHeight,
      onConstraintLimitExceeded: editorSession.setConstraintLimitError,
      onStartTutorial: () => editorSession.tutorialStartRef.current(),
      onShareProject: state.onShareProject,
      onDevSelectVertex: (vertexIndex) => {
        editorSession.selectVertex(vertexIndex)
      },
      onDevSelectEdge: (edgeIndex) => {
        editorSession.selectEdge(edgeIndex)
      },
      onDevClearSelection: () => {
        editorSession.clearSelectionState()
      },
      onDevImportEntries: (entries: ImportedFootprintConfigEntry[]) => {
        state.onImportDevEntries(entries)
      },
    }),
    [analysis, editorSession, projectDocument, state, store],
  )
}
