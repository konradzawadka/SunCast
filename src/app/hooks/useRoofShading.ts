import { useEffect, useMemo, useState } from 'react'
import { computeRoofShadeGrid, type ComputeRoofShadeGridInput, type ComputeRoofShadeGridResult } from '../../geometry/shading'
import type { RoofShadeDiagnostics, ShadingRoofInput } from '../../geometry/shading/types'
import { toShadingObstacleVolume } from '../../geometry/obstacles/obstacleModels'
import type { ObstacleStateEntry } from '../../types/geometry'

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

export interface RoofShadingResult {
  heatmapFeatures: ShadeHeatmapFeature[]
  computeState: RoofShadingComputeState
  computeMode: 'final' | 'coarse'
  resultStatus: ComputeRoofShadeGridResult['status'] | null
  statusMessage: string | null
  diagnostics: RoofShadeDiagnostics | null
  usedGridResolutionM: number | null
}

interface RoofShadingRequest {
  payload: ComputeRoofShadeGridInput
  key: string
  cacheRevision: number
  computeMode: 'final' | 'coarse'
  usedGridResolutionM: number
}

export interface UseRoofShadingArgs {
  cacheRevision: number
  enabled: boolean
  roofs: ShadingRoofInput[]
  obstacles: ObstacleStateEntry[]
  datetimeIso: string | null
  gridResolutionM: number
  interactionActive: boolean
  interactionThrottleMs?: number
}

const SHADE_CACHE_LIMIT = 120
const roofShadingResultCache = new Map<string, ComputeRoofShadeGridResult>()
const DEFAULT_INTERACTION_THROTTLE_MS = 100
const MIN_COARSE_GRID_RESOLUTION_M = 0.9
const MAX_INTERACTION_SAMPLE_COUNT = 3500

// Purpose: Builds request key from the provided inputs.
// Why: Centralizes object/geometry construction and avoids duplicated assembly logic.
function createRequestKey(request: RoofShadingRequest): string {
  return [
    String(request.cacheRevision),
    request.computeMode,
    request.payload.datetimeIso,
    request.payload.gridResolutionM.toFixed(4),
    String(request.payload.maxSampleCount ?? ''),
    request.payload.sampleOverflowStrategy ?? '',
  ].join('::')
}

// Purpose: Encapsulates cache result behavior in one reusable function.
// Why: Improves readability by isolating a single responsibility behind a named function.
function cacheResult(key: string, result: ComputeRoofShadeGridResult): void {
  roofShadingResultCache.set(key, result)
  if (roofShadingResultCache.size <= SHADE_CACHE_LIMIT) {
    return
  }

  const oldestKey = roofShadingResultCache.keys().next().value
  if (typeof oldestKey === 'string') {
    roofShadingResultCache.delete(oldestKey)
  }
}

// Purpose: Encapsulates to heatmap features behavior in one reusable function.
// Why: Improves readability by isolating a single responsibility behind a named function.
function toHeatmapFeatures(result: ComputeRoofShadeGridResult): ShadeHeatmapFeature[] {
  if (result.status !== 'OK') {
    return []
  }

  return result.roofs.flatMap((roof) =>
    roof.cells.map((cell) => {
      const ring = cell.cellPolygon.map(([lon, lat]) => [lon, lat])
      if (ring.length > 0) {
        const [firstLon, firstLat] = ring[0]
        const [lastLon, lastLat] = ring[ring.length - 1]
        if (firstLon !== lastLon || firstLat !== lastLat) {
          ring.push([firstLon, firstLat])
        }
      }

      return {
        type: 'Feature' as const,
        properties: {
          roofId: cell.roofId,
          shade: cell.shadeFactor,
          intensity: 1 - cell.shadeFactor,
        },
        geometry: {
          type: 'Polygon' as const,
          coordinates: [ring],
        },
      }
    }),
  )
}

// Purpose: Builds request from the provided inputs.
// Why: Centralizes object/geometry construction and avoids duplicated assembly logic.
function makeRequest({
  cacheRevision,
  enabled,
  datetimeIso,
  roofs,
  obstacles,
  gridResolutionM,
  interactionActive,
}: Pick<
  UseRoofShadingArgs,
  'cacheRevision' | 'enabled' | 'datetimeIso' | 'roofs' | 'obstacles' | 'gridResolutionM' | 'interactionActive'
>): RoofShadingRequest | null {
  if (!enabled || !datetimeIso || roofs.length === 0 || gridResolutionM <= 0) {
    return null
  }

  const computeMode = interactionActive ? ('coarse' as const) : ('final' as const)
  const usedGridResolutionM =
    computeMode === 'coarse'
      ? Math.max(MIN_COARSE_GRID_RESOLUTION_M, gridResolutionM * 1.9)
      : gridResolutionM
  const maxSampleCount = computeMode === 'coarse' ? MAX_INTERACTION_SAMPLE_COUNT : undefined

  const payload: ComputeRoofShadeGridInput = {
    datetimeIso,
    roofs,
    obstacles: obstacles.map(toShadingObstacleVolume),
    gridResolutionM: usedGridResolutionM,
    maxSampleCount,
    sampleOverflowStrategy: 'auto-increase',
  }

  const provisionalRequest: RoofShadingRequest = {
    payload,
    cacheRevision,
    computeMode,
    usedGridResolutionM,
    key: '',
  }

  return {
    ...provisionalRequest,
    key: createRequestKey(provisionalRequest),
  }
}

const IDLE_RESULT: RoofShadingResult = {
  heatmapFeatures: [],
  computeState: 'IDLE',
  computeMode: 'final',
  resultStatus: null,
  statusMessage: null,
  diagnostics: null,
  usedGridResolutionM: null,
}

// Purpose: Coordinates the roof shading workflow as a reusable hook.
// Why: Keeps orchestration logic reusable and separated from component rendering.
export function useRoofShading(args: UseRoofShadingArgs): RoofShadingResult {
  const { cacheRevision, enabled, datetimeIso, roofs, obstacles, gridResolutionM, interactionActive } = args

  const interactionThrottleMs =
    Number.isFinite(args.interactionThrottleMs) && args.interactionThrottleMs !== undefined
      ? Math.max(20, args.interactionThrottleMs)
      : DEFAULT_INTERACTION_THROTTLE_MS

  const request = useMemo(
    () => makeRequest({ cacheRevision, enabled, datetimeIso, roofs, obstacles, gridResolutionM, interactionActive }),
    [cacheRevision, datetimeIso, enabled, gridResolutionM, interactionActive, obstacles, roofs],
  )
  const [throttledRequest, setThrottledRequest] = useState<RoofShadingRequest | null>(null)

  useEffect(() => {
    if (!interactionActive || !request) {
      return
    }

    const timerId = window.setTimeout(() => {
      setThrottledRequest(request)
    }, interactionThrottleMs)

    return () => {
      window.clearTimeout(timerId)
    }
  }, [interactionActive, interactionThrottleMs, request])

  const activeRequest = interactionActive ? throttledRequest : request

  const computedResult = useMemo(() => {
    if (!activeRequest) {
      return null
    }

    const cached = roofShadingResultCache.get(activeRequest.key)
    const computed = cached ?? computeRoofShadeGrid(activeRequest.payload)
    if (!cached) {
      cacheResult(activeRequest.key, computed)
    }
    return computed
  }, [activeRequest])

  const heatmapFeatures = useMemo(() => {
    if (!computedResult) {
      return []
    }
    return toHeatmapFeatures(computedResult)
  }, [computedResult])

  if (!request) {
    return IDLE_RESULT
  }

  if (!activeRequest || !computedResult) {
    return {
      ...IDLE_RESULT,
      computeState: 'SCHEDULED',
      computeMode: request.computeMode,
      usedGridResolutionM: request.usedGridResolutionM,
    }
  }

  return {
    heatmapFeatures,
    computeState: 'READY',
    computeMode: activeRequest.computeMode,
    resultStatus: computedResult.status,
    statusMessage: computedResult.statusMessage,
    diagnostics: computedResult.diagnostics,
    usedGridResolutionM: activeRequest.usedGridResolutionM,
  }
}
