import { describe, expect, it } from 'vitest'
import { buildLocalOrigin } from '../projection/localMeters'
import { normalizeObstaclesToPrisms } from './obstacleVolumes'

function offsetLon(baseLon: number, meters: number): number {
  return baseLon + meters / 111_319.49079327358
}

function offsetLat(baseLat: number, meters: number): number {
  return baseLat + meters / 111_319.49079327358
}

describe('obstacleVolumes', () => {
  it('normalizes map obstacles to local prisms with triangles', () => {
    const base: [number, number] = [0, 0]
    const polygon: Array<[number, number]> = [
      [offsetLon(base[0], 0), offsetLat(base[1], 0)],
      [offsetLon(base[0], 2), offsetLat(base[1], 0)],
      [offsetLon(base[0], 2), offsetLat(base[1], 2)],
      [offsetLon(base[0], 0), offsetLat(base[1], 2)],
    ]
    const origin = buildLocalOrigin(polygon)

    const prisms = normalizeObstaclesToPrisms(origin, [
      {
        id: 'ob-1',
        polygon,
        heightAboveGroundM: 8,
      },
    ])

    expect(prisms).toHaveLength(1)
    expect(prisms[0].heightAboveGroundM).toBe(8)
    expect(prisms[0].triangles.length).toBeGreaterThanOrEqual(10)
    expect(prisms[0].bbox.maxX).toBeGreaterThan(prisms[0].bbox.minX)
    expect(prisms[0].bbox.maxY).toBeGreaterThan(prisms[0].bbox.minY)
  })
})
