import { useCanvasModel } from '../../application/presentation/useCanvasModel'
import { useSidebarModel } from '../../application/presentation/useSidebarModel'
import { useSunCastPresentationState } from '../../application/presentation/useSunCastPresentationState'
import { useTutorialModel } from '../../application/presentation/useTutorialModel'
import type { SunCastCanvasModel, SunCastSidebarModel, SunCastTutorialModel } from './sunCastController.types'

export type { SunCastCanvasModel, SunCastSidebarModel, SunCastTutorialModel } from './sunCastController.types'

export function useSunCastController(): {
  sidebarModel: SunCastSidebarModel
  canvasModel: SunCastCanvasModel
  tutorialModel: SunCastTutorialModel
} {
  const presentationState = useSunCastPresentationState()
  const sidebarModel = useSidebarModel(presentationState)
  const canvasModel = useCanvasModel(presentationState)
  const tutorialModel = useTutorialModel(presentationState)

  return { sidebarModel, canvasModel, tutorialModel }
}
