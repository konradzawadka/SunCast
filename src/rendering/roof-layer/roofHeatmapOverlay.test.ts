import { describe, expect, it } from 'vitest'
import type { RoofMeshData, RoofShadeHeatmapFeature } from '../../types/geometry'
import { buildRoofHeatmapOverlayGeometry } from './roofHeatmapOverlay'

const baseRoofMesh: RoofMeshData = {
  vertices: [
    { lon: 20.0, lat: 52.0, z: 4 },
    { lon: 20.0002, lat: 52.0, z: 4.5 },
    { lon: 20.0002, lat: 52.0002, z: 5.2 },
    { lon: 20.0, lat: 52.0002, z: 4.8 },
  ],
  triangleIndices: [0, 1, 2, 0, 2, 3],
}

function createFeature(ring: number[][], intensity: number): RoofShadeHeatmapFeature {
  return {
    type: 'Feature',
    properties: {
      roofId: 'roof-a',
      shade: intensity > 0 ? 1 : 0,
      intensity,
    },
    geometry: {
      type: 'Polygon',
      coordinates: [ring],
    },
  }
}

describe('buildRoofHeatmapOverlayGeometry', () => {
  it('projects shaded cells onto roof top geometry (non-ground z)', () => {
    const overlay = buildRoofHeatmapOverlayGeometry(
      [baseRoofMesh],
      [
        createFeature(
          [
            [20.00005, 52.00005],
            [20.00015, 52.00005],
            [20.00015, 52.00015],
            [20.00005, 52.00015],
            [20.00005, 52.00005],
          ],
          1,
        ),
      ],
      1,
    )

    expect(overlay).not.toBeNull()
    if (!overlay) {
      return
    }

    expect(overlay.indices.length).toBeGreaterThanOrEqual(3)
    expect(overlay.positions.length).toBeGreaterThanOrEqual(9)
    for (let i = 2; i < overlay.positions.length; i += 3) {
      expect(overlay.positions[i]).toBeGreaterThan(0)
    }
  })

  it('skips cells outside all roof meshes', () => {
    const overlay = buildRoofHeatmapOverlayGeometry(
      [baseRoofMesh],
      [
        createFeature(
          [
            [21.0, 53.0],
            [21.0001, 53.0],
            [21.0001, 53.0001],
            [21.0, 53.0001],
            [21.0, 53.0],
          ],
          1,
        ),
      ],
      1,
    )

    expect(overlay).toBeNull()
  })

  it('uses roofId mapping so overlay does not depend on mesh order', () => {
    const roofA: RoofMeshData = {
      id: 'roof-a',
      vertices: [
        { lon: 20.0, lat: 52.0, z: 2 },
        { lon: 20.0002, lat: 52.0, z: 2 },
        { lon: 20.0002, lat: 52.0002, z: 2 },
        { lon: 20.0, lat: 52.0002, z: 2 },
      ],
      triangleIndices: [0, 1, 2, 0, 2, 3],
    }
    const roofB: RoofMeshData = {
      id: 'roof-b',
      vertices: [
        { lon: 20.0, lat: 52.0, z: 12 },
        { lon: 20.0002, lat: 52.0, z: 12 },
        { lon: 20.0002, lat: 52.0002, z: 12 },
        { lon: 20.0, lat: 52.0002, z: 12 },
      ],
      triangleIndices: [0, 1, 2, 0, 2, 3],
    }
    const cell = createFeature(
      [
        [20.00005, 52.00005],
        [20.00015, 52.00005],
        [20.00015, 52.00015],
        [20.00005, 52.00015],
        [20.00005, 52.00005],
      ],
      1,
    )
    cell.properties.roofId = 'roof-b'

    const overlayAB = buildRoofHeatmapOverlayGeometry([roofA, roofB], [cell], 1)
    const overlayBA = buildRoofHeatmapOverlayGeometry([roofB, roofA], [cell], 1)

    expect(overlayAB).not.toBeNull()
    expect(overlayBA).not.toBeNull()
    if (!overlayAB || !overlayBA) {
      return
    }

    expect(Array.from(overlayAB.indices)).toEqual(Array.from(overlayBA.indices))
    expect(Array.from(overlayAB.positions)).toEqual(Array.from(overlayBA.positions))
  })
})
