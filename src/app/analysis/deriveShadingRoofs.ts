import { useMemo } from 'react'
import type { ShadingRoofInput } from '../../geometry/shading'
import type { FootprintStateEntry } from '../../state/project-store/projectState.types'
import type { SolvedEntry } from './solvedRoof.types'

interface DeriveShadingRoofsArgs {
  selectedFootprintIds: string[]
  activeFootprintId: string | null
  footprintEntries: Record<string, FootprintStateEntry>
  solvedEntries: SolvedEntry[]
}

export function useDerivedShadingRoofs({
  selectedFootprintIds,
  activeFootprintId,
  footprintEntries,
  solvedEntries,
}: DeriveShadingRoofsArgs): ShadingRoofInput[] {
  return useMemo(() => {
    const solvedByFootprintId = new Map(solvedEntries.map((entry) => [entry.footprintId, entry]))
    const roofIdsForShading =
      selectedFootprintIds.length > 0 ? selectedFootprintIds : activeFootprintId ? [activeFootprintId] : []

    return roofIdsForShading
      .map((footprintId) => {
        const footprintEntry = footprintEntries[footprintId]
        const solvedEntry = solvedByFootprintId.get(footprintId)
        if (!footprintEntry || !solvedEntry) {
          return null
        }

        const polygon = footprintEntry.footprint.vertices
        const vertexHeightsM = solvedEntry.solution.vertexHeightsM
        if (polygon.length < 3 || polygon.length !== vertexHeightsM.length) {
          return null
        }

        return {
          roofId: footprintId,
          polygon,
          vertexHeightsM,
        }
      })
      .filter((entry): entry is ShadingRoofInput => Boolean(entry))
  }, [activeFootprintId, footprintEntries, selectedFootprintIds, solvedEntries])
}
