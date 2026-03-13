import { useEffect } from 'react'
import { reportAppSuccess } from '../../../shared/errors'
import {
  GLOBAL_ERROR_TOAST_ACTION_EVENT_NAME,
  type GlobalErrorToastActionEventDetail,
} from '../../components/globalErrorToastActions'
import { runResetProjectFlow } from '../../../application/services/projectRecovery'
import type { ReturnTypeUseAnalysis, ReturnTypeUseEditorSession, ReturnTypeUseProjectDocument } from './usePresentationTypes'

interface UseGlobalToastActionsArgs {
  projectDocument: ReturnTypeUseProjectDocument
  editorSession: ReturnTypeUseEditorSession
  analysis: ReturnTypeUseAnalysis
  onShareProject: () => Promise<void>
}

export function useGlobalToastActions({
  projectDocument,
  editorSession,
  analysis,
  onShareProject,
}: UseGlobalToastActionsArgs): void {
  const { store } = projectDocument

  useEffect(() => {
    const onGlobalErrorToastAction = (rawEvent: Event) => {
      const event = rawEvent as CustomEvent<GlobalErrorToastActionEventDetail>
      if (!event.detail || typeof event.detail.action !== 'string') {
        return
      }

      if (event.detail.action === 'share-state') {
        void onShareProject()
        return
      }

      if (event.detail.action === 'reset-state') {
        runResetProjectFlow({
          resetState: store.resetState,
          clearSelectionState: editorSession.clearSelectionState,
          setRequestedHeatmapMode: analysis.setRequestedHeatmapMode,
          onSuccess: () => {
            reportAppSuccess('Project state reset to defaults.', {
              area: 'global-error-toast',
              source: 'reset-state',
            })
          },
        })
      }
    }

    window.addEventListener(GLOBAL_ERROR_TOAST_ACTION_EVENT_NAME, onGlobalErrorToastAction)
    return () => window.removeEventListener(GLOBAL_ERROR_TOAST_ACTION_EVENT_NAME, onGlobalErrorToastAction)
  }, [analysis.setRequestedHeatmapMode, editorSession.clearSelectionState, onShareProject, store.resetState])
}
