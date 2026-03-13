import type { ProjectState } from '../../state/project-store/projectState.types'
import { toProjectDocumentState, type ProjectDocumentState } from './projectDocument.types'

export function projectDocumentReducerState(state: Pick<ProjectState, 'footprints' | 'obstacles' | 'sunProjection' | 'shadingSettings'>): ProjectDocumentState {
  return toProjectDocumentState(state)
}
