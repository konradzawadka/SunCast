import type { SunProjectionResult } from '../../geometry/sun/sunProjection'
import type {
  FaceConstraints,
  FootprintPolygon,
  ObstacleKind,
  ObstacleStateEntry,
  RoofMeshData,
  SolverWarning,
} from '../../types/geometry'
import type { ImportedFootprintConfigEntry } from '../features/debug/DevTools'
import type { PlaceSearchResult } from '../features/place-search/placeSearch.types'
import type { SelectedRoofSunInput } from '../features/sun-tools/SunOverlayColumn'
import type { RoofShadingComputeState, ShadeHeatmapFeature } from './useRoofShading'
import type { ComputeRoofShadeGridResult, RoofShadeDiagnostics } from '../../geometry/shading'
import type { AnnualSunAccessResult } from '../../geometry/shading'
import type { AnnualSimulationOptions, AnnualSimulationState } from './useAnnualRoofSimulation'

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
  editMode: 'roof' | 'obstacle'
  isDrawingRoof: boolean
  isDrawingObstacle: boolean
  drawDraftCountRoof: number
  drawDraftCountObstacle: number
  footprints: FootprintPolygon[]
  activeFootprintId: string | null
  selectedFootprintIds: string[]
  activeFootprint: FootprintPolygon | null
  obstacles: ObstacleStateEntry[]
  activeObstacle: ObstacleStateEntry | null
  selectedObstacleIds: string[]
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
  onSetEditMode: (mode: 'roof' | 'obstacle') => void
  onStartDrawing: () => void
  onUndoDrawing: () => void
  onCancelDrawing: () => void
  onCommitDrawing: () => void
  onStartObstacleDrawing: () => void
  onUndoObstacleDrawing: () => void
  onCancelObstacleDrawing: () => void
  onCommitObstacleDrawing: () => void
  onSelectFootprint: (footprintId: string, multiSelect: boolean) => void
  onSelectObstacle: (obstacleId: string, multiSelect: boolean) => void
  onSetActiveFootprintKwp: (kwp: number) => void
  onSetActiveObstacleHeight: (heightM: number) => void
  onSetActiveObstacleKind: (kind: ObstacleKind) => void
  onSetPitchAdjustmentPercent: (pitchAdjustmentPercent: number) => void
  onDeleteActiveFootprint: () => void
  onDeleteActiveObstacle: () => void
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
  editMode: 'roof' | 'obstacle'
  footprints: FootprintPolygon[]
  activeFootprint: FootprintPolygon | null
  selectedFootprintIds: string[]
  drawDraftRoof: Array<[number, number]>
  isDrawingRoof: boolean
  obstacles: ObstacleStateEntry[]
  activeObstacle: ObstacleStateEntry | null
  selectedObstacleIds: string[]
  drawDraftObstacle: Array<[number, number]>
  isDrawingObstacle: boolean
  orbitEnabled: boolean
  roofMeshes: RoofMeshData[]
  obstacleMeshes: RoofMeshData[]
  vertexConstraints: FaceConstraints['vertexHeights']
  selectedVertexIndex: number | null
  selectedEdgeIndex: number | null
  showSolveHint: boolean
  sunProjectionEnabled: boolean
  shadingEnabled: boolean
  hasValidSunDatetime: boolean
  sunDatetimeError: string | null
  sunProjectionResult: SunProjectionResult | null
  shadingHeatmapFeatures: ShadeHeatmapFeature[]
  shadingComputeState: RoofShadingComputeState
  annualSimulationHeatmapFeatures: ShadeHeatmapFeature[]
  annualSimulationState: AnnualSimulationState
  activeHeatmapMode: 'live-shading' | 'annual-sun-access' | 'none'
  shadingComputeMode: 'final' | 'coarse'
  shadingResultStatus: ComputeRoofShadeGridResult['status'] | null
  shadingStatusMessage: string | null
  shadingDiagnostics: RoofShadeDiagnostics | null
  shadingGridResolutionM: number
  shadingUsedGridResolutionM: number | null
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
  onSelectObstacle: (obstacleId: string, multiSelect: boolean) => void
  onClearSelection: () => void
  onMoveVertex: (vertexIndex: number, point: [number, number]) => boolean
  onMoveEdge: (edgeIndex: number, delta: [number, number]) => boolean
  onMoveObstacleVertex: (obstacleId: string, vertexIndex: number, point: [number, number]) => boolean
  onMoveRejected: () => void
  onAdjustHeight: (stepM: number) => void
  onMapClick: (point: [number, number]) => void
  onCloseDrawing: () => void
  onObstacleMapClick: (point: [number, number]) => void
  onCloseObstacleDrawing: () => void
  onBearingChange: (bearingDeg: number) => void
  onPitchChange: (pitchDeg: number) => void
  onGeometryDragStateChange: (dragging: boolean) => void
  productionComputationEnabled: boolean
  onInitialized: () => void
  onToggleSunProjectionEnabled: (enabled: boolean) => void
  onSunDatetimeInputChange: (datetimeIsoRaw: string) => void
  annualSunAccess: {
    selectedRoofCount: number
    gridResolutionM: number
    state: AnnualSimulationState
    progressRatio: number
    result: AnnualSunAccessResult | null
    error: string | null
    isAnnualHeatmapVisible: boolean
    onGridResolutionChange: (gridResolutionM: number) => void
    onRunSimulation: (options: AnnualSimulationOptions) => Promise<void>
    onClearSimulation: () => void
    onShowAnnualHeatmap: () => void
    onHideAnnualHeatmap: () => void
  }
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
