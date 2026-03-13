import { useMemo } from 'react'
import type { ActiveHeatmapMode, RequestedHeatmapMode } from './analysis.types'

interface DeriveHeatmapModeArgs {
  requestedHeatmapMode: RequestedHeatmapMode
  annualSimulationState: 'IDLE' | 'RUNNING' | 'READY' | 'ERROR'
  shadingEnabled: boolean
}

export function useDerivedHeatmapMode({
  requestedHeatmapMode,
  annualSimulationState,
  shadingEnabled,
}: DeriveHeatmapModeArgs): ActiveHeatmapMode {
  return useMemo(() => {
    if (requestedHeatmapMode === 'annual-sun-access') {
      return annualSimulationState === 'READY' ? 'annual-sun-access' : shadingEnabled ? 'live-shading' : 'none'
    }
    if (requestedHeatmapMode === 'live-shading') {
      return shadingEnabled ? 'live-shading' : 'none'
    }
    if (annualSimulationState === 'READY') {
      return 'none'
    }
    return shadingEnabled ? 'live-shading' : 'none'
  }, [annualSimulationState, requestedHeatmapMode, shadingEnabled])
}
