import { describe, expect, it } from 'vitest'
import { buildRoofSurfaceFromLocalVertices, pointInPolygon, sampleRoofGrid } from './roofSampling'

describe('roofSampling', () => {
  it('samples only points inside roof polygon and computes z from plane', () => {
    const polygonLocal = [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 2 },
      { x: 0, y: 2 },
    ]

    const surface = buildRoofSurfaceFromLocalVertices(
      'roof-1',
      polygonLocal,
      polygonLocal.map((point) => point.x + 2 * point.y + 1),
    )

    const samples = sampleRoofGrid(surface, 1)
    expect(samples).toHaveLength(4)
    for (const sample of samples) {
      expect(sample.z).toBeCloseTo(sample.x + 2 * sample.y + 1, 8)
    }
  })

  it('pointInPolygon returns false outside polygon', () => {
    const polygon = [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 2 },
      { x: 0, y: 2 },
    ]

    expect(pointInPolygon({ x: 1, y: 1 }, polygon)).toBe(true)
    expect(pointInPolygon({ x: 3, y: 1 }, polygon)).toBe(false)
  })
})
