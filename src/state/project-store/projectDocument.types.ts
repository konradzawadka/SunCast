import type { ObstacleStateEntry, ProjectSunProjectionSettings, ShadingSettings } from '../../types/geometry'
import type { FootprintStateEntry, ProjectState } from './projectState.types'

// Canonical persisted project inputs only.
export interface ProjectDocumentState {
  footprints: Record<string, FootprintStateEntry>
  obstacles: Record<string, ObstacleStateEntry>
  sunProjection: ProjectSunProjectionSettings
  shadingSettings: ShadingSettings
}

export function toProjectDocumentState(state: Pick<ProjectState, 'footprints' | 'obstacles' | 'sunProjection' | 'shadingSettings'>): ProjectDocumentState {
  return {
    footprints: state.footprints,
    obstacles: state.obstacles,
    sunProjection: state.sunProjection,
    shadingSettings: state.shadingSettings,
  }
}
