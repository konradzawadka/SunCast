import { useEffect, useRef, useState, type RefObject } from 'react'
import maplibregl from 'maplibre-gl'
import type { FootprintPolygon } from '../../../../types/geometry'
import {
  CLICK_HIT_TOLERANCE_PX,
  DRAG_HIT_TOLERANCE_PX,
  EDGE_HIT_LAYER_ID,
  FOOTPRINT_HIT_LAYER_ID,
  MAX_ORBIT_PITCH_DEG,
  ORBIT_STEER_BEARING_PER_PIXEL_DEG,
  ORBIT_STEER_PITCH_PER_PIXEL_DEG,
  VERTEX_HIT_LAYER_ID,
} from './mapViewConstants'
import { angleFromSouthDeg, pointAtDistanceMeters, segmentAzimuthDeg, segmentLengthMeters, snapDrawPointToRightAngle } from './drawingAssist'
import { edgeLengthMeters } from './mapViewGeoJson'
import { getEdgeHit, getFootprintHit, getHitFeatures, getVertexHit } from './mapViewHitTesting'

export interface DragState {
  type: 'vertex' | 'edge'
  index: number
  lastLngLat: [number, number]
  invalidAttempted: boolean
}

export interface HoveredEdgeLength {
  left: number
  top: number
  lengthM: number
}

export interface DrawingAngleHint {
  left: number
  top: number
  angleDeg: number | null
  azimuthDeg: number | null
  angleFromSouthDeg: number | null
  secondPointPreview: boolean
  lengthM: number
  snapped: boolean
}

interface MapInteractionRefs {
  drawingRef: RefObject<boolean>
  drawDraftRef: RefObject<Array<[number, number]>>
  orbitEnabledRef: RefObject<boolean>
  activeFootprintRef: RefObject<FootprintPolygon | null>
  onMapClickRef: RefObject<(point: [number, number]) => void>
  onSelectVertexRef: RefObject<(vertexIndex: number) => void>
  onSelectEdgeRef: RefObject<(edgeIndex: number) => void>
  onSelectFootprintRef: RefObject<(footprintId: string, multiSelect: boolean) => void>
  onClearSelectionRef: RefObject<() => void>
  onMoveVertexRef: RefObject<(vertexIndex: number, point: [number, number]) => boolean>
  onMoveEdgeRef: RefObject<(edgeIndex: number, delta: [number, number]) => boolean>
  onMoveRejectedRef: RefObject<() => void>
  onBearingChangeRef: RefObject<(bearingDeg: number) => void>
  onPitchChangeRef: RefObject<(pitchDeg: number) => void>
  onGeometryDragStateChangeRef: RefObject<(dragging: boolean) => void>
}

interface UseMapInteractionsArgs {
  mapRef: RefObject<maplibregl.Map | null>
  mapLoaded: boolean
  refs: MapInteractionRefs
  constrainedDrawLengthM: number | null
}

interface UseMapInteractionsResult {
  hoveredEdgeLength: HoveredEdgeLength | null
  drawingAngleHint: DrawingAngleHint | null
  draftPreviewPoint: [number, number] | null
}

interface OrbitSteerState {
  lastScreenPoint: [number, number]
}

export function useMapInteractions({
  mapRef,
  mapLoaded,
  refs,
  constrainedDrawLengthM,
}: UseMapInteractionsArgs): UseMapInteractionsResult {
  const [hoveredEdgeLength, setHoveredEdgeLength] = useState<HoveredEdgeLength | null>(null)
  const [drawingAngleHint, setDrawingAngleHint] = useState<DrawingAngleHint | null>(null)
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

    const getDrawPoint = (drawDraft: Array<[number, number]>, rawPoint: [number, number], disableSnap: boolean) => {
      const snapped = snapDrawPointToRightAngle(drawDraft, rawPoint, { snapEnabled: !disableSnap })
      if (drawDraft.length < 1 || constrainedDrawLengthM === null) {
        return snapped
      }
      return {
        ...snapped,
        point: pointAtDistanceMeters(drawDraft[drawDraft.length - 1], snapped.point, constrainedDrawLengthM),
      }
    }

    const handleHoverMove = (event: maplibregl.MapMouseEvent) => {
      if (refs.drawingRef.current && !refs.orbitEnabledRef.current) {
        const drawDraft = refs.drawDraftRef.current
        if (drawDraft.length >= 1) {
          const disableSnap = event.originalEvent instanceof MouseEvent && event.originalEvent.shiftKey
          const snapped = getDrawPoint(drawDraft, [event.lngLat.lng, event.lngLat.lat], disableSnap)
          const lengthM = segmentLengthMeters(drawDraft[drawDraft.length - 1], snapped.point)
          const secondPointPreview = drawDraft.length === 1
          const azimuthDeg = secondPointPreview ? segmentAzimuthDeg(drawDraft[0], snapped.point) : null
          setDraftPreviewPoint(snapped.point)
          setDrawingAngleHint({
            left: event.point.x,
            top: event.point.y,
            angleDeg: drawDraft.length >= 2 ? snapped.angleDeg : null,
            azimuthDeg,
            angleFromSouthDeg: azimuthDeg !== null ? angleFromSouthDeg(azimuthDeg) : null,
            secondPointPreview,
            lengthM,
            snapped: snapped.snapped,
          })
        } else {
          setDraftPreviewPoint(null)
          setDrawingAngleHint(null)
        }
      } else {
        setDraftPreviewPoint(null)
        setDrawingAngleHint(null)
      }

      if (refs.drawingRef.current || refs.orbitEnabledRef.current || dragStateRef.current) {
        if (hoveredEdgeLengthRef.current !== null) {
          setHoveredEdgeLength(null)
        }
        return
      }

      const active = refs.activeFootprintRef.current
      const hits = getHitFeatures(map, event.point, DRAG_HIT_TOLERANCE_PX, [VERTEX_HIT_LAYER_ID, EDGE_HIT_LAYER_ID])
      const vertexIndex = getVertexHit(hits, VERTEX_HIT_LAYER_ID)
      const edgeIndex = getEdgeHit(hits, EDGE_HIT_LAYER_ID)
      const canModifyEdge = edgeIndex !== null && !!active && active.vertices.length >= 3

      if (canModifyEdge) {
        map.getCanvas().style.cursor = 'ew-resize'
      } else if (vertexIndex !== null) {
        map.getCanvas().style.cursor = 'grab'
      } else {
        map.getCanvas().style.cursor = ''
      }

      if (edgeIndex === null || !active || active.vertices.length < 2) {
        setHoveredEdgeLength(null)
        return
      }

      const lengthM = edgeLengthMeters(active.vertices, edgeIndex)
      if (lengthM === null) {
        setHoveredEdgeLength(null)
        return
      }

      const start = active.vertices[edgeIndex]
      const end = active.vertices[(edgeIndex + 1) % active.vertices.length]
      const midLon = (start[0] + end[0]) / 2
      const midLat = (start[1] + end[1]) / 2
      const midScreen = map.project({ lng: midLon, lat: midLat })
      setHoveredEdgeLength({ left: midScreen.x, top: midScreen.y, lengthM })
    }

    const handleDragMove = (event: maplibregl.MapMouseEvent) => {
      const dragState = dragStateRef.current
      if (!dragState || refs.drawingRef.current || refs.orbitEnabledRef.current) {
        return
      }

      if (dragState.type === 'vertex') {
        const applied = refs.onMoveVertexRef.current(dragState.index, [event.lngLat.lng, event.lngLat.lat])
        if (!applied) {
          dragState.invalidAttempted = true
        } else {
          dragState.lastLngLat = [event.lngLat.lng, event.lngLat.lat]
        }
        return
      }

      const deltaLng = event.lngLat.lng - dragState.lastLngLat[0]
      const deltaLat = event.lngLat.lat - dragState.lastLngLat[1]
      if (deltaLng === 0 && deltaLat === 0) {
        return
      }

      const applied = refs.onMoveEdgeRef.current(dragState.index, [deltaLng, deltaLat])
      if (!applied) {
        dragState.invalidAttempted = true
        return
      }

      dragState.lastLngLat = [event.lngLat.lng, event.lngLat.lat]
    }

    const finishGeometryDrag = () => {
      const dragState = dragStateRef.current
      if (!dragState) {
        return
      }

      dragStateRef.current = null
      map.dragPan.enable()
      map.getCanvas().style.cursor = ''
      setHoveredEdgeLength(null)
      if (dragState.invalidAttempted) {
        refs.onMoveRejectedRef.current()
      }
      refs.onGeometryDragStateChangeRef.current(false)
    }

    const finishOrbitSteer = () => {
      if (!orbitSteerStateRef.current) {
        return
      }
      orbitSteerStateRef.current = null
      map.dragPan.enable()
      map.getCanvas().style.cursor = ''
    }

    const finishInteractions = () => {
      finishGeometryDrag()
      finishOrbitSteer()
    }

    const handleClick = (event: maplibregl.MapMouseEvent & { originalEvent: MouseEvent }) => {
      if (refs.drawingRef.current) {
        const drawDraft = refs.drawDraftRef.current
        const disableSnap = event.originalEvent instanceof MouseEvent && event.originalEvent.shiftKey
        const snapped = getDrawPoint(drawDraft, [event.lngLat.lng, event.lngLat.lat], disableSnap)
        refs.onMapClickRef.current(snapped.point)
        return
      }

      const hits = getHitFeatures(map, event.point, CLICK_HIT_TOLERANCE_PX, [
        VERTEX_HIT_LAYER_ID,
        EDGE_HIT_LAYER_ID,
        FOOTPRINT_HIT_LAYER_ID,
      ])

      const vertexIndex = getVertexHit(hits, VERTEX_HIT_LAYER_ID)
      if (vertexIndex !== null) {
        refs.onSelectVertexRef.current(vertexIndex)
        return
      }

      const edgeIndex = getEdgeHit(hits, EDGE_HIT_LAYER_ID)
      if (edgeIndex !== null) {
        refs.onSelectEdgeRef.current(edgeIndex)
        return
      }

      const footprintId = getFootprintHit(hits, FOOTPRINT_HIT_LAYER_ID)
      if (footprintId) {
        refs.onSelectFootprintRef.current(footprintId, event.originalEvent.ctrlKey || event.originalEvent.metaKey)
        return
      }

      refs.onClearSelectionRef.current()
    }

    const handleMouseDown = (event: maplibregl.MapMouseEvent) => {
      const isMiddleButton = event.originalEvent instanceof MouseEvent && event.originalEvent.button === 1
      if (refs.orbitEnabledRef.current && isMiddleButton) {
        orbitSteerStateRef.current = {
          lastScreenPoint: [event.point.x, event.point.y],
        }
        map.dragPan.disable()
        map.getCanvas().style.cursor = 'grabbing'
        event.originalEvent.preventDefault()
        return
      }

      if (refs.drawingRef.current || refs.orbitEnabledRef.current) {
        return
      }

      const hits = getHitFeatures(map, event.point, DRAG_HIT_TOLERANCE_PX, [VERTEX_HIT_LAYER_ID, EDGE_HIT_LAYER_ID])

      const vertexIndex = getVertexHit(hits, VERTEX_HIT_LAYER_ID)
      if (vertexIndex !== null) {
        dragStateRef.current = {
          type: 'vertex',
          index: vertexIndex,
          lastLngLat: [event.lngLat.lng, event.lngLat.lat],
          invalidAttempted: false,
        }
        refs.onGeometryDragStateChangeRef.current(true)
        map.dragPan.disable()
        map.getCanvas().style.cursor = 'grabbing'
        return
      }

      const edgeIndex = getEdgeHit(hits, EDGE_HIT_LAYER_ID)
      if (edgeIndex === null) {
        return
      }

      dragStateRef.current = {
        type: 'edge',
        index: edgeIndex,
        lastLngLat: [event.lngLat.lng, event.lngLat.lat],
        invalidAttempted: false,
      }
      refs.onGeometryDragStateChangeRef.current(true)
      map.dragPan.disable()
      map.getCanvas().style.cursor = 'grabbing'
    }

    const handleOrbitSteerMove = (event: maplibregl.MapMouseEvent) => {
      const orbitSteerState = orbitSteerStateRef.current
      if (!orbitSteerState || !refs.orbitEnabledRef.current) {
        return
      }

      const deltaX = event.point.x - orbitSteerState.lastScreenPoint[0]
      const deltaY = event.point.y - orbitSteerState.lastScreenPoint[1]
      if (deltaX === 0 && deltaY === 0) {
        return
      }

      map.jumpTo({
        bearing: map.getBearing() + deltaX * ORBIT_STEER_BEARING_PER_PIXEL_DEG,
        pitch: Math.max(0, Math.min(MAX_ORBIT_PITCH_DEG, map.getPitch() - deltaY * ORBIT_STEER_PITCH_PER_PIXEL_DEG)),
      })
      orbitSteerState.lastScreenPoint = [event.point.x, event.point.y]
    }

    const handleMouseMove = (event: maplibregl.MapMouseEvent) => {
      handleOrbitSteerMove(event)
      handleHoverMove(event)
      handleDragMove(event)
    }

    const emitBearing = () => {
      refs.onBearingChangeRef.current(map.getBearing())
    }

    const emitPitch = () => {
      refs.onPitchChangeRef.current(map.getPitch())
    }

    refs.onBearingChangeRef.current(map.getBearing())
    refs.onPitchChangeRef.current(map.getPitch())

    map.on('click', handleClick)
    map.on('mousedown', handleMouseDown)
    map.on('mousemove', handleMouseMove)
    map.on('mouseup', finishInteractions)
    map.on('mouseout', finishInteractions)
    map.on('rotate', emitBearing)
    map.on('pitch', emitPitch)

    return () => {
      map.off('click', handleClick)
      map.off('mousedown', handleMouseDown)
      map.off('mousemove', handleMouseMove)
      map.off('mouseup', finishInteractions)
      map.off('mouseout', finishInteractions)
      map.off('rotate', emitBearing)
      map.off('pitch', emitPitch)
      setHoveredEdgeLength(null)
      setDrawingAngleHint(null)
      setDraftPreviewPoint(null)
      refs.onGeometryDragStateChangeRef.current(false)
    }
  }, [constrainedDrawLengthM, mapLoaded, mapRef, refs])

  return {
    hoveredEdgeLength,
    drawingAngleHint,
    draftPreviewPoint,
  }
}
