import type maplibregl from 'maplibre-gl'
import {
  DRAW_CLOSE_SNAP_TOLERANCE_PX,
  MAX_ORBIT_PITCH_DEG,
  ORBIT_STEER_BEARING_PER_PIXEL_DEG,
  ORBIT_STEER_PITCH_PER_PIXEL_DEG,
} from './mapViewConstants'
import {
  angleFromSouthDeg,
  pointAtDistanceMeters,
  segmentAzimuthDeg,
  segmentLengthMeters,
  snapDrawPointToRightAngle,
  snapVertexPointToRightAngle,
} from './drawingAssist'
import { edgeLengthMeters } from './mapViewGeoJson'
import {
  applyVertexDragMove,
  handleModeSelectionClick,
  resolveHoverState,
  resolveMouseDownDragState,
  resolveVertexDragPolygon,
} from './mapInteractionEditMode'
import type { MutableRefObject } from 'react'
import type {
  DragState,
  DrawingAngleHint,
  HoveredEdgeLength,
  MapInteractionRefs,
  OrbitSteerState,
  VertexDragAngleHint,
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
  setVertexDragAngleHint: (value: VertexDragAngleHint | null) => void
  setDraftPreviewPoint: (value: [number, number] | null) => void
}

interface DrawingInteraction {
  snapped: ReturnType<typeof snapDrawPointToRightAngle>
  closePolygonPoint: [number, number] | null
  previewPoint: [number, number]
  lengthM: number
  secondPointPreview: boolean
  azimuthDeg: number | null
}

// Purpose: Returns event lng lat from available inputs.
// Why: Improves readability by isolating a single responsibility behind a named function.
function getEventLngLat(event: maplibregl.MapMouseEvent): [number, number] {
  return [event.lngLat.lng, event.lngLat.lat]
}

// Purpose: Checks whether snap disabled and returns a boolean result.
// Why: Improves readability by isolating a single responsibility behind a named function.
function isSnapDisabled(event: maplibregl.MapMouseEvent): boolean {
  return event.originalEvent instanceof MouseEvent && event.originalEvent.shiftKey
}

// Purpose: Checks whether multi select and returns a boolean result.
// Why: Improves readability by isolating a single responsibility behind a named function.
function isMultiSelect(event: maplibregl.MapMouseEvent & { originalEvent: MouseEvent }): boolean {
  return event.originalEvent.ctrlKey || event.originalEvent.metaKey
}

// Purpose: Returns close polygon snap point from available inputs.
// Why: Improves readability by isolating a single responsibility behind a named function.
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

// Purpose: Returns vertex drag point from available inputs.
// Why: Improves readability by isolating a single responsibility behind a named function.
function getVertexDragPoint(
  polygon: Array<[number, number]> | null,
  vertexIndex: number,
  rawPoint: [number, number],
  disableSnap: boolean,
) {
  if (!polygon) {
    return { point: rawPoint, angleDeg: null }
  }
  return snapVertexPointToRightAngle(polygon, vertexIndex, rawPoint, { snapEnabled: !disableSnap })
}

// Purpose: Computes compute drawing interaction deterministically from the provided input values.
// Why: Keeps domain rules explicit, testable, and deterministic.
function computeDrawingInteraction(
  map: maplibregl.Map,
  drawDraft: Array<[number, number]>,
  rawPoint: [number, number],
  disableSnap: boolean,
  constrainedDrawLengthM: number | null,
): DrawingInteraction | null {
  if (drawDraft.length < 1) {
    return null
  }

  const snapped = getDrawPoint(drawDraft, rawPoint, disableSnap, constrainedDrawLengthM)
  const closePolygonPoint = disableSnap ? null : getClosePolygonSnapPoint(map, drawDraft, snapped.point)
  const previewPoint = closePolygonPoint ?? snapped.point

  return {
    snapped,
    closePolygonPoint,
    previewPoint,
    lengthM: segmentLengthMeters(drawDraft[drawDraft.length - 1], previewPoint),
    secondPointPreview: drawDraft.length === 1,
    azimuthDeg: drawDraft.length === 1 ? segmentAzimuthDeg(drawDraft[0], previewPoint) : null,
  }
}

// Purpose: Updates vertex angle hint in a controlled way.
// Why: Makes state transitions explicit and easier to reason about during edits.
function setVertexAngleHint(
  setVertexDragAngleHint: (value: VertexDragAngleHint | null) => void,
  event: maplibregl.MapMouseEvent,
  angleDeg: number | null,
): void {
  if (angleDeg === null) {
    setVertexDragAngleHint(null)
    return
  }

  setVertexDragAngleHint({
    left: event.point.x,
    top: event.point.y,
    angleDeg,
  })
}

// Purpose: Encapsulates start drag behavior in one reusable function.
// Why: Improves readability by isolating a single responsibility behind a named function.
function startDrag(
  map: maplibregl.Map,
  refs: MapInteractionRefs,
  dragStateRef: MutableRefObject<DragState | null>,
  dragState: DragState,
  setVertexDragAngleHint: (value: VertexDragAngleHint | null) => void,
): void {
  dragStateRef.current = dragState
  refs.onGeometryDragStateChangeRef.current(true)
  map.dragPan.disable()
  map.getCanvas().style.cursor = 'grabbing'
  setVertexDragAngleHint(null)
}

// Purpose: Updates hover cursor in a controlled way.
// Why: Makes state transitions explicit and easier to reason about during edits.
function setHoverCursor(map: maplibregl.Map, hasVertexHit: boolean, hasEdgeHit: boolean): void {
  if (hasVertexHit) {
    map.getCanvas().style.cursor = 'grab'
  } else if (hasEdgeHit) {
    map.getCanvas().style.cursor = 'move'
  } else {
    map.getCanvas().style.cursor = ''
  }
}

// Purpose: Updates hovered edge length for polygon in a controlled way.
// Why: Makes state transitions explicit and easier to reason about during edits.
function setHoveredEdgeLengthForPolygon(
  map: maplibregl.Map,
  polygon: Array<[number, number]> | null,
  edgeIndex: number | null,
  setHoveredEdgeLength: (value: HoveredEdgeLength | null) => void,
): void {
  if (edgeIndex === null || !polygon || polygon.length < 2) {
    setHoveredEdgeLength(null)
    return
  }

  const lengthM = edgeLengthMeters(polygon, edgeIndex)
  if (lengthM === null) {
    setHoveredEdgeLength(null)
    return
  }

  const start = polygon[edgeIndex]
  const end = polygon[(edgeIndex + 1) % polygon.length]
  const midLon = (start[0] + end[0]) / 2
  const midLat = (start[1] + end[1]) / 2
  const midScreen = map.project({ lng: midLon, lat: midLat })
  setHoveredEdgeLength({ left: midScreen.x, top: midScreen.y, lengthM })
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
  setVertexDragAngleHint,
  setDraftPreviewPoint,
}: CreateMapInteractionHandlersArgs) {
  const handleHoverMove = (event: maplibregl.MapMouseEvent) => {
    if (refs.drawingRef.current && !refs.orbitEnabledRef.current) {
      const drawDraft = refs.drawDraftRef.current
      const drawInteraction = computeDrawingInteraction(
        map,
        drawDraft,
        getEventLngLat(event),
        isSnapDisabled(event),
        constrainedDrawLengthM,
      )
      if (drawInteraction) {
        setDraftPreviewPoint(drawInteraction.previewPoint)
        setDrawingAngleHint({
          left: event.point.x,
          top: event.point.y,
          angleDeg: drawDraft.length >= 2 ? drawInteraction.snapped.angleDeg : null,
          azimuthDeg: drawInteraction.azimuthDeg,
          angleFromSouthDeg:
            drawInteraction.azimuthDeg !== null ? angleFromSouthDeg(drawInteraction.azimuthDeg) : null,
          secondPointPreview: drawInteraction.secondPointPreview,
          lengthM: drawInteraction.lengthM,
          snapped: drawInteraction.snapped.snapped || drawInteraction.closePolygonPoint !== null,
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

    const hoverState = resolveHoverState(map, refs, event.point)
    setHoverCursor(map, hoverState.cursor === 'grab', hoverState.cursor === 'move')
    setHoveredEdgeLengthForPolygon(map, hoverState.polygon, hoverState.edgeIndex, setHoveredEdgeLength)
  }

  const handleDragMove = (event: maplibregl.MapMouseEvent) => {
    const dragState = dragStateRef.current
    if (!dragState || refs.drawingRef.current || refs.orbitEnabledRef.current) {
      return
    }

    if (dragState.type === 'vertex') {
      const rawPoint = getEventLngLat(event)
      const disableSnap = isSnapDisabled(event)
      const moved = getVertexDragPoint(resolveVertexDragPolygon(refs, dragState), dragState.index, rawPoint, disableSnap)
      const movedPoint = moved.point
      const applied = applyVertexDragMove(refs, dragState, movedPoint)
      if (!applied) {
        dragState.invalidAttempted = true
      } else {
        setVertexAngleHint(setVertexDragAngleHint, event, moved.angleDeg)
        dragState.lastLngLat = movedPoint
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
    setVertexDragAngleHint(null)
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
      const drawInteraction = computeDrawingInteraction(
        map,
        drawDraft,
        getEventLngLat(event),
        isSnapDisabled(event),
        constrainedDrawLengthM,
      )
      if (drawInteraction && drawInteraction.closePolygonPoint !== null) {
        refs.onCloseDrawingRef.current()
        return
      }
      refs.onMapClickRef.current(drawInteraction?.snapped.point ?? getEventLngLat(event))
      return
    }

    handleModeSelectionClick(map, refs, event.point, isMultiSelect(event))
  }

  const handleMouseDown = (event: maplibregl.MapMouseEvent) => {
    const isMiddleButton = event.originalEvent instanceof MouseEvent && event.originalEvent.button === 1
    if (refs.orbitEnabledRef.current && isMiddleButton) {
      orbitSteerStateRef.current = {
        lastScreenPoint: [event.point.x, event.point.y],
      }
      map.dragPan.disable()
      map.getCanvas().style.cursor = 'grabbing'
      setVertexDragAngleHint(null)
      event.originalEvent.preventDefault()
      return
    }

    if (refs.drawingRef.current || refs.orbitEnabledRef.current) {
      return
    }

    const dragState = resolveMouseDownDragState(map, refs, event.point, getEventLngLat(event))
    if (!dragState) {
      return
    }
    startDrag(
      map,
      refs,
      dragStateRef,
      dragState,
      setVertexDragAngleHint,
    )
    if (dragState.type === 'edge') {
      return
    }
    const movedPoint = getEventLngLat(event)
    const angleDeg = getVertexDragPoint(resolveVertexDragPolygon(refs, dragState), dragState.index, movedPoint, false).angleDeg
    setVertexAngleHint(setVertexDragAngleHint, event, angleDeg)
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
