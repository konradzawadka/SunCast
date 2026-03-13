import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts'
import type { ReturnTypeUseEditorSession, ReturnTypeUseProjectDocument } from './usePresentationTypes'

export function usePresentationKeyboardShortcuts(
  projectDocument: ReturnTypeUseProjectDocument,
  editorSession: ReturnTypeUseEditorSession,
): void {
  const { store } = projectDocument

  useKeyboardShortcuts({
    onSelectAllFootprints: () => {
      store.selectAllFootprints()
      editorSession.clearSelectionState()
    },
    isDrawing: store.state.isDrawing || store.state.isDrawingObstacle,
    onCancelDrawing: () => {
      if (store.state.isDrawingObstacle) {
        store.cancelObstacleDrawing()
      } else {
        store.cancelDrawing()
      }
      editorSession.clearSelectionState()
    },
  })
}
