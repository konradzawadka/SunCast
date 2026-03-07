import type { FootprintPolygon, ProjectSunProjectionSettings } from '../../types/geometry'
import { sanitizeVertexHeights } from './projectState.constraints'
import type { FootprintStateEntry, ProjectState } from './projectState.types'

export function sanitizeLoadedState(
  state: ProjectState,
  defaultSunProjection: ProjectSunProjectionSettings,
  defaultFootprintKwp: number,
): ProjectState {
  const sanitized: Record<string, FootprintStateEntry> = {}

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
    }
  }

  const ids = Object.keys(sanitized)
  return {
    ...state,
    footprints: sanitized,
    selectedFootprintIds: state.selectedFootprintIds.filter((id) => Boolean(sanitized[id])),
    activeFootprintId:
      state.activeFootprintId && sanitized[state.activeFootprintId]
        ? state.activeFootprintId
        : (ids.at(-1) ?? null),
    sunProjection: {
      enabled: state.sunProjection?.enabled ?? defaultSunProjection.enabled,
      datetimeIso: state.sunProjection?.datetimeIso ?? defaultSunProjection.datetimeIso,
      dailyDateIso: state.sunProjection?.dailyDateIso ?? defaultSunProjection.dailyDateIso,
    },
  }
}
