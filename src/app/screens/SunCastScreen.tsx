import { useSunCastController } from '../hooks/useSunCastController'
import { SunCastCanvas } from './SunCastCanvas'
import { SunCastLayout } from './SunCastLayout'
import { SunCastSidebar } from './SunCastSidebar'
import { TutorialController } from '../features/tutorial/TutorialController'

export function SunCastScreen() {
  const { sidebarModel, canvasModel, tutorialModel } = useSunCastController()

  return (
    <SunCastLayout>
      <SunCastSidebar model={sidebarModel} />
      <SunCastCanvas model={canvasModel} />
      <TutorialController model={tutorialModel} />
    </SunCastLayout>
  )
}
