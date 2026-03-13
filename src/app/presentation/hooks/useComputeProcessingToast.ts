import { useEffect } from 'react'
import { startGlobalProcessingToast, stopGlobalProcessingToast } from '../../../shared/errors'

const COMPUTE_PROCESSING_SOURCE = 'controller.compute'

export function useComputeProcessingToast(active: boolean): void {
  useEffect(() => {
    if (active) {
      startGlobalProcessingToast(COMPUTE_PROCESSING_SOURCE, 'Processing geometry...')
    } else {
      stopGlobalProcessingToast(COMPUTE_PROCESSING_SOURCE)
    }
    return () => stopGlobalProcessingToast(COMPUTE_PROCESSING_SOURCE)
  }, [active])
}
