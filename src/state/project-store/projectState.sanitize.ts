import type {
  FootprintPolygon,
  ObstacleStateEntry,
  ProjectSunProjectionSettings,
  ShadingSettings,
} from '../../types/geometry'
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
    if (!obstacle || !Array.isArray(obstacle.polygon) || obstacle.polygon.length < 3) {
      continue
    }

    const id = typeof obstacle.id === 'string' && obstacle.id.length > 0 ? obstacle.id : obstacleId
    const kind = obstacle.kind ?? 'custom'
    const heightAboveGroundM = Number.isFinite(obstacle.heightAboveGroundM)
      ? Math.max(0, obstacle.heightAboveGroundM)
      : 0

    const polygon = obstacle.polygon.filter(
      (vertex): vertex is [number, number] =>
        Array.isArray(vertex) &&
        vertex.length === 2 &&
        Number.isFinite(vertex[0]) &&
        Number.isFinite(vertex[1]),
    )
    if (polygon.length < 3) {
      continue
    }

    sanitizedObstacles[id] = {
      id,
      kind,
      polygon,
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
