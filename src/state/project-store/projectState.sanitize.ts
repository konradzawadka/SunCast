import type {
  FootprintPolygon,
  LngLat,
  ObstacleStateEntry,
  ProjectSunProjectionSettings,
  ShadingSettings,
} from '../../types/geometry'
import { createObstacleShapeForKind } from '../../geometry/obstacles/obstacleModels'
import { sanitizeVertexHeights } from './projectState.constraints'
import type { FootprintStateEntry, ProjectState } from './projectState.types'

const MIN_PITCH_ADJUSTMENT_PERCENT = -90
const MAX_PITCH_ADJUSTMENT_PERCENT = 200

function sanitizePitchAdjustmentPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }
  return Math.min(MAX_PITCH_ADJUSTMENT_PERCENT, Math.max(MIN_PITCH_ADJUSTMENT_PERCENT, value))
}

function sanitizePolygon(vertices: unknown): LngLat[] {
  if (!Array.isArray(vertices)) {
    return []
  }
  return vertices.filter(
    (vertex): vertex is [number, number] =>
      Array.isArray(vertex) &&
      vertex.length === 2 &&
      Number.isFinite(vertex[0]) &&
      Number.isFinite(vertex[1]),
  )
}

export function sanitizeLoadedState(
  state: ProjectState,
  defaultSunProjection: ProjectSunProjectionSettings,
  defaultFootprintKwp: number,
  defaultShadingSettings: ShadingSettings,
): ProjectState {
  const sanitized: Record<string, FootprintStateEntry> = {}
  const sanitizedObstacles: Record<string, ObstacleStateEntry> = {}

  for (const [footprintId, entry] of Object.entries(state.footprints)) {
    if (!entry.footprint || !Array.isArray(entry.footprint.vertices)) {
      continue
    }

    const footprint: FootprintPolygon = {
      id: entry.footprint.id || footprintId,
      vertices: entry.footprint.vertices,
      kwp: Number.isFinite(entry.footprint.kwp) ? Math.max(0, entry.footprint.kwp) : defaultFootprintKwp,
    }

    sanitized[footprint.id] = {
      footprint,
      constraints: {
        vertexHeights: sanitizeVertexHeights(entry.constraints.vertexHeights ?? [], footprint.vertices.length),
      },
      pitchAdjustmentPercent: sanitizePitchAdjustmentPercent(entry.pitchAdjustmentPercent),
    }
  }

  const ids = Object.keys(sanitized)
  for (const [obstacleId, obstacle] of Object.entries(state.obstacles ?? {})) {
    if (!obstacle) {
      continue
    }

    const id = typeof obstacle.id === 'string' && obstacle.id.length > 0 ? obstacle.id : obstacleId
    const kind = obstacle.kind ?? 'custom'
    const heightAboveGroundM = Number.isFinite(obstacle.heightAboveGroundM)
      ? Math.max(0, obstacle.heightAboveGroundM)
      : 0

    const legacyPolygon = sanitizePolygon((obstacle as { polygon?: unknown }).polygon)
    const shapeRaw = (obstacle as { shape?: unknown }).shape
    const shape =
      kind === 'building' || kind === 'custom'
        ? (() => {
            if (
              typeof shapeRaw === 'object' &&
              shapeRaw !== null &&
              (shapeRaw as { type?: unknown }).type === 'polygon-prism' &&
              sanitizePolygon((shapeRaw as { polygon?: unknown }).polygon).length >= 3
            ) {
              return {
                type: 'polygon-prism' as const,
                polygon: sanitizePolygon((shapeRaw as { polygon?: unknown }).polygon),
              }
            }
            if (legacyPolygon.length >= 3) {
              return createObstacleShapeForKind(kind, legacyPolygon)
            }
            return null
          })()
        : (() => {
            if (
              typeof shapeRaw === 'object' &&
              shapeRaw !== null &&
              (shapeRaw as { type?: unknown }).type === 'cylinder'
            ) {
              const center = (shapeRaw as { center?: unknown }).center
              const radiusM = Number((shapeRaw as { radiusM?: unknown }).radiusM)
              if (
                Array.isArray(center) &&
                center.length === 2 &&
                Number.isFinite(center[0]) &&
                Number.isFinite(center[1]) &&
                Number.isFinite(radiusM)
              ) {
                return {
                  type: 'cylinder' as const,
                  center: [center[0], center[1]] as LngLat,
                  radiusM: Math.max(0.2, radiusM),
                }
              }
            }
            if (
              typeof shapeRaw === 'object' &&
              shapeRaw !== null &&
              (shapeRaw as { type?: unknown }).type === 'tree'
            ) {
              const center = (shapeRaw as { center?: unknown }).center
              const crownRadiusM = Number((shapeRaw as { crownRadiusM?: unknown }).crownRadiusM)
              const trunkRadiusM = Number((shapeRaw as { trunkRadiusM?: unknown }).trunkRadiusM)
              if (
                Array.isArray(center) &&
                center.length === 2 &&
                Number.isFinite(center[0]) &&
                Number.isFinite(center[1]) &&
                Number.isFinite(crownRadiusM) &&
                Number.isFinite(trunkRadiusM)
              ) {
                return {
                  type: 'tree' as const,
                  center: [center[0], center[1]] as LngLat,
                  crownRadiusM: Math.max(0.2, crownRadiusM),
                  trunkRadiusM: Math.max(0.2, trunkRadiusM),
                }
              }
            }
            if (legacyPolygon.length >= 3) {
              return createObstacleShapeForKind(kind, legacyPolygon)
            }
            return null
          })()

    if (!shape) {
      continue
    }

    sanitizedObstacles[id] = {
      id,
      kind,
      shape,
      heightAboveGroundM,
      label: typeof obstacle.label === 'string' ? obstacle.label : undefined,
    }
  }

  const obstacleIds = Object.keys(sanitizedObstacles)
  return {
    ...state,
    footprints: sanitized,
    selectedFootprintIds: state.selectedFootprintIds.filter((id) => Boolean(sanitized[id])),
    activeFootprintId:
      state.activeFootprintId && sanitized[state.activeFootprintId]
        ? state.activeFootprintId
        : (ids.at(-1) ?? null),
    obstacles: sanitizedObstacles,
    selectedObstacleIds: (state.selectedObstacleIds ?? []).filter((id) => Boolean(sanitizedObstacles[id])),
    activeObstacleId:
      state.activeObstacleId && sanitizedObstacles[state.activeObstacleId]
        ? state.activeObstacleId
        : (obstacleIds.at(-1) ?? null),
    obstacleDrawDraft: [],
    isDrawingObstacle: false,
    sunProjection: {
      enabled: state.sunProjection?.enabled ?? defaultSunProjection.enabled,
      datetimeIso: state.sunProjection?.datetimeIso ?? defaultSunProjection.datetimeIso,
      dailyDateIso: state.sunProjection?.dailyDateIso ?? defaultSunProjection.dailyDateIso,
    },
    shadingSettings: {
      enabled: state.shadingSettings?.enabled ?? defaultShadingSettings.enabled,
      gridResolutionM: Number.isFinite(state.shadingSettings?.gridResolutionM)
        ? Math.max(0.1, state.shadingSettings.gridResolutionM)
        : defaultShadingSettings.gridResolutionM,
    },
  }
}
