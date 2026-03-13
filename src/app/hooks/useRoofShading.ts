import { useEffect, useMemo, useState } from 'react'
import { computeRoofShadeGrid, type ComputeRoofShadeGridInput, type ComputeRoofShadeGridResult } from '../../geometry/shading'
import type { RoofShadeDiagnostics, ShadingObstacleInput, ShadingRoofInput } from '../../geometry/shading/types'
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
  computeMode: 'final' | 'coarse'
  usedGridResolutionM: number
}

export interface UseRoofShadingArgs {
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

// Purpose: Encapsulates to point fingerprint behavior in one reusable function.
// Why: Improves readability by isolating a single responsibility behind a named function.
function toPointFingerprint([lon, lat]: [number, number]): string {
  return `${lon.toFixed(7)},${lat.toFixed(7)}`
}

// Purpose: Encapsulates roof fingerprint behavior in one reusable function.
// Why: Improves readability by isolating a single responsibility behind a named function.
function roofFingerprint(roof: ShadingRoofInput): string {
  const vertices = roof.polygon.map(toPointFingerprint).join(';')
  const heights = roof.vertexHeightsM.map((height) => height.toFixed(4)).join(';')
  return `${roof.roofId}|${vertices}|${heights}`
}

// Purpose: Encapsulates obstacle fingerprint behavior in one reusable function.
// Why: Improves readability by isolating a single responsibility behind a named function.
function obstacleFingerprint(obstacle: ShadingObstacleInput): string {
  if (obstacle.shape === 'prism') {
    const vertices = obstacle.polygon.map(toPointFingerprint).join(';')
    return `${obstacle.id}|${obstacle.kind}|${obstacle.shape}|${obstacle.heightAboveGroundM.toFixed(3)}|${vertices}`
  }

  return `${obstacle.id}|${obstacle.kind}|${obstacle.shape}|${obstacle.heightAboveGroundM.toFixed(3)}|${toPointFingerprint(
    obstacle.center,
  )}|${obstacle.radiusM.toFixed(3)}`
}

// Purpose: Builds request key from the provided inputs.
// Why: Centralizes object/geometry construction and avoids duplicated assembly logic.
function createRequestKey(request: RoofShadingRequest): string {
  const roofsKey = [...request.payload.roofs]
    .sort((a, b) => a.roofId.localeCompare(b.roofId))
    .map(roofFingerprint)
    .join('||')

  const obstaclesKey = [...request.payload.obstacles]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(obstacleFingerprint)
    .join('||')

  return [
    request.computeMode,
    request.payload.datetimeIso,
    request.payload.gridResolutionM.toFixed(4),
    String(request.payload.maxSampleCount ?? ''),
    request.payload.sampleOverflowStrategy ?? '',
    roofsKey,
    obstaclesKey,
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
function makeRequest(args: UseRoofShadingArgs): RoofShadingRequest | null {
  if (!args.enabled || !args.datetimeIso || args.roofs.length === 0 || args.gridResolutionM <= 0) {
    return null
  }

  const computeMode = args.interactionActive ? ('coarse' as const) : ('final' as const)
  const usedGridResolutionM =
    computeMode === 'coarse'
      ? Math.max(MIN_COARSE_GRID_RESOLUTION_M, args.gridResolutionM * 1.9)
      : args.gridResolutionM
  const maxSampleCount = computeMode === 'coarse' ? MAX_INTERACTION_SAMPLE_COUNT : undefined

  const payload: ComputeRoofShadeGridInput = {
    datetimeIso: args.datetimeIso,
    roofs: args.roofs,
    obstacles: args.obstacles.map(toShadingObstacleVolume),
    gridResolutionM: usedGridResolutionM,
    maxSampleCount,
    sampleOverflowStrategy: 'auto-increase',
  }

  const provisionalRequest: RoofShadingRequest = {
    payload,
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
  const interactionThrottleMs =
    Number.isFinite(args.interactionThrottleMs) && args.interactionThrottleMs !== undefined
      ? Math.max(20, args.interactionThrottleMs)
      : DEFAULT_INTERACTION_THROTTLE_MS

  const request = makeRequest(args)
  const [throttledRequest, setThrottledRequest] = useState<RoofShadingRequest | null>(null)

  useEffect(() => {
    if (!args.interactionActive || !request) {
      return
    }

    const timerId = window.setTimeout(() => {
      setThrottledRequest(request)
    }, interactionThrottleMs)

    return () => {
      window.clearTimeout(timerId)
    }
  }, [args.interactionActive, interactionThrottleMs, request])

  const activeRequest = args.interactionActive ? throttledRequest : request

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
    heatmapFeatures: toHeatmapFeatures(computedResult),
    computeState: 'READY',
    computeMode: activeRequest.computeMode,
    resultStatus: computedResult.status,
    statusMessage: computedResult.statusMessage,
    diagnostics: computedResult.diagnostics,
    usedGridResolutionM: activeRequest.usedGridResolutionM,
  }
}
