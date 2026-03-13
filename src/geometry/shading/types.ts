import type { LngLat, ObstacleKind, RoofPlane } from '../../types/geometry'
import type { ShadingObstacleVolume } from '../obstacles/obstacleModels'
import type { LocalOrigin, Point2 } from '../projection/localMeters'

export interface Point3 {
  x: number
  y: number
  z: number
}

export interface Triangle3 {
  a: Point3
  b: Point3
  c: Point3
}

export interface BBox2 {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export interface ShadingRoofInput {
  roofId: string
  polygon: LngLat[]
  vertexHeightsM: number[]
}

export type ShadingObstacleInput = ShadingObstacleVolume

export interface LocalRoofSurface {
  roofId: string
  polygonLocal: Point2[]
  plane: RoofPlane
  bbox: BBox2
}

export interface RoofSamplePoint {
  roofId: string
  x: number
  y: number
  z: number
  cellPolygonLocal: Point2[]
}

export interface ObstaclePrism {
  id: string
  kind?: ObstacleKind
  heightAboveGroundM: number
  polygonLocal: Point2[]
  bbox: BBox2
  triangles: Triangle3[]
}

export interface SunDirection {
  x: number
  y: number
  z: number
}

export interface RoofShadeCell {
  roofId: string
  sample: {
    x: number
    y: number
    z: number
  }
  shadeFactor: 0 | 1
  cellPolygonLocal: Point2[]
  cellPolygon: LngLat[]
}

export interface RoofShadeResult {
  roofId: string
  shadedCellCount: number
  litCellCount: number
  cells: RoofShadeCell[]
}

export interface RoofShadeSnapshotResult {
  roofId: string
  isSunFacing: boolean
  shadedCellCount: number
  litCellCount: number
  shadeFactors: Array<0 | 1>
}

export interface PreparedShadingRoof {
  roofId: string
  surface: LocalRoofSurface
  samples: RoofSamplePoint[]
  obstacleCandidates: ObstaclePrism[]
}

export interface PreparedShadingScene {
  origin: LocalOrigin
  roofs: PreparedShadingRoof[]
  obstacles: ObstaclePrism[]
  maxObstacleHeightM: number
  maxShadowDistanceClampM: number
  diagnostics: RoofShadeDiagnostics
}

export interface RoofShadeDiagnostics {
  roofsProcessed: number
  roofsSkipped: number
  obstaclesProcessed: number
  sampleCount: number
  obstacleCandidatesChecked: number
}

export interface ComputeRoofShadeGridInput {
  datetimeIso: string
  roofs: ShadingRoofInput[]
  obstacles: ShadingObstacleInput[]
  gridResolutionM: number
  maxSampleCount?: number
  sampleOverflowStrategy?: 'auto-increase' | 'abort'
  lowSunElevationThresholdDeg?: number
  maxShadowDistanceClampM?: number
}

export type ShadeComputationStatus =
  | 'OK'
  | 'NO_ROOFS'
  | 'SUN_BELOW_HORIZON'
  | 'SUN_TOO_LOW'
  | 'INVALID_GRID_RESOLUTION'

export interface ComputeRoofShadeGridResult {
  status: ShadeComputationStatus
  statusMessage: string
  origin: LocalOrigin | null
  sunAzimuthDeg: number | null
  sunElevationDeg: number | null
  sunDirection: SunDirection | null
  roofs: RoofShadeResult[]
  diagnostics: RoofShadeDiagnostics
}

export interface PrepareShadingSceneInput {
  roofs: ShadingRoofInput[]
  obstacles: ShadingObstacleInput[]
  gridResolutionM: number
  maxSampleCount?: number
  sampleOverflowStrategy?: 'auto-increase' | 'abort'
  maxShadowDistanceClampM?: number
}

export interface ComputeShadeSnapshotInput {
  scene: PreparedShadingScene
  sunAzimuthDeg: number
  sunElevationDeg: number
  lowSunElevationThresholdDeg?: number
  maxShadowDistanceClampM?: number
}

export interface ComputeShadeSnapshotResult {
  status: ShadeComputationStatus
  statusMessage: string
  sunAzimuthDeg: number
  sunElevationDeg: number
  sunDirection: SunDirection | null
  roofs: RoofShadeSnapshotResult[]
  diagnostics: RoofShadeDiagnostics
}

export interface AnnualSunAccessInput {
  scene: PreparedShadingScene
  year?: number
  dateStartIso?: string
  dateEndIso?: string
  timeZone: string
  halfYearMirror: boolean
  sampleWindowDays: number
  stepMinutes: number
  lowSunElevationThresholdDeg?: number
  maxShadowDistanceClampM?: number
}

export interface AnnualSunAccessRoofResult {
  roofId: string
  sunHours: number
  daylightHours: number
  frontSideHours: number
  sunAccessRatio: number
  litCellCountWeighted: number
  totalCellCountWeighted: number
}

export interface AnnualSunAccessHeatmapCell {
  roofId: string
  cellPolygon: LngLat[]
  litRatio: number
}

export interface AnnualSunAccessResult {
  roofs: AnnualSunAccessRoofResult[]
  heatmapCells: AnnualSunAccessHeatmapCell[]
  meta: {
    sampledDayCount: number
    simulatedHalfYear: boolean
    stepMinutes: number
    sampleWindowDays: number
    dateStartIso: string
    dateEndIso: string
  }
}

export interface AnnualSunAccessProgress {
  sampledDays: number
  totalSampledDays: number
}
