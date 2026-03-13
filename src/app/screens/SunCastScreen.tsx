import { useCanvasModel } from '../presentation/useCanvasModel'
import { useSidebarModel } from '../presentation/useSidebarModel'
import { useSunCastPresentationState } from '../presentation/useSunCastPresentationState'
import { useTutorialModel } from '../presentation/useTutorialModel'
import { SunCastCanvas } from './SunCastCanvas'
import { SunCastLayout } from './SunCastLayout'
import { SunCastSidebar } from './SunCastSidebar'
import { TutorialController } from '../features/tutorial/TutorialController'

export function SunCastScreen() {
  const presentationState = useSunCastPresentationState()
  const sidebarModel = useSidebarModel(presentationState)
  const canvasModel = useCanvasModel(presentationState)
  const tutorialModel = useTutorialModel(presentationState)

  return (
    <SunCastLayout>
      <SunCastSidebar model={sidebarModel} />
      <SunCastCanvas model={canvasModel} />
      <TutorialController model={tutorialModel} />
    </SunCastLayout>
  )
}
