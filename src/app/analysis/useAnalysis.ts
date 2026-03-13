import { useMemo, useState } from 'react'
import { deriveSelectedRoofInputs } from './deriveSelectedRoofInputs'
import { useAnnualSimulation } from './useAnnualSimulation'
import { useDerivedHeatmapMode } from './deriveHeatmapMode'
import { useDerivedShadingRoofs } from './deriveShadingRoofs'
import { deriveSolvedRoofs } from './deriveSolvedRoofs'
import { useLiveShading } from './useLiveShading'
import { useSunProjectionPanel } from '../features/sun-tools/useSunProjectionPanel'
import type { ObstacleStateEntry, ProjectSunProjectionSettings, ShadingSettings } from '../../types/geometry'
import type { FootprintStateEntry } from '../../state/project-store/projectState.types'
import type { AnalysisState } from './analysis.types'

interface UseAnalysisArgs {
  stateRevision: number
  footprintEntries: FootprintStateEntry[]
  footprintEntriesById: Record<string, FootprintStateEntry>
  activeFootprintId: string | null
  selectedFootprintIds: string[]
  activeFootprintVertices: Array<[number, number]> | null
  obstacles: ObstacleStateEntry[]
  sunProjection: ProjectSunProjectionSettings
  shadingSettings: ShadingSettings
  hasVertexOrEdgeSelection: boolean
  isGeometryDragActive: boolean
  setSunProjectionDatetimeIso: (datetimeIso: string | null) => void
  setSunProjectionDailyDateIso: (dailyDateIso: string | null) => void
}

export function useAnalysis(args: UseAnalysisArgs) {
  const solved = deriveSolvedRoofs(args.footprintEntries, args.activeFootprintId)

  const selectedRoofInputs = deriveSelectedRoofInputs({
    selectedFootprintIds: args.selectedFootprintIds,
    footprintEntries: args.footprintEntriesById,
    solvedEntries: solved.entries,
  })

  const shadingRoofs = useDerivedShadingRoofs({
    selectedFootprintIds: args.selectedFootprintIds,
    activeFootprintId: args.activeFootprintId,
    footprintEntries: args.footprintEntriesById,
    solvedEntries: solved.entries,
  })

  const productionComputationEnabled = !args.isGeometryDragActive && !args.hasVertexOrEdgeSelection

  const {
    sunDatetimeRaw,
    sunDailyDateRaw,
    sunDailyTimeZone,
    sunDatetimeError,
    hasValidSunDatetime,
    sunProjectionResult,
    onSunDatetimeInputChange,
  } = useSunProjectionPanel({
    sunProjection: args.sunProjection,
    activeVertices: args.activeFootprintVertices ?? null,
    activePlane: solved.activeSolved?.solution.plane ?? null,
    setSunProjectionDatetimeIso: args.setSunProjectionDatetimeIso,
    setSunProjectionDailyDateIso: args.setSunProjectionDailyDateIso,
  })

  const shadingResult = useLiveShading({
    cacheRevision: args.stateRevision,
    enabled: args.shadingSettings.enabled && args.sunProjection.enabled && hasValidSunDatetime && !args.isGeometryDragActive,
    roofs: shadingRoofs,
    obstacles: args.obstacles,
    datetimeIso: args.sunProjection.datetimeIso,
    gridResolutionM: args.shadingSettings.gridResolutionM,
    interactionActive: args.isGeometryDragActive,
  })

  const annualSimulation = useAnnualSimulation({
    cacheRevision: args.stateRevision,
    roofs: shadingRoofs,
    obstacles: args.obstacles,
    gridResolutionM: args.shadingSettings.gridResolutionM,
    timeZone: sunDailyTimeZone,
  })

  const [requestedHeatmapMode, setRequestedHeatmapMode] = useState<'live-shading' | 'annual-sun-access' | 'none'>(
    'live-shading',
  )

  const activeHeatmapMode = useDerivedHeatmapMode({
    requestedHeatmapMode,
    annualSimulationState: annualSimulation.state,
    shadingEnabled: args.shadingSettings.enabled,
  })

  const annualHeatmapVisible =
    activeHeatmapMode === 'annual-sun-access' &&
    annualSimulation.state === 'READY' &&
    annualSimulation.heatmapFeatures.length > 0

  const heatmapFeaturesForMap =
    activeHeatmapMode === 'annual-sun-access' ? annualSimulation.heatmapFeatures : shadingResult.heatmapFeatures

  const heatmapComputeStateForMap =
    activeHeatmapMode === 'annual-sun-access'
      ? annualSimulation.state === 'RUNNING'
        ? ('SCHEDULED' as const)
        : annualSimulation.state === 'READY'
          ? ('READY' as const)
          : ('IDLE' as const)
      : shadingResult.computeState

  const heatmapEnabledForMap =
    activeHeatmapMode === 'annual-sun-access'
      ? annualSimulation.state === 'READY'
      : activeHeatmapMode === 'live-shading'
        ? args.shadingSettings.enabled
        : false

  const computeProcessingActive = shadingResult.computeState === 'SCHEDULED' || annualSimulation.state === 'RUNNING'

  const basePitchDeg = solved.activeSolved?.metrics.pitchDeg ?? null
  const solvedMetrics = useMemo(
    () => ({
      basePitchDeg,
      azimuthDeg: solved.activeSolved?.metrics.azimuthDeg ?? null,
      roofAreaM2: solved.activeSolved?.metrics.roofAreaM2 ?? null,
      minHeightM: solved.activeSolved?.metrics.minHeightM ?? null,
      maxHeightM: solved.activeSolved?.metrics.maxHeightM ?? null,
      fitRmsErrorM: solved.activeSolved?.solution.rmsErrorM ?? null,
    }),
    [basePitchDeg, solved.activeSolved],
  )

  const warnings = solved.activeSolved?.solution.warnings.map((warning) => warning.message) ?? []

  return {
    solvedRoofs: solved,
    selectedRoofInputs,
    shadingRoofs,
    sunProjection: {
      datetimeRaw: sunDatetimeRaw,
      dailyDateRaw: sunDailyDateRaw,
      dailyTimeZone: sunDailyTimeZone,
      hasValidDatetime: hasValidSunDatetime,
      datetimeError: sunDatetimeError,
      result: sunProjectionResult,
      onDatetimeInputChange: onSunDatetimeInputChange,
    },
    liveShading: shadingResult,
    annualSimulation,
    heatmap: {
      activeMode: activeHeatmapMode,
      requestedMode: requestedHeatmapMode,
      liveFeatures: shadingResult.heatmapFeatures,
      annualFeatures: annualSimulation.heatmapFeatures,
      mapFeatures: heatmapFeaturesForMap,
      mapComputeState: heatmapComputeStateForMap,
      mapEnabled: heatmapEnabledForMap,
      annualVisible: annualHeatmapVisible,
    },
    diagnostics: {
      solverError: solved.activeError,
      warnings,
      shadingResultStatus: shadingResult.resultStatus,
      shadingStatusMessage: shadingResult.statusMessage,
      shadingDiagnostics: shadingResult.diagnostics,
    },
    productionComputationEnabled,
    setRequestedHeatmapMode,
    computeProcessingActive,
    solvedMetrics,
  } satisfies AnalysisState & {
    setRequestedHeatmapMode: (mode: 'live-shading' | 'annual-sun-access' | 'none') => void
    computeProcessingActive: boolean
    solvedMetrics: {
      basePitchDeg: number | null
      azimuthDeg: number | null
      roofAreaM2: number | null
      minHeightM: number | null
      maxHeightM: number | null
      fitRmsErrorM: number | null
    }
  }
}
