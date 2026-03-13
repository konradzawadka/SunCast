import type { ProjectState } from '../../state/project-store/projectState.types'
import { toEditorSessionState, type EditorSessionState } from './editorSession.types'

export function editorSessionReducerState(state: ProjectState): EditorSessionState {
  return toEditorSessionState(state)
}
