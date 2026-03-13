import { describe, expect, it } from 'vitest'
import type { ObstacleStateEntry } from '../../types/geometry'
import { buildLocalOrigin, localMetersToLonLat, lonLatToLocalMeters } from '../projection/localMeters'
import { generateObstacleMesh } from './generateObstacleMesh'

describe('generateObstacleMesh', () => {
  it('computes 1 m^3 volume for a 1m x 1m x 1m obstacle mesh', () => {
    const origin = buildLocalOrigin([[20, 52]])
    const polygon = [
      localMetersToLonLat(origin, { x: 0, y: 0 }),
      localMetersToLonLat(origin, { x: 1, y: 0 }),
      localMetersToLonLat(origin, { x: 1, y: 1 }),
      localMetersToLonLat(origin, { x: 0, y: 1 }),
    ]

    const obstacle: ObstacleStateEntry = {
      id: 'obstacle-unit-cube',
      kind: 'building',
      shape: {
        type: 'polygon-prism',
        polygon,
      },
      heightAboveGroundM: 1,
    }

    const mesh = generateObstacleMesh(obstacle)
    expect(mesh).not.toBeNull()
    if (!mesh) {
      return
    }

    const verticesLocal = mesh.vertices.map((vertex) => lonLatToLocalMeters(origin, [vertex.lon, vertex.lat]))

    let topAreaM2 = 0
    for (let i = 0; i < mesh.triangleIndices.length; i += 3) {
      const a = verticesLocal[mesh.triangleIndices[i]]
      const b = verticesLocal[mesh.triangleIndices[i + 1]]
      const c = verticesLocal[mesh.triangleIndices[i + 2]]
      topAreaM2 += Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) * 0.5
    }

    const volumeM3 = topAreaM2 * obstacle.heightAboveGroundM
    expect(volumeM3).toBeCloseTo(1, 6)
  })

  it('creates a flat mesh with one constant obstacle height', () => {
    const obstacle: ObstacleStateEntry = {
      id: 'obstacle-1',
      kind: 'building',
      shape: {
        type: 'polygon-prism',
        polygon: [
          [20.0, 52.0],
          [20.00015, 52.0],
          [20.00015, 52.00015],
          [20.0, 52.00015],
        ],
      },
      heightAboveGroundM: 8.5,
    }

    const mesh = generateObstacleMesh(obstacle)
    expect(mesh).not.toBeNull()
    if (!mesh) {
      return
    }

    expect(mesh.vertices.length).toBeGreaterThanOrEqual(3)
    expect(mesh.triangleIndices.length).toBeGreaterThanOrEqual(3)
    expect(mesh.vertices.every((vertex) => vertex.z === 8.5)).toBe(true)
  })

  it('returns null for an invalid obstacle polygon', () => {
    const obstacle: ObstacleStateEntry = {
      id: 'invalid-obstacle',
      kind: 'custom',
      shape: {
        type: 'polygon-prism',
        polygon: [
          [20.0, 52.0],
          [20.0001, 52.0001],
        ],
      },
      heightAboveGroundM: 5,
    }

    expect(generateObstacleMesh(obstacle)).toBeNull()
  })

  it('supports cylindrical visual mesh for tree obstacles', () => {
    const obstacle: ObstacleStateEntry = {
      id: 'tree-1',
      kind: 'tree',
      shape: {
        type: 'tree',
        center: [20.000015, 52.000015],
        crownRadiusM: 2,
        trunkRadiusM: 0.4,
      },
      heightAboveGroundM: 6,
    }

    const mesh = generateObstacleMesh(obstacle)
    expect(mesh).not.toBeNull()
    if (!mesh) {
      return
    }

    expect(mesh.vertices.length).toBeGreaterThan(8)
    expect(mesh.vertices.every((vertex) => vertex.z === 6)).toBe(true)
  })
})
