import { describe, expect, it } from 'vitest'
import { generateRoofMesh } from '../mesh/generateRoofMesh'
import { computeRoofMetrics } from './metrics'
import { solveRoofPlane } from './solveRoofPlane'
import type { FaceConstraints, FootprintPolygon } from '../../types/geometry'

interface Fixture {
  footprint: FootprintPolygon
  constraints: FaceConstraints
  expectedPitchDeg: number
  expectedAzimuthDeg: number
}

const fixtures: Fixture[] = [
  {
    footprint: {
      id: 'fp-4970a26d-2359-4bdf-88f3-e092edacd500',
      vertices: [
        [20.86706318201422, 52.178940419708994],
        [20.86694669516379, 52.178794960461346],
        [20.867033866957883, 52.17876371059742],
        [20.867142496423043, 52.178913380797496],
      ],
      kwp: 1,
    },
    constraints: {
      vertexHeights: [
        { vertexIndex: 0, heightM: 9 },
        { vertexIndex: 1, heightM: 9 },
        { vertexIndex: 2, heightM: 6.5 },
        { vertexIndex: 3, heightM: 6.5 },
      ],
    },
    expectedPitchDeg: 19.9843146818,
    expectedAzimuthDeg: 116.1539226461,
  },
  {
    footprint: {
      id: 'fp-22ee1f78-565b-4d07-b3ef-170c5ca0d79c',
      vertices: [
        [20.867043254695147, 52.17892278844462],
        [20.866947718257165, 52.1787989399503],
        [20.866864887795145, 52.178817525960994],
        [20.866960106210627, 52.17893969638476],
      ],
      kwp: 1,
    },
    constraints: {
      vertexHeights: [
        { vertexIndex: 0, heightM: 10 },
        { vertexIndex: 1, heightM: 10 },
        { vertexIndex: 2, heightM: 6 },
        { vertexIndex: 3, heightM: 6 },
      ],
    },
    expectedPitchDeg: 33.7085314196,
    expectedAzimuthDeg: 295.3150771718,
  },
]

describe('roof metrics for provided real footprints', () => {
  it.each(fixtures)('computes pitch/azimuth for $footprint.id', ({ footprint, constraints, expectedPitchDeg, expectedAzimuthDeg }) => {
    const solved = solveRoofPlane(footprint, constraints)
    const mesh = generateRoofMesh(footprint, solved.vertexHeightsM)
    const metrics = computeRoofMetrics(solved.plane, mesh)

    expect(metrics.pitchDeg).toBeCloseTo(expectedPitchDeg, 6)
    expect(metrics.azimuthDeg).toBeCloseTo(expectedAzimuthDeg, 6)
  })
})
