import { describe, expect, it } from 'vitest'
import type { FaceConstraints, FootprintPolygon } from '../../types/geometry'
import { solveRoofPlane } from './solveRoofPlane'

describe('solveRoofPlane', () => {
  it('accepts more than three constraints and ignores extras after selecting 3 non-collinear points', () => {
    const footprint: FootprintPolygon = {
      id: 'lsq',
      vertices: [
        [-122.421, 37.772],
        [-122.418, 37.772],
        [-122.418, 37.775],
        [-122.421, 37.775],
      ],
      kwp: 1,
    }
    const constraints: FaceConstraints = {
      vertexHeights: [
        { vertexIndex: 0, heightM: 2 },
        { vertexIndex: 1, heightM: 2 },
        { vertexIndex: 2, heightM: 5 },
        { vertexIndex: 3, heightM: 5.2 },
      ],
    }

    const solved = solveRoofPlane(footprint, constraints)
    expect(solved.usedLeastSquares).toBe(false)
    expect(solved.vertexHeightsM).toHaveLength(4)
    expect(solved.warnings.some((warning) => warning.code === 'CONSTRAINTS_OVERDETERMINED')).toBe(true)
  })

  it('keeps exact fit without least-squares for exactly three constraints', () => {
    const footprint: FootprintPolygon = {
      id: 'exact',
      vertices: [
        [-122.421, 37.772],
        [-122.418, 37.772],
        [-122.419, 37.775],
      ],
      kwp: 1,
    }
    const constraints: FaceConstraints = {
      vertexHeights: [
        { vertexIndex: 0, heightM: 1 },
        { vertexIndex: 1, heightM: 3 },
        { vertexIndex: 2, heightM: 6 },
      ],
    }

    const solved = solveRoofPlane(footprint, constraints)
    expect(solved.usedLeastSquares).toBe(false)
    expect(solved.rmsErrorM).toBeCloseTo(0, 8)
    expect(solved.warnings.some((warning) => warning.code === 'CONSTRAINTS_OVERDETERMINED')).toBe(false)
  })
})
