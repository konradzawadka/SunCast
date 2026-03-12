import type maplibregl from 'maplibre-gl'
import type { RefObject } from 'react'
import type { FootprintPolygon, ObstacleStateEntry } from '../../../../types/geometry'

export interface DragState {
  type: 'vertex' | 'edge' | 'obstacle-vertex'
  obstacleId?: string
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

export interface MapInteractionRefs {
  drawingRef: RefObject<boolean>
  drawDraftRef: RefObject<Array<[number, number]>>
  editModeRef: RefObject<'roof' | 'obstacle'>
  orbitEnabledRef: RefObject<boolean>
  activeFootprintRef: RefObject<FootprintPolygon | null>
  activeObstacleRef: RefObject<ObstacleStateEntry | null>
  onMapClickRef: RefObject<(point: [number, number]) => void>
  onCloseDrawingRef: RefObject<() => void>
  onSelectVertexRef: RefObject<(vertexIndex: number) => void>
  onSelectEdgeRef: RefObject<(edgeIndex: number) => void>
  onSelectFootprintRef: RefObject<(footprintId: string, multiSelect: boolean) => void>
  onSelectObstacleRef: RefObject<(obstacleId: string, multiSelect: boolean) => void>
  onClearSelectionRef: RefObject<() => void>
  onMoveVertexRef: RefObject<(vertexIndex: number, point: [number, number]) => boolean>
  onMoveEdgeRef: RefObject<(edgeIndex: number, delta: [number, number]) => boolean>
  onMoveObstacleVertexRef: RefObject<(obstacleId: string, vertexIndex: number, point: [number, number]) => boolean>
  onMoveRejectedRef: RefObject<() => void>
  onBearingChangeRef: RefObject<(bearingDeg: number) => void>
  onPitchChangeRef: RefObject<(pitchDeg: number) => void>
  onGeometryDragStateChangeRef: RefObject<(dragging: boolean) => void>
}

export interface UseMapInteractionsArgs {
  mapRef: RefObject<maplibregl.Map | null>
  mapLoaded: boolean
  refs: MapInteractionRefs
  constrainedDrawLengthM: number | null
}

export interface UseMapInteractionsResult {
  hoveredEdgeLength: HoveredEdgeLength | null
  drawingAngleHint: DrawingAngleHint | null
  draftPreviewPoint: [number, number] | null
}

export interface OrbitSteerState {
  lastScreenPoint: [number, number]
}
