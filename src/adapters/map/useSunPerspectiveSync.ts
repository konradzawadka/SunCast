import { useEffect } from 'react'

interface SunPerspectivePose {
  bearingDeg: number
  pitchDeg: number
}

interface UseSunPerspectiveSyncArgs {
  enabled: boolean
  pose: SunPerspectivePose | null
  setOrbitCameraPose: (bearingDeg: number, pitchDeg: number) => void
}

export function useSunPerspectiveSync({ enabled, pose, setOrbitCameraPose }: UseSunPerspectiveSyncArgs): void {
  useEffect(() => {
    if (!enabled || !pose) {
      return
    }
    setOrbitCameraPose(pose.bearingDeg, pose.pitchDeg)
  }, [enabled, pose, setOrbitCameraPose])
}
