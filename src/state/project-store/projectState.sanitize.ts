import type { FootprintPolygon, ProjectSunProjectionSettings, VertexHeightConstraint } from '../../types/geometry'
import type { FootprintStateEntry, ProjectState } from './projectState.types'

function sanitizeVertexHeights(vertexHeights: VertexHeightConstraint[], vertexCount: number): VertexHeightConstraint[] {
  const byIndex = new Map<number, number>()
  for (const constraint of vertexHeights) {
    if (constraint.vertexIndex < 0 || constraint.vertexIndex >= vertexCount) {
      continue
    }
    byIndex.set(constraint.vertexIndex, constraint.heightM)
  }

  return Array.from(byIndex.entries())
    .map(([vertexIndex, heightM]) => ({ vertexIndex, heightM }))
    .sort((a, b) => a.vertexIndex - b.vertexIndex)
}

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
