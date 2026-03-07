import { describe, expect, it } from 'vitest'
import type { RoofMeshData } from '../../../../types/geometry'
import { buildProjectedRoofFeatures } from './projectedRoofFeatures'

describe('buildProjectedRoofFeatures', () => {
  it('returns no features because projected debug geometry is rendered by the 3D overlay layer', () => {
    const mesh: RoofMeshData = {
      vertices: [
        { lon: -73.99, lat: 40.73, z: 2 },
        { lon: -73.98, lat: 40.73, z: 4 },
        { lon: -73.98, lat: 40.74, z: 8 },
      ],
      triangleIndices: [0, 1, 2],
    }

    const features = buildProjectedRoofFeatures([mesh], {
      projectToScreen: (vertex) => ({
        x: vertex.lon * 10_000 + vertex.heightM * 5,
        y: vertex.lat * 10_000 - vertex.heightM * 2,
      }),
      unprojectFromScreen: (point) => [point.x / 10_000, point.y / 10_000],
    })

    expect(features).toEqual([])
  })
})
