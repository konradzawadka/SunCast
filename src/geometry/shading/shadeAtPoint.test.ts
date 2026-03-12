import { describe, expect, it } from 'vitest'
import { createPrismTriangles } from './obstacleVolumes'
import { isPointShaded } from './shadeAtPoint'

describe('shadeAtPoint', () => {
  it('marks sample as shaded when prism intersects sun ray', () => {
    const polygonLocal = [
      { x: 2, y: -0.5 },
      { x: 3, y: -0.5 },
      { x: 3, y: 0.5 },
      { x: 2, y: 0.5 },
    ]

    const shaded = isPointShaded({
      sample: { x: 0, y: 0, z: 1 },
      sunDirection: { x: 1, y: 0, z: 0.2 },
      maxShadowDistanceM: 20,
      obstacles: [
        {
          id: 'ob',
          heightAboveGroundM: 8,
          polygonLocal,
          bbox: { minX: 2, minY: -0.5, maxX: 3, maxY: 0.5 },
          triangles: createPrismTriangles(polygonLocal, 8),
        },
      ],
    })

    expect(shaded).toBe(true)
  })

  it('marks sample as lit when no obstacle intersects ray', () => {
    const polygonLocal = [
      { x: -3, y: -0.5 },
      { x: -2, y: -0.5 },
      { x: -2, y: 0.5 },
      { x: -3, y: 0.5 },
    ]

    const shaded = isPointShaded({
      sample: { x: 0, y: 0, z: 1 },
      sunDirection: { x: 1, y: 0, z: 0.2 },
      maxShadowDistanceM: 20,
      obstacles: [
        {
          id: 'ob',
          heightAboveGroundM: 8,
          polygonLocal,
          bbox: { minX: -3, minY: -0.5, maxX: -2, maxY: 0.5 },
          triangles: createPrismTriangles(polygonLocal, 8),
        },
      ],
    })

    expect(shaded).toBe(false)
  })
})
