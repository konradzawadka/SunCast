import { useMemo } from 'react'
import type { SunCastTutorialModel } from './presentationModel.types'
import type { SunCastPresentationState } from './useSunCastPresentationState'

export function useTutorialModel(state: SunCastPresentationState): SunCastTutorialModel {
  const { projectDocument, editorSession } = state
  const { store } = projectDocument

  return useMemo(
    () => ({
      mapInitialized: editorSession.mapInitialized,
      draftVertexCount: store.state.drawDraft.length,
      hasFinishedPolygon: Boolean(projectDocument.activeFootprint),
      kwp: projectDocument.activeFootprint?.kwp ?? null,
      hasEditedKwp: projectDocument.activeFootprint
        ? Boolean(editorSession.tutorialEditedKwpByFootprint[projectDocument.activeFootprint.id])
        : false,
      constrainedVertexCount: projectDocument.activeConstraints.vertexHeights.length,
      orbitEnabled: editorSession.orbitEnabled,
      hasEditedDatetime: editorSession.tutorialDatetimeEdited,
      onReady: ({ startTutorial }) => {
        editorSession.setTutorialStart(startTutorial)
      },
    }),
    [editorSession, projectDocument.activeConstraints.vertexHeights.length, projectDocument.activeFootprint, store],
  )
}
