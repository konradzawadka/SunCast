import { useCallback, useRef, useState } from 'react'
import { useConstraintEditor } from '../hooks/useConstraintEditor'
import { useSelectionState } from '../hooks/useSelectionState'
import type { FootprintPolygon, FaceConstraints } from '../../types/geometry'

interface UseEditorSessionArgs {
  activeFootprint: FootprintPolygon | null
  activeConstraints: FaceConstraints
  isDrawing: boolean
  isDrawingObstacle: boolean
  moveVertex: (vertexIndex: number, point: [number, number]) => void
  moveEdge: (edgeIndex: number, delta: [number, number]) => void
  setVertexHeight: (vertexIndex: number, heightM: number) => boolean
  setVertexHeights: (constraints: Array<{ vertexIndex: number; heightM: number }>) => boolean
  setEdgeHeight: (edgeIndex: number, heightM: number) => boolean
}

export function useEditorSession(args: UseEditorSessionArgs) {
  const [orbitEnabled, setOrbitEnabled] = useState(false)
  const [editMode, setEditMode] = useState<'roof' | 'obstacle'>('roof')
  const [mapInitialized, setMapInitialized] = useState(false)
  const [mapBearingDeg, setMapBearingDeg] = useState(0)
  const [mapPitchDeg, setMapPitchDeg] = useState(0)
  const [tutorialEditedKwpByFootprint, setTutorialEditedKwpByFootprint] = useState<Record<string, true>>({})
  const [tutorialDatetimeEdited, setTutorialDatetimeEdited] = useState(false)
  const [isGeometryDragActive, setIsGeometryDragActive] = useState(false)
  const tutorialStartRef = useRef<() => void>(() => {})

  const {
    selectedVertexIndex,
    selectedEdgeIndex,
    clearSelectionState: clearSelectionIndices,
    selectVertex: selectVertexIndex,
    selectEdge: selectEdgeIndex,
  } = useSelectionState()

  const {
    interactionError,
    safeSelectedVertexIndex,
    safeSelectedEdgeIndex,
    applyVertexHeight,
    applyEdgeHeight,
    moveVertexIfValid,
    moveEdgeIfValid,
    applyHeightStep,
    clearInteractionError,
    setConstraintLimitError,
    setMoveRejectedError,
  } = useConstraintEditor({
    activeFootprint: args.activeFootprint,
    activeConstraints: args.activeConstraints,
    isDrawing: args.isDrawing || args.isDrawingObstacle,
    selectedVertexIndex,
    selectedEdgeIndex,
    setVertexHeight: args.setVertexHeight,
    setVertexHeights: args.setVertexHeights,
    setEdgeHeight: args.setEdgeHeight,
    moveVertex: args.moveVertex,
    moveEdge: args.moveEdge,
  })

  const clearSelectionState = useCallback(() => {
    clearSelectionIndices()
    clearInteractionError()
  }, [clearInteractionError, clearSelectionIndices])

  const selectVertex = useCallback(
    (vertexIndex: number) => {
      selectVertexIndex(vertexIndex)
      clearInteractionError()
    },
    [clearInteractionError, selectVertexIndex],
  )

  const selectEdge = useCallback(
    (edgeIndex: number) => {
      selectEdgeIndex(edgeIndex)
      clearInteractionError()
    },
    [clearInteractionError, selectEdgeIndex],
  )

  const setTutorialStart = useCallback((startTutorial: () => void) => {
    tutorialStartRef.current = startTutorial
  }, [])

  return {
    orbitEnabled,
    setOrbitEnabled,
    editMode,
    setEditMode,
    mapInitialized,
    setMapInitialized,
    mapBearingDeg,
    setMapBearingDeg,
    mapPitchDeg,
    setMapPitchDeg,
    tutorialEditedKwpByFootprint,
    setTutorialEditedKwpByFootprint,
    tutorialDatetimeEdited,
    setTutorialDatetimeEdited,
    isGeometryDragActive,
    setIsGeometryDragActive,
    tutorialStartRef,
    setTutorialStart,
    interactionError,
    safeSelectedVertexIndex,
    safeSelectedEdgeIndex,
    applyVertexHeight,
    applyEdgeHeight,
    moveVertexIfValid,
    moveEdgeIfValid,
    applyHeightStep,
    setConstraintLimitError,
    setMoveRejectedError,
    clearSelectionState,
    selectVertex,
    selectEdge,
  }
}
