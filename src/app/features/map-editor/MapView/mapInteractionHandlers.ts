import type maplibregl from 'maplibre-gl'
import {
  CLICK_HIT_TOLERANCE_PX,
  DRAG_HIT_TOLERANCE_PX,
  DRAW_CLOSE_SNAP_TOLERANCE_PX,
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
import type { MutableRefObject } from 'react'
import type {
  DragState,
  DrawingAngleHint,
  HoveredEdgeLength,
  MapInteractionRefs,
  OrbitSteerState,
} from './mapInteractionTypes'

interface CreateMapInteractionHandlersArgs {
  map: maplibregl.Map
  refs: MapInteractionRefs
  constrainedDrawLengthM: number | null
  hoveredEdgeLengthRef: MutableRefObject<HoveredEdgeLength | null>
  dragStateRef: MutableRefObject<DragState | null>
  orbitSteerStateRef: MutableRefObject<OrbitSteerState | null>
  setHoveredEdgeLength: (value: HoveredEdgeLength | null) => void
  setDrawingAngleHint: (value: DrawingAngleHint | null) => void
  setDraftPreviewPoint: (value: [number, number] | null) => void
}

function getClosePolygonSnapPoint(
  map: maplibregl.Map,
  drawDraft: Array<[number, number]>,
  point: [number, number],
): [number, number] | null {
  if (drawDraft.length < 3) {
    return null
  }

  const firstPoint = drawDraft[0]
  const firstPointScreen = map.project({ lng: firstPoint[0], lat: firstPoint[1] })
  const cursorScreen = map.project({ lng: point[0], lat: point[1] })
  const dx = cursorScreen.x - firstPointScreen.x
  const dy = cursorScreen.y - firstPointScreen.y
  const distancePx = Math.sqrt(dx * dx + dy * dy)

  return distancePx <= DRAW_CLOSE_SNAP_TOLERANCE_PX ? firstPoint : null
}

function getDrawPoint(
  drawDraft: Array<[number, number]>,
  rawPoint: [number, number],
  disableSnap: boolean,
  constrainedDrawLengthM: number | null,
) {
  const snapped = snapDrawPointToRightAngle(drawDraft, rawPoint, { snapEnabled: !disableSnap })
  if (drawDraft.length < 1 || constrainedDrawLengthM === null) {
    return snapped
  }
  return {
    ...snapped,
    point: pointAtDistanceMeters(drawDraft[drawDraft.length - 1], snapped.point, constrainedDrawLengthM),
  }
}

export function createMapInteractionHandlers({
  map,
  refs,
  constrainedDrawLengthM,
  hoveredEdgeLengthRef,
  dragStateRef,
  orbitSteerStateRef,
  setHoveredEdgeLength,
  setDrawingAngleHint,
  setDraftPreviewPoint,
}: CreateMapInteractionHandlersArgs) {
  const handleHoverMove = (event: maplibregl.MapMouseEvent) => {
    if (refs.drawingRef.current && !refs.orbitEnabledRef.current) {
      const drawDraft = refs.drawDraftRef.current
      if (drawDraft.length >= 1) {
        const disableSnap = event.originalEvent instanceof MouseEvent && event.originalEvent.shiftKey
        const snapped = getDrawPoint(drawDraft, [event.lngLat.lng, event.lngLat.lat], disableSnap, constrainedDrawLengthM)
        const closePolygonPoint = disableSnap ? null : getClosePolygonSnapPoint(map, drawDraft, snapped.point)
        const previewPoint = closePolygonPoint ?? snapped.point
        const lengthM = segmentLengthMeters(drawDraft[drawDraft.length - 1], previewPoint)
        const secondPointPreview = drawDraft.length === 1
        const azimuthDeg = secondPointPreview ? segmentAzimuthDeg(drawDraft[0], previewPoint) : null
        setDraftPreviewPoint(previewPoint)
        setDrawingAngleHint({
          left: event.point.x,
          top: event.point.y,
          angleDeg: drawDraft.length >= 2 ? snapped.angleDeg : null,
          azimuthDeg,
          angleFromSouthDeg: azimuthDeg !== null ? angleFromSouthDeg(azimuthDeg) : null,
          secondPointPreview,
          lengthM,
          snapped: snapped.snapped || closePolygonPoint !== null,
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
      const snapped = getDrawPoint(drawDraft, [event.lngLat.lng, event.lngLat.lat], disableSnap, constrainedDrawLengthM)
      const closePolygonPoint = disableSnap ? null : getClosePolygonSnapPoint(map, drawDraft, snapped.point)
      if (closePolygonPoint !== null) {
        refs.onCloseDrawingRef.current()
      } else {
        refs.onMapClickRef.current(snapped.point)
      }
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

  return {
    finishInteractions,
    handleClick,
    handleMouseDown,
    handleMouseMove,
    emitBearing,
    emitPitch,
  }
}
