import { useCallback, useMemo, useRef, useState } from 'react'
import {
  computeAnnualSunAccessBatched,
  prepareShadingScene,
  type AnnualSunAccessProgress,
  type AnnualSunAccessResult,
  type ShadingRoofInput,
} from '../../geometry/shading'
import { toShadingObstacleVolume } from '../../geometry/obstacles/obstacleModels'
import type { ObstacleStateEntry } from '../../types/geometry'
import type { ShadeHeatmapFeature } from './useRoofShading'
import { reportAppErrorCode } from '../../shared/errors'

const ANNUAL_CACHE_LIMIT = 24
const annualSimulationCache = new Map<string, AnnualSunAccessResult>()

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

export interface UseAnnualRoofSimulationArgs {
  cacheRevision: number
  roofs: ShadingRoofInput[]
  obstacles: ObstacleStateEntry[]
  gridResolutionM: number
  timeZone: string
}

export interface AnnualRoofSimulationHookResult {
  state: AnnualSimulationState
  progress: AnnualSimulationProgress
  result: AnnualSunAccessResult | null
  heatmapFeatures: ShadeHeatmapFeature[]
  error: string | null
  runSimulation: (options: AnnualSimulationOptions) => Promise<void>
  clearSimulation: () => void
}

const IDLE_PROGRESS: AnnualSimulationProgress = {
  ratio: 0,
  sampledDays: 0,
  totalSampledDays: 0,
}

// Purpose: Computes clamp progress ratio deterministically from the provided input values.
// Why: Improves readability by isolating a single responsibility behind a named function.
function clampProgressRatio(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }
  return Math.max(0, Math.min(1, value))
}

// Purpose: Encapsulates cache annual result behavior in one reusable function.
// Why: Improves readability by isolating a single responsibility behind a named function.
function cacheAnnualResult(key: string, value: AnnualSunAccessResult): void {
  annualSimulationCache.set(key, value)
  if (annualSimulationCache.size <= ANNUAL_CACHE_LIMIT) {
    return
  }

  const oldestKey = annualSimulationCache.keys().next().value
  if (typeof oldestKey === 'string') {
    annualSimulationCache.delete(oldestKey)
  }
}

// Purpose: Encapsulates close ring if needed behavior in one reusable function.
// Why: Improves readability by isolating a single responsibility behind a named function.
function closeRingIfNeeded(points: Array<[number, number]>): number[][] {
  const ring = points.map(([lon, lat]) => [lon, lat])
  if (ring.length === 0) {
    return ring
  }

  const first = ring[0]
  const last = ring[ring.length - 1]
  if (first[0] !== last[0] || first[1] !== last[1]) {
    ring.push([first[0], first[1]])
  }

  return ring
}

// Purpose: Encapsulates to annual heatmap features behavior in one reusable function.
// Why: Improves readability by isolating a single responsibility behind a named function.
function toAnnualHeatmapFeatures(result: AnnualSunAccessResult): ShadeHeatmapFeature[] {
  return result.heatmapCells.map((cell) => ({
    type: 'Feature',
    properties: {
      roofId: cell.roofId,
      shade: cell.litRatio < 0.5 ? 1 : 0,
      intensity: cell.litRatio,
    },
    geometry: {
      type: 'Polygon',
      coordinates: [closeRingIfNeeded(cell.cellPolygon)],
    },
  }))
}

// Purpose: Builds run key from the provided inputs.
// Why: Centralizes object/geometry construction and avoids duplicated assembly logic.
function buildRunKey(
  cacheRevision: number,
  gridResolutionM: number,
  timeZone: string,
  options: AnnualSimulationOptions,
): string {
  return [
    String(cacheRevision),
    gridResolutionM.toFixed(4),
    timeZone,
    String(options.year ?? ''),
    String(options.dateStartIso ?? ''),
    String(options.dateEndIso ?? ''),
    options.sampleWindowDays,
    options.stepMinutes,
    options.halfYearMirror ? 1 : 0,
    String(options.lowSunElevationThresholdDeg ?? ''),
    String(options.maxShadowDistanceClampM ?? ''),
  ].join('::')
}

// Purpose: Checks whether valid date iso and returns a boolean result.
// Why: Improves readability by isolating a single responsibility behind a named function.
function isValidDateIso(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }
  const [yearRaw, monthRaw, dayRaw] = value.split('-')
  const year = Number(yearRaw)
  const month = Number(monthRaw)
  const day = Number(dayRaw)
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return false
  }
  const ts = Date.UTC(year, month - 1, day)
  if (!Number.isFinite(ts)) {
    return false
  }
  const normalized = new Date(ts)
  return (
    normalized.getUTCFullYear() === year &&
    normalized.getUTCMonth() + 1 === month &&
    normalized.getUTCDate() === day
  )
}

// Purpose: Encapsulates yield to browser behavior in one reusable function.
// Why: Improves readability by isolating a single responsibility behind a named function.
async function yieldToBrowser(): Promise<void> {
  await new Promise<void>((resolve) => {
    window.setTimeout(() => resolve(), 0)
  })
}

// Purpose: Coordinates the annual roof simulation workflow as a reusable hook.
// Why: Keeps orchestration logic reusable and separated from component rendering.
export function useAnnualRoofSimulation(args: UseAnnualRoofSimulationArgs): AnnualRoofSimulationHookResult {
  const shadingObstacles = useMemo(() => args.obstacles.map(toShadingObstacleVolume), [args.obstacles])
  const simulationContextKey = useMemo(
    () => `${args.cacheRevision}::${args.gridResolutionM.toFixed(4)}::${args.timeZone}`,
    [args.cacheRevision, args.gridResolutionM, args.timeZone],
  )

  const runTokenRef = useRef(0)
  const lastReportedErrorRef = useRef<string | null>(null)
  const [store, setStore] = useState<{
    contextKey: string
    state: AnnualSimulationState
    result: AnnualSunAccessResult | null
    heatmapFeatures: ShadeHeatmapFeature[]
    error: string | null
    progress: AnnualSimulationProgress
  }>(() => ({
    contextKey: simulationContextKey,
    state: 'IDLE',
    result: null,
    heatmapFeatures: [],
    error: null,
    progress: IDLE_PROGRESS,
  }))

  const clearSimulation = useCallback(() => {
    runTokenRef.current += 1
    lastReportedErrorRef.current = null
    setStore({
      contextKey: simulationContextKey,
      state: 'IDLE',
      result: null,
      heatmapFeatures: [],
      error: null,
      progress: IDLE_PROGRESS,
    })
  }, [simulationContextKey])

  const runSimulation = useCallback(
    async (options: AnnualSimulationOptions) => {
      const setSimulationError = (message: string, reason: string): void => {
        setStore({
          contextKey: simulationContextKey,
          state: 'ERROR',
          error: message,
          result: null,
          heatmapFeatures: [],
          progress: IDLE_PROGRESS,
        })
        if (lastReportedErrorRef.current !== message) {
          reportAppErrorCode('ANNUAL_SIMULATION_FAILED', message, {
            context: { area: 'annual-simulation', reason },
          })
          lastReportedErrorRef.current = message
        }
      }

      const runToken = runTokenRef.current + 1
      runTokenRef.current = runToken

      if (args.roofs.length === 0 || args.gridResolutionM <= 0) {
        setSimulationError('Select at least one solved roof to run annual simulation.', 'missing-roofs')
        return
      }
      const hasDateStart = typeof options.dateStartIso === 'string' && options.dateStartIso.trim().length > 0
      const hasDateEnd = typeof options.dateEndIso === 'string' && options.dateEndIso.trim().length > 0
      if (hasDateStart !== hasDateEnd) {
        setSimulationError('Provide both start and end dates to run a date-range simulation.', 'missing-date-pair')
        return
      }
      if (hasDateStart && hasDateEnd) {
        const dateStartIso = options.dateStartIso?.trim() ?? ''
        const dateEndIso = options.dateEndIso?.trim() ?? ''
        if (!isValidDateIso(dateStartIso) || !isValidDateIso(dateEndIso) || dateStartIso > dateEndIso) {
          setSimulationError('Provide a valid date range where start date is not after end date.', 'invalid-date-range')
          return
        }
      }

      setStore({
        contextKey: simulationContextKey,
        state: 'RUNNING',
        error: null,
        result: null,
        heatmapFeatures: [],
        progress: {
          ratio: 0,
          sampledDays: 0,
          totalSampledDays: 1,
        },
      })
      lastReportedErrorRef.current = null

      const runKey = buildRunKey(args.cacheRevision, args.gridResolutionM, args.timeZone, options)
      const cached = annualSimulationCache.get(runKey)
      if (cached) {
        if (runTokenRef.current !== runToken) {
          return
        }
        setStore({
          contextKey: simulationContextKey,
          state: 'READY',
          error: null,
          result: cached,
          heatmapFeatures: toAnnualHeatmapFeatures(cached),
          progress: {
            ratio: 1,
            sampledDays: cached.meta.sampledDayCount,
            totalSampledDays: cached.meta.sampledDayCount,
          },
        })
        return
      }

      await yieldToBrowser()
      if (runTokenRef.current !== runToken) {
        return
      }

      const scene = prepareShadingScene({
        roofs: args.roofs,
        obstacles: shadingObstacles,
        gridResolutionM: args.gridResolutionM,
        maxShadowDistanceClampM: options.maxShadowDistanceClampM,
      })

      if (!scene) {
        if (runTokenRef.current !== runToken) {
          return
        }
        setSimulationError('Unable to prepare shading scene for annual simulation.', 'scene-prepare-failed')
        return
      }

      const computed = await computeAnnualSunAccessBatched(
        {
          scene,
          year: options.year,
          dateStartIso: options.dateStartIso,
          dateEndIso: options.dateEndIso,
          timeZone: args.timeZone,
          halfYearMirror: options.halfYearMirror,
          sampleWindowDays: options.sampleWindowDays,
          stepMinutes: options.stepMinutes,
          lowSunElevationThresholdDeg: options.lowSunElevationThresholdDeg,
          maxShadowDistanceClampM: options.maxShadowDistanceClampM,
        },
        {
          onProgress: (annualProgress: AnnualSunAccessProgress) => {
            if (runTokenRef.current !== runToken) {
              return
            }
            const total = Math.max(1, annualProgress.totalSampledDays)
            setStore((prev) => ({
              ...prev,
              progress: {
                sampledDays: annualProgress.sampledDays,
                totalSampledDays: annualProgress.totalSampledDays,
                ratio: annualProgress.sampledDays / total,
              },
            }))
          },
          onYield: yieldToBrowser,
        },
      )

      if (runTokenRef.current !== runToken) {
        return
      }

      if (!computed) {
        setSimulationError(
          'Annual simulation failed. Verify simulation parameters and selected roofs.',
          'compute-returned-null',
        )
        return
      }

      cacheAnnualResult(runKey, computed)
      setStore({
        contextKey: simulationContextKey,
        state: 'READY',
        error: null,
        result: computed,
        heatmapFeatures: toAnnualHeatmapFeatures(computed),
        progress: {
          ratio: 1,
          sampledDays: computed.meta.sampledDayCount,
          totalSampledDays: computed.meta.sampledDayCount,
        },
      })
      lastReportedErrorRef.current = null
    },
    [args.cacheRevision, args.gridResolutionM, args.roofs, args.timeZone, shadingObstacles, simulationContextKey],
  )
  const hasContextMismatch = store.contextKey !== simulationContextKey

  return {
    state: hasContextMismatch ? 'IDLE' : store.state,
    progress: {
      ...(hasContextMismatch ? IDLE_PROGRESS : store.progress),
      ratio: clampProgressRatio((hasContextMismatch ? IDLE_PROGRESS : store.progress).ratio),
    },
    result: hasContextMismatch ? null : store.result,
    heatmapFeatures: hasContextMismatch ? [] : store.heatmapFeatures,
    error: hasContextMismatch ? null : store.error,
    runSimulation,
    clearSimulation,
  }
}
