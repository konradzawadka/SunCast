import { useMemo } from 'react'
import type { SunCastSidebarModel } from './presentationModel.types'
import type { SunCastPresentationState } from './useSunCastPresentationState'

export function useSidebarModel(state: SunCastPresentationState): SunCastSidebarModel {
  return useMemo(() => state.sidebarModel, [state])
}
