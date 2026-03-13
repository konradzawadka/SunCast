import { useMemo } from 'react'
import type { SunCastCanvasModel } from './presentationModel.types'
import type { SunCastPresentationState } from './useSunCastPresentationState'

export function useCanvasModel(state: SunCastPresentationState): SunCastCanvasModel {
  return useMemo(() => state.canvasModel, [state])
}
