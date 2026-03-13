import type { ShadingRoofInput } from '../../geometry/shading'
import type { ShadeHeatmapFeature } from '../../app/hooks/useRoofShading'
import type { AnnualRoofSimulationHookResult } from '../../app/hooks/useAnnualRoofSimulation'
import type { SolvedEntry } from '../../app/hooks/useSolvedRoofEntries'
import type { SelectedRoofSunInput } from '../../app/features/sun-tools/SunOverlayColumn'

export interface AnalysisState {
  solvedRoofs: {
    entries: SolvedEntry[]
    activeSolved: SolvedEntry | null
    activeError: string | null
  }
  shadingRoofs: ShadingRoofInput[]
  selectedRoofInputs: SelectedRoofSunInput[]
  liveShading: {
    heatmapFeatures: ShadeHeatmapFeature[]
    computeState: 'IDLE' | 'SCHEDULED' | 'READY'
    computeMode: 'final' | 'coarse'
    resultStatus: 'OK' | 'PARTIAL' | 'EMPTY' | 'INVALID_INPUT' | 'NO_SUN' | null
    statusMessage: string | null
    diagnostics: unknown
    usedGridResolutionM: number | null
  }
  annualSimulation: AnnualRoofSimulationHookResult
}

export type RequestedHeatmapMode = 'live-shading' | 'annual-sun-access' | 'none'
export type ActiveHeatmapMode = RequestedHeatmapMode
