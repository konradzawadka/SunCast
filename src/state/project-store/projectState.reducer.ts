import type { ProjectSunProjectionSettings, ShadingSettings } from '../../types/geometry'
import { validateLoadedState } from './projectState.sanitize'
import type { Action, ProjectState } from './projectState.types'
import {
  DEFAULT_FOOTPRINT_KWP,
  projectDocumentReducer,
} from '../../domain/project-document/projectDocument.reducer'
import { editorSessionReducer } from '../../application/editor-session/editorSession.reducer'

export { DEFAULT_FOOTPRINT_KWP }

export const DEFAULT_SUN_PROJECTION: ProjectSunProjectionSettings = {
  enabled: true,
  datetimeIso: null,
  dailyDateIso: null,
}

export const DEFAULT_SHADING_SETTINGS: ShadingSettings = {
  enabled: true,
  gridResolutionM: 0.1,
}

export const initialProjectState: ProjectState = {
  footprints: {},
  activeFootprintId: null,
  selectedFootprintIds: [],
  drawDraft: [],
  isDrawing: false,
  obstacles: {},
  activeObstacleId: null,
  selectedObstacleIds: [],
  obstacleDrawDraft: [],
  isDrawingObstacle: false,
  sunProjection: DEFAULT_SUN_PROJECTION,
  shadingSettings: DEFAULT_SHADING_SETTINGS,
}

export function projectStateReducer(state: ProjectState, action: Action): ProjectState {
  if (action.type === 'LOAD') {
    return validateLoadedState(action.payload, DEFAULT_SUN_PROJECTION, DEFAULT_FOOTPRINT_KWP, DEFAULT_SHADING_SETTINGS)
  }

  const withDocument = projectDocumentReducer(state, action)
  const withSession = editorSessionReducer(withDocument, action)

  if (action.type === 'RESET_STATE') {
    return {
      ...initialProjectState,
      sunProjection: { ...DEFAULT_SUN_PROJECTION },
      shadingSettings: { ...DEFAULT_SHADING_SETTINGS },
    }
  }

  return withSession
}
