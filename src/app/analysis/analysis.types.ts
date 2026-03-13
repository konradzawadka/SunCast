import type { ShadingRoofInput } from '../../geometry/shading'
import type { RoofShadeDiagnostics } from '../../geometry/shading'
import type { ShadeComputationStatus } from '../../geometry/shading/types'
import type { AnnualSunAccessResult } from '../../geometry/shading'
import type { SunProjectionResult } from '../../geometry/sun/sunProjection'
import type { SolvedEntry } from './solvedRoof.types'
import type { SelectedRoofSunInput } from '../../types/presentation-contracts'

export interface ShadeHeatmapFeature {
  type: 'Feature'
  properties: {
    roofId: string
    shade: 0 | 1
    intensity: number
  }
  geometry: {
    type: 'Polygon'
    coordinates: number[][][]
  }
}

export type RoofShadingComputeState = 'IDLE' | 'SCHEDULED' | 'READY'
export type AnnualSimulationState = 'IDLE' | 'RUNNING' | 'READY' | 'ERROR'

export interface AnnualSimulationProgress {
  ratio: number
  sampledDays: number
  totalSampledDays: number
}

export interface AnnualSimulationOptions {
  year?: number
  dateStartIso?: string
  dateEndIso?: string
  sampleWindowDays: number
  stepMinutes: number
  halfYearMirror: boolean
  lowSunElevationThresholdDeg?: number
  maxShadowDistanceClampM?: number
}

export interface AnnualSimulationResult {
  state: AnnualSimulationState
  progress: AnnualSimulationProgress
  result: AnnualSunAccessResult | null
  heatmapFeatures: ShadeHeatmapFeature[]
  error: string | null
  runSimulation: (options: AnnualSimulationOptions) => Promise<void>
  clearSimulation: () => void
}

export interface AnalysisDiagnostics {
  solverError: string | null
  warnings: string[]
  shadingResultStatus: ShadeComputationStatus | null
  shadingStatusMessage: string | null
  shadingDiagnostics: RoofShadeDiagnostics | null
}

export interface AnalysisHeatmapState {
  activeMode: ActiveHeatmapMode
  requestedMode: RequestedHeatmapMode
  liveFeatures: ShadeHeatmapFeature[]
  annualFeatures: ShadeHeatmapFeature[]
  mapFeatures: ShadeHeatmapFeature[]
  mapComputeState: RoofShadingComputeState
  mapEnabled: boolean
  annualVisible: boolean
}

export interface AnalysisState {
  solvedRoofs: {
    entries: SolvedEntry[]
    activeSolved: SolvedEntry | null
    activeError: string | null
  }
  shadingRoofs: ShadingRoofInput[]
  selectedRoofInputs: SelectedRoofSunInput[]
  sunProjection: {
    datetimeRaw: string
    dailyDateRaw: string
    dailyTimeZone: string
    hasValidDatetime: boolean
    datetimeError: string | null
    result: SunProjectionResult | null
    onDatetimeInputChange: (datetimeIsoRaw: string) => void
  }
  liveShading: {
    heatmapFeatures: ShadeHeatmapFeature[]
    computeState: RoofShadingComputeState
    computeMode: 'final' | 'coarse'
    resultStatus: ShadeComputationStatus | null
    statusMessage: string | null
    diagnostics: RoofShadeDiagnostics | null
    usedGridResolutionM: number | null
  }
  annualSimulation: AnnualSimulationResult
  heatmap: AnalysisHeatmapState
  diagnostics: AnalysisDiagnostics
  productionComputationEnabled: boolean
}

export type RequestedHeatmapMode = 'live-shading' | 'annual-sun-access' | 'none'
export type ActiveHeatmapMode = RequestedHeatmapMode
