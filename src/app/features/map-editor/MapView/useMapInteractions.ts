import { useEffect, useRef, useState } from 'react'
import { createMapInteractionHandlers } from './mapInteractionHandlers'
import type {
  DragState,
  DrawingAngleHint,
  HoveredEdgeLength,
  OrbitSteerState,
  VertexDragAngleHint,
  UseMapInteractionsArgs,
  UseMapInteractionsResult,
} from './mapInteractionTypes'

export type {
  DrawingAngleHint,
  HoveredEdgeLength,
  MapInteractionRefs,
  VertexDragAngleHint,
  UseMapInteractionsArgs,
  UseMapInteractionsResult,
} from './mapInteractionTypes'

export function useMapInteractions({
  mapRef,
  mapLoaded,
  refs,
  constrainedDrawLengthM,
}: UseMapInteractionsArgs): UseMapInteractionsResult {
  const [hoveredEdgeLength, setHoveredEdgeLength] = useState<HoveredEdgeLength | null>(null)
  const [drawingAngleHint, setDrawingAngleHint] = useState<DrawingAngleHint | null>(null)
  const [vertexDragAngleHint, setVertexDragAngleHint] = useState<VertexDragAngleHint | null>(null)
  const [draftPreviewPoint, setDraftPreviewPoint] = useState<[number, number] | null>(null)
  const hoveredEdgeLengthRef = useRef<HoveredEdgeLength | null>(null)
  const dragStateRef = useRef<DragState | null>(null)
  const orbitSteerStateRef = useRef<OrbitSteerState | null>(null)

  useEffect(() => {
    hoveredEdgeLengthRef.current = hoveredEdgeLength
  }, [hoveredEdgeLength])

  useEffect(() => {
    if (!mapLoaded) {
      return
    }

    const map = mapRef.current
    if (!map) {
      return
    }

    const handlers = createMapInteractionHandlers({
      map,
      refs,
      constrainedDrawLengthM,
      hoveredEdgeLengthRef,
      dragStateRef,
      orbitSteerStateRef,
      setHoveredEdgeLength,
      setDrawingAngleHint,
      setVertexDragAngleHint,
      setDraftPreviewPoint,
    })

    refs.onBearingChangeRef.current(map.getBearing())
    refs.onPitchChangeRef.current(map.getPitch())

    map.on('click', handlers.handleClick)
    map.on('mousedown', handlers.handleMouseDown)
    map.on('mousemove', handlers.handleMouseMove)
    map.on('mouseup', handlers.finishInteractions)
    map.on('mouseout', handlers.finishInteractions)
    map.on('rotate', handlers.emitBearing)
    map.on('pitch', handlers.emitPitch)

    return () => {
      map.off('click', handlers.handleClick)
      map.off('mousedown', handlers.handleMouseDown)
      map.off('mousemove', handlers.handleMouseMove)
      map.off('mouseup', handlers.finishInteractions)
      map.off('mouseout', handlers.finishInteractions)
      map.off('rotate', handlers.emitBearing)
      map.off('pitch', handlers.emitPitch)
      setHoveredEdgeLength(null)
      setDrawingAngleHint(null)
      setVertexDragAngleHint(null)
      setDraftPreviewPoint(null)
      refs.onGeometryDragStateChangeRef.current(false)
    }
  }, [constrainedDrawLengthM, mapLoaded, mapRef, refs])

  return {
    hoveredEdgeLength,
    drawingAngleHint,
    vertexDragAngleHint,
    draftPreviewPoint,
  }
}
