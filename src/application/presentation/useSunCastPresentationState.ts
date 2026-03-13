import { useSunCastController } from '../../app/hooks/useSunCastController'

export type SunCastPresentationState = ReturnType<typeof useSunCastController>

export function useSunCastPresentationState(): SunCastPresentationState {
  return useSunCastController()
}
