import type { FaceConstraints, FootprintPolygon, SolvedRoofPlane } from '../../types/geometry'
import { projectPointsToLocalMeters } from '../projection/localMeters'
import { fitPlane } from './fitPlane'
import { RoofSolverError } from './errors'
import { normalizeConstraints } from './normalizeConstraints'
import { validateFootprint } from './validation'

const COLLINEARITY_AREA_EPSILON_M2 = 1e-6
const REQUIRED_CONSTRAINT_COUNT = 3

function ensureThreeNonCollinearPoints(points: Array<{ x: number; y: number }>): boolean {
  if (points.length < REQUIRED_CONSTRAINT_COUNT) {
    return false
  }

  for (let i = 0; i < points.length - 2; i += 1) {
    for (let j = i + 1; j < points.length - 1; j += 1) {
      for (let k = j + 1; k < points.length; k += 1) {
        const a = points[i]
        const b = points[j]
        const c = points[k]
        const doubleArea = Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x))
        if (doubleArea > COLLINEARITY_AREA_EPSILON_M2) {
          return true
        }
      }
    }
  }

  return false
}

export function solveRoofPlane(footprint: FootprintPolygon, constraints: FaceConstraints): SolvedRoofPlane {
  const footprintErrors = validateFootprint(footprint)
  if (footprintErrors.length > 0) {
    throw new RoofSolverError('FOOTPRINT_INVALID', footprintErrors[0])
  }

  const { points, warnings } = normalizeConstraints(footprint, constraints)
  if (points.length < REQUIRED_CONSTRAINT_COUNT) {
    throw new RoofSolverError('CONSTRAINTS_INSUFFICIENT', 'At least 3 constrained points are required')
  }
  if (points.length > REQUIRED_CONSTRAINT_COUNT) {
    throw new RoofSolverError(
      'CONSTRAINTS_OVERCONSTRAINED',
      'Plane requires exactly 3 vertex heights. Remove one constraint.',
    )
  }

  if (!ensureThreeNonCollinearPoints(points)) {
    throw new RoofSolverError(
      'CONSTRAINTS_COLLINEAR',
      'Constrained points are collinear and cannot define a roof plane',
    )
  }

  const fit = fitPlane(points)

  const { points2d } = projectPointsToLocalMeters(footprint.vertices)
  const vertexHeightsM = points2d.map((point) => fit.plane.p * point.x + fit.plane.q * point.y + fit.plane.r)

  return {
    plane: fit.plane,
    vertexHeightsM,
    usedLeastSquares: fit.usedLeastSquares,
    rmsErrorM: fit.rmsErrorM,
    warnings,
  }
}
