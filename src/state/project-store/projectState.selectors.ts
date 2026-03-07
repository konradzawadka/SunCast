import type { FaceConstraints, FootprintPolygon } from '../../types/geometry'
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

export function getFootprintEntries(state: ProjectState): FootprintStateEntry[] {
  return Object.values(state.footprints)
}

export function isFootprintSelected(state: ProjectState, footprintId: string): boolean {
  return state.selectedFootprintIds.includes(footprintId)
}
