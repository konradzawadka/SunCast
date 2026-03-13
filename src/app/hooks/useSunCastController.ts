import { useCanvasModel } from '../presentation/useCanvasModel'
import { useSidebarModel } from '../presentation/useSidebarModel'
import { useSunCastPresentationState } from '../presentation/useSunCastPresentationState'
import { useTutorialModel } from '../presentation/useTutorialModel'
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
