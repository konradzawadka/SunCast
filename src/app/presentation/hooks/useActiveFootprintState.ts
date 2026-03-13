import { validateFootprint } from '../../../geometry/solver/validation'
import { clampPitchAdjustmentPercent, computeFootprintCentroid } from '../presentationModel.types'
import type { ReturnTypeUseAnalysis, ReturnTypeUseProjectDocument } from './usePresentationTypes'

export interface ActiveFootprintState {
  activeFootprintErrors: string[]
  activeFootprintCentroid: [number, number] | null
  activePitchAdjustmentPercent: number
  adjustedPitchDeg: number | null
}

export function useActiveFootprintState(
  projectDocument: ReturnTypeUseProjectDocument,
  analysis: ReturnTypeUseAnalysis,
): ActiveFootprintState {
  const { store, activeFootprint } = projectDocument

  const activeFootprintErrors = validateFootprint(activeFootprint)
  const activeFootprintCentroid = computeFootprintCentroid(activeFootprint?.vertices ?? [])
  const activePitchAdjustmentPercent = activeFootprint
    ? clampPitchAdjustmentPercent(store.state.footprints[activeFootprint.id]?.pitchAdjustmentPercent ?? 0)
    : 0
  const adjustedPitchDeg =
    analysis.solvedMetrics.basePitchDeg === null
      ? null
      : analysis.solvedMetrics.basePitchDeg * (1 + activePitchAdjustmentPercent / 100)

  return {
    activeFootprintErrors,
    activeFootprintCentroid,
    activePitchAdjustmentPercent,
    adjustedPitchDeg,
  }
}
