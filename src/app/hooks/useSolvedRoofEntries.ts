import { useMemo } from 'react'
import { generateRoofMesh } from '../../geometry/mesh/generateRoofMesh'
import { computeRoofMetrics } from '../../geometry/solver/metrics'
import { RoofSolverError } from '../../geometry/solver/errors'
import { solveRoofPlane } from '../../geometry/solver/solveRoofPlane'
import { validateFootprint } from '../../geometry/solver/validation'
import type { FaceConstraints, FootprintPolygon, RoofMeshData, SolvedRoofPlane } from '../../types/geometry'

export interface SolvedEntry {
  footprintId: string
  solution: SolvedRoofPlane
  mesh: RoofMeshData
  metrics: ReturnType<typeof computeRoofMetrics>
}

interface SolveInputEntry {
  footprint: FootprintPolygon
  constraints: FaceConstraints
}

export function useSolvedRoofEntries(footprintEntries: SolveInputEntry[], activeFootprintId: string | null) {
  return useMemo(() => {
    const solvedEntries: SolvedEntry[] = []
    let activeError: string | null = null

    for (const entry of footprintEntries) {
      const errors = validateFootprint(entry.footprint)
      if (errors.length > 0) {
        if (entry.footprint.id === activeFootprintId) {
          activeError = errors[0]
        }
        continue
      }

      try {
        const solution = solveRoofPlane(entry.footprint, entry.constraints)
        const mesh = generateRoofMesh(entry.footprint, solution.vertexHeightsM)
        const metrics = computeRoofMetrics(solution.plane, mesh)
        solvedEntries.push({
          footprintId: entry.footprint.id,
          solution,
          mesh,
          metrics,
        })
      } catch (error) {
        if (entry.footprint.id !== activeFootprintId) {
          continue
        }

        activeError =
          error instanceof RoofSolverError
            ? `${error.code}: ${error.message}`
            : error instanceof Error
              ? error.message
              : 'Failed to solve roof plane'
      }
    }

    const activeSolved = activeFootprintId ? solvedEntries.find((entry) => entry.footprintId === activeFootprintId) ?? null : null

    return {
      entries: solvedEntries,
      activeSolved,
      activeError,
    }
  }, [activeFootprintId, footprintEntries])
}
