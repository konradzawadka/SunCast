import type { FaceConstraints, FootprintPolygon, ObstacleStateEntry } from '../../types/geometry'
import type { FootprintStateEntry, ProjectState } from './projectState.types'

const EMPTY_CONSTRAINTS: FaceConstraints = { vertexHeights: [] }

export function getActiveEntry(state: ProjectState): FootprintStateEntry | null {
  if (!state.activeFootprintId) {
    return null
  }
  return state.footprints[state.activeFootprintId] ?? null
}

export function getActiveFootprint(state: ProjectState): FootprintPolygon | null {
  return getActiveEntry(state)?.footprint ?? null
}

export function getActiveConstraints(state: ProjectState): FaceConstraints {
  return getActiveEntry(state)?.constraints ?? EMPTY_CONSTRAINTS
}

export function getSelectedFootprintIds(state: ProjectState): string[] {
  return state.selectedFootprintIds
}

// Purpose: Returns selected footprint entries from available inputs.
// Why: Improves readability by isolating a single responsibility behind a named function.
export function getSelectedFootprintEntries(state: ProjectState): FootprintStateEntry[] {
  return state.selectedFootprintIds
    .map((footprintId) => state.footprints[footprintId])
    .filter((entry): entry is FootprintStateEntry => Boolean(entry))
}

// Purpose: Returns shading ready footprint entries from available inputs.
// Why: Improves readability by isolating a single responsibility behind a named function.
export function getShadingReadyFootprintEntries(state: ProjectState): FootprintStateEntry[] {
  return getSelectedFootprintEntries(state).filter((entry) => entry.footprint.vertices.length >= 3)
}

export function getFootprintEntries(state: ProjectState): FootprintStateEntry[] {
  return Object.values(state.footprints)
}

export function isFootprintSelected(state: ProjectState, footprintId: string): boolean {
  return state.selectedFootprintIds.includes(footprintId)
}

// Purpose: Returns obstacle entries from available inputs.
// Why: Improves readability by isolating a single responsibility behind a named function.
export function getObstacleEntries(state: ProjectState): ObstacleStateEntry[] {
  return Object.values(state.obstacles)
}

// Purpose: Returns active obstacle from available inputs.
// Why: Improves readability by isolating a single responsibility behind a named function.
export function getActiveObstacle(state: ProjectState): ObstacleStateEntry | null {
  if (!state.activeObstacleId) {
    return null
  }
  return state.obstacles[state.activeObstacleId] ?? null
}

// Purpose: Returns selected obstacle entries from available inputs.
// Why: Improves readability by isolating a single responsibility behind a named function.
export function getSelectedObstacleEntries(state: ProjectState): ObstacleStateEntry[] {
  return state.selectedObstacleIds
    .map((obstacleId) => state.obstacles[obstacleId])
    .filter((entry): entry is ObstacleStateEntry => Boolean(entry))
}
