import type { FaceConstraints, FootprintPolygon, SolverWarning } from '../../types/geometry'
import { projectPointsToLocalMeters } from '../projection/localMeters'

export interface NormalizedConstraintPoint {
  vertexIndex: number
  x: number
  y: number
  z: number
}

function toVertexKey(vertexIndex: number): string {
  return String(vertexIndex)
}

function ensureValidVertexIndex(vertexIndex: number, vertexCount: number): boolean {
  return vertexIndex >= 0 && vertexIndex < vertexCount
}

export function normalizeConstraints(
  footprint: FootprintPolygon,
  constraints: FaceConstraints,
): { points: NormalizedConstraintPoint[]; warnings: SolverWarning[] } {
  const { points2d } = projectPointsToLocalMeters(footprint.vertices)
  const vertexCount = points2d.length
  const warnings: SolverWarning[] = []
  const heightsByVertex = new Map<string, number>()

  const pushVertexHeight = (vertexIndex: number, heightM: number) => {
    const key = toVertexKey(vertexIndex)
    heightsByVertex.set(key, heightM)
  }

  for (const vertexConstraint of constraints.vertexHeights) {
    if (!ensureValidVertexIndex(vertexConstraint.vertexIndex, vertexCount)) {
      warnings.push({
        code: 'CONSTRAINT_INDEX_INVALID',
        message: `Ignored invalid vertex constraint index: ${vertexConstraint.vertexIndex}`,
      })
      continue
    }
    pushVertexHeight(vertexConstraint.vertexIndex, vertexConstraint.heightM)
  }

  const points: NormalizedConstraintPoint[] = []
  for (const [key, heightM] of heightsByVertex.entries()) {
    const vertexIndex = Number(key)
    const point = points2d[vertexIndex]
    points.push({
      vertexIndex,
      x: point.x,
      y: point.y,
      z: heightM,
    })
  }

  points.sort((a, b) => a.vertexIndex - b.vertexIndex)
  return { points, warnings }
}
