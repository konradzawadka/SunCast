import { describe, expect, it } from 'vitest'
import type { ObstacleStateEntry } from '../../types/geometry'
import { generateObstacleMesh } from './generateObstacleMesh'

describe('generateObstacleMesh', () => {
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
