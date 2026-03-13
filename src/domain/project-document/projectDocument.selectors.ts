import type { ProjectState } from '../../state/project-store/projectState.types'
import { toProjectDocumentState, type ProjectDocumentState } from './projectDocument.types'

export function selectProjectDocument(state: ProjectState): ProjectDocumentState {
  return toProjectDocumentState(state)
}
