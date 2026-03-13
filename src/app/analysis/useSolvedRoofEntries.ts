import { useMemo } from 'react'
import { generateRoofMesh } from '../../geometry/mesh/generateRoofMesh'
import { computeRoofMetrics } from '../../geometry/solver/metrics'
import { RoofSolverError } from '../../geometry/solver/errors'
import { solveRoofPlane } from '../../geometry/solver/solveRoofPlane'
import { validateFootprint } from '../../geometry/solver/validation'
import type { FaceConstraints, FootprintPolygon, RoofMeshData, RoofMetrics, SolvedRoofPlane } from '../../types/geometry'
import type { SolvedEntry } from './solvedRoof.types'

interface SolveInputEntry {
  footprint: FootprintPolygon
  constraints: FaceConstraints
}

interface CachedSolveResult {
  solution: SolvedRoofPlane
  mesh: RoofMeshData
  metrics: RoofMetrics
}

const SOLVED_FOOTPRINT_CACHE_LIMIT = 500
const solvedFootprintCache = new Map<string, CachedSolveResult>()

function fingerprintSolveInput(entry: SolveInputEntry): string {
  const vertices = entry.footprint.vertices
    .map((vertex) => `${vertex[0].toFixed(8)},${vertex[1].toFixed(8)}`)
    .join(';')

  const vertexHeights = [...entry.constraints.vertexHeights]
    .sort((a, b) => a.vertexIndex - b.vertexIndex)
    .map((constraint) => `${constraint.vertexIndex}:${constraint.heightM.toFixed(6)}`)
    .join(';')

  const edgeHeights = [...(entry.constraints.edgeHeights ?? [])]
    .sort((a, b) => a.edgeIndex - b.edgeIndex)
    .map((constraint) => `${constraint.edgeIndex}:${constraint.heightM.toFixed(6)}`)
    .join(';')

  return `${entry.footprint.id}|${vertices}|v:${vertexHeights}|e:${edgeHeights}`
}

function cacheSolvedResult(fingerprint: string, result: CachedSolveResult): void {
  solvedFootprintCache.set(fingerprint, result)
  if (solvedFootprintCache.size <= SOLVED_FOOTPRINT_CACHE_LIMIT) {
    return
  }

  const oldestKey = solvedFootprintCache.keys().next().value
  if (typeof oldestKey === 'string') {
    solvedFootprintCache.delete(oldestKey)
  }
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

      const solveFingerprint = fingerprintSolveInput(entry)
      const cached = solvedFootprintCache.get(solveFingerprint)
      if (cached) {
        solvedEntries.push({
          footprintId: entry.footprint.id,
          solution: cached.solution,
          mesh: cached.mesh,
          metrics: cached.metrics,
        })
        continue
      }

      try {
        const solution = solveRoofPlane(entry.footprint, entry.constraints)
        const mesh = generateRoofMesh(entry.footprint, solution.vertexHeightsM)
        const metrics = computeRoofMetrics(solution.plane, mesh)

        const cachedResult: CachedSolveResult = {
          solution,
          mesh,
          metrics,
        }
        cacheSolvedResult(solveFingerprint, cachedResult)

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
