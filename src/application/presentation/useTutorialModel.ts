import { useMemo } from 'react'
import type { SunCastTutorialModel } from './presentationModel.types'
import type { SunCastPresentationState } from './useSunCastPresentationState'

export function useTutorialModel(state: SunCastPresentationState): SunCastTutorialModel {
  return useMemo(() => state.tutorialModel, [state])
}
