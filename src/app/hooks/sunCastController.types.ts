import type { SunProjectionResult } from '../../geometry/sun/sunProjection'
import type { FaceConstraints, FootprintPolygon, RoofMeshData, SolverWarning } from '../../types/geometry'
import type { ImportedFootprintConfigEntry } from '../features/debug/DevTools'
import type { PlaceSearchResult } from '../features/place-search/placeSearch.types'
import type { SelectedRoofSunInput } from '../features/sun-tools/SunOverlayColumn'

export const MIN_PITCH_ADJUSTMENT_PERCENT = -90
export const MAX_PITCH_ADJUSTMENT_PERCENT = 200

export function clampPitchAdjustmentPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }
  return Math.min(MAX_PITCH_ADJUSTMENT_PERCENT, Math.max(MIN_PITCH_ADJUSTMENT_PERCENT, value))
}

export function computeFootprintCentroid(vertices: Array<[number, number]>): [number, number] | null {
  if (vertices.length === 0) {
    return null
  }
  let lonSum = 0
  let latSum = 0
  for (const [lon, lat] of vertices) {
    lonSum += lon
    latSum += lat
  }
  return [lonSum / vertices.length, latSum / vertices.length]
}

export interface SunCastSidebarModel {
  isDrawing: boolean
  drawDraftCount: number
  footprints: FootprintPolygon[]
  activeFootprintId: string | null
  selectedFootprintIds: string[]
  activeFootprint: FootprintPolygon | null
  activeConstraints: FaceConstraints
  selectedVertexIndex: number | null
  selectedEdgeIndex: number | null
  footprintEntries: Array<{
    footprint: FootprintPolygon
    constraints: FaceConstraints
  }>
  interactionError: string | null
  solverError: string | null
  footprintErrors: string[]
  warnings: SolverWarning[]
  basePitchDeg: number | null
  pitchAdjustmentPercent: number
  adjustedPitchDeg: number | null
  azimuthDeg: number | null
  roofAreaM2: number | null
  minHeightM: number | null
  maxHeightM: number | null
  fitRmsErrorM: number | null
  activeFootprintLatDeg: number | null
  activeFootprintLonDeg: number | null
  shareError: string | null
  shareSuccess: string | null
  onStartDrawing: () => void
  onUndoDrawing: () => void
  onCancelDrawing: () => void
  onCommitDrawing: () => void
  onSelectFootprint: (footprintId: string, multiSelect: boolean) => void
  onSetActiveFootprintKwp: (kwp: number) => void
  onSetPitchAdjustmentPercent: (pitchAdjustmentPercent: number) => void
  onDeleteActiveFootprint: () => void
  onSetVertex: (vertexIndex: number, heightM: number) => boolean
  onSetEdge: (edgeIndex: number, heightM: number) => boolean
  onClearVertex: (vertexIndex: number) => void
  onClearEdge: (edgeIndex: number) => void
  onConstraintLimitExceeded: () => void
  onStartTutorial: () => void
  onShareProject: () => Promise<void>
  onDevSelectVertex: (vertexIndex: number) => void
  onDevSelectEdge: (edgeIndex: number) => void
  onDevClearSelection: () => void
  onDevImportEntries: (entries: ImportedFootprintConfigEntry[]) => void
}

export interface SunCastCanvasModel {
  footprints: FootprintPolygon[]
  activeFootprint: FootprintPolygon | null
  selectedFootprintIds: string[]
  drawDraft: Array<[number, number]>
  isDrawing: boolean
  orbitEnabled: boolean
  roofMeshes: RoofMeshData[]
  vertexConstraints: FaceConstraints['vertexHeights']
  selectedVertexIndex: number | null
  selectedEdgeIndex: number | null
  showSolveHint: boolean
  sunProjectionEnabled: boolean
  hasValidSunDatetime: boolean
  sunDatetimeError: string | null
  sunProjectionResult: SunProjectionResult | null
  sunDatetimeRaw: string
  sunDailyDateRaw: string
  sunDailyTimeZone: string
  selectedRoofInputs: SelectedRoofSunInput[]
  hasSolvedActiveRoof: boolean
  mapNavigationTarget: {
    id: number
    lon: number
    lat: number
  } | null
  onPlaceSearchSelect: (result: PlaceSearchResult) => void
  onToggleOrbit: () => void
  onSelectVertex: (vertexIndex: number) => void
  onSelectEdge: (edgeIndex: number) => void
  onSelectFootprint: (footprintId: string, multiSelect: boolean) => void
  onClearSelection: () => void
  onMoveVertex: (vertexIndex: number, point: [number, number]) => boolean
  onMoveEdge: (edgeIndex: number, delta: [number, number]) => boolean
  onMoveRejected: () => void
  onAdjustHeight: (stepM: number) => void
  onMapClick: (point: [number, number]) => void
  onCloseDrawing: () => void
  onBearingChange: (bearingDeg: number) => void
  onPitchChange: (pitchDeg: number) => void
  onGeometryDragStateChange: (dragging: boolean) => void
  productionComputationEnabled: boolean
  onInitialized: () => void
  onToggleSunProjectionEnabled: (enabled: boolean) => void
  onSunDatetimeInputChange: (datetimeIsoRaw: string) => void
}

export interface SunCastTutorialModel {
  mapInitialized: boolean
  draftVertexCount: number
  hasFinishedPolygon: boolean
  kwp: number | null
  hasEditedKwp: boolean
  constrainedVertexCount: number
  orbitEnabled: boolean
  hasEditedDatetime: boolean
  onReady: (controls: { startTutorial: () => void }) => void
}
