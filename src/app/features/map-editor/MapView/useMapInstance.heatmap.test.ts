// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import type { RoofMeshData } from '../../../../types/geometry'
import type { ShadeHeatmapFeature } from '../../../hooks/useRoofShading'
import { buildHeatmapGeometry } from './useMapInstance'

vi.mock('maplibre-gl', () => ({
  default: {},
}))

const roofMesh: RoofMeshData = {
  id: 'roof-1',
  vertices: [
    { lon: 20.0, lat: 52.0, z: 3 },
    { lon: 20.0002, lat: 52.0, z: 3 },
    { lon: 20.0002, lat: 52.0002, z: 3 },
    { lon: 20.0, lat: 52.0002, z: 3 },
  ],
  triangleIndices: [0, 1, 2, 0, 2, 3],
}

const overlappingRoofA: RoofMeshData = {
  id: 'roof-a',
  vertices: [
    { lon: 20.001, lat: 52.001, z: 2 },
    { lon: 20.0012, lat: 52.001, z: 2 },
    { lon: 20.0012, lat: 52.0012, z: 2 },
    { lon: 20.001, lat: 52.0012, z: 2 },
  ],
  triangleIndices: [0, 1, 2, 0, 2, 3],
}

const overlappingRoofB: RoofMeshData = {
  id: 'roof-b',
  vertices: [
    { lon: 20.001, lat: 52.001, z: 14 },
    { lon: 20.0012, lat: 52.001, z: 14 },
    { lon: 20.0012, lat: 52.0012, z: 14 },
    { lon: 20.001, lat: 52.0012, z: 14 },
  ],
  triangleIndices: [0, 1, 2, 0, 2, 3],
}

function feature(intensity: number): ShadeHeatmapFeature {
  return {
    type: 'Feature',
    properties: {
      roofId: 'roof-1',
      shade: intensity > 0 ? 1 : 0,
      intensity,
    },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [20.00005, 52.00005],
          [20.00015, 52.00005],
          [20.00015, 52.00015],
          [20.00005, 52.00015],
          [20.00005, 52.00005],
        ],
      ],
    },
  }
}

function overlappingFeature(roofId: string): ShadeHeatmapFeature {
  return {
    type: 'Feature',
    properties: {
      roofId,
      shade: 1,
      intensity: 1,
    },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [20.00105, 52.00105],
          [20.00115, 52.00105],
          [20.00115, 52.00115],
          [20.00105, 52.00115],
          [20.00105, 52.00105],
        ],
      ],
    },
  }
}

function firstZ(result: NonNullable<ReturnType<typeof buildHeatmapGeometry>>): number {
  const position = result.geometry.getAttribute('position')
  return position.getZ(0)
}

describe('buildHeatmapGeometry', () => {
  it('does not generate geometry when all cells have zero intensity', () => {
    const result = buildHeatmapGeometry([roofMesh], [feature(0)], 1)
    expect(result).toBeNull()
  })

  it('uses roofId mapping so cell projection stays stable when roof order changes', () => {
    const cell = overlappingFeature('roof-b')

    const geometryAB = buildHeatmapGeometry([overlappingRoofA, overlappingRoofB], [cell], 1)
    const geometryBA = buildHeatmapGeometry([overlappingRoofB, overlappingRoofA], [cell], 1)

    expect(geometryAB).not.toBeNull()
    expect(geometryBA).not.toBeNull()
    expect(firstZ(geometryAB!)).toBeCloseTo(firstZ(geometryBA!), 12)
  })

  it('accepts continuous intensity values for annual simulation heatmaps', () => {
    const midIntensityCell = feature(0.37)
    const result = buildHeatmapGeometry([roofMesh], [midIntensityCell], 1)

    expect(result).not.toBeNull()
    if (!result) {
      return
    }

    const color = result.geometry.getAttribute('color')
    expect(color.count).toBeGreaterThan(0)
    expect(color.getX(0)).toBeGreaterThan(0)
    expect(color.getX(0)).toBeLessThan(1)
  })
})
