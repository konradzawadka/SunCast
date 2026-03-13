import { describe, expect, it } from 'vitest'
import { createPrismTriangles } from './obstacleVolumes'
import { intersectRayPrism } from './rayCasting'

describe('rayCasting', () => {
  it('intersects prism when ray passes through side face', () => {
    const polygonLocal = [
      { x: 2, y: -0.5 },
      { x: 3, y: -0.5 },
      { x: 3, y: 0.5 },
      { x: 2, y: 0.5 },
    ]

    const distance = intersectRayPrism(
      { x: 0, y: 0, z: 1 },
      { x: 1, y: 0, z: 0 },
      {
        id: 'ob',
        heightAboveGroundM: 2,
        polygonLocal,
        bbox: { minX: 2, minY: -0.5, maxX: 3, maxY: 0.5 },
        triangles: createPrismTriangles(polygonLocal, 2),
      },
      100,
    )

    expect(distance).not.toBeNull()
    expect(distance ?? 0).toBeCloseTo(2, 6)
  })

  it('returns null when ray is above obstacle', () => {
    const polygonLocal = [
      { x: 2, y: -0.5 },
      { x: 3, y: -0.5 },
      { x: 3, y: 0.5 },
      { x: 2, y: 0.5 },
    ]

    const distance = intersectRayPrism(
      { x: 0, y: 0, z: 3 },
      { x: 1, y: 0, z: 0 },
      {
        id: 'ob',
        heightAboveGroundM: 2,
        polygonLocal,
        bbox: { minX: 2, minY: -0.5, maxX: 3, maxY: 0.5 },
        triangles: createPrismTriangles(polygonLocal, 2),
      },
      100,
    )

    expect(distance).toBeNull()
  })
})
