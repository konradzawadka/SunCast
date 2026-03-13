import { describe, expect, it } from 'vitest'
import type { RoofMeshData } from '../../../../../types/geometry'
import { buildWorldMeshGeometry } from './meshWorldGeometry'

describe('buildWorldMeshGeometry', () => {
  it('builds one stem per vertex with positive dz for positive heights', () => {
    const mesh: RoofMeshData = {
      vertices: [
        { lon: -122.421, lat: 37.772, z: 2 },
        { lon: -122.418, lat: 37.772, z: 4 },
        { lon: -122.418, lat: 37.775, z: 7.5 },
        { lon: -122.421, lat: 37.775, z: 3 },
      ],
      triangleIndices: [0, 1, 2, 0, 2, 3],
    }

    const world = buildWorldMeshGeometry(mesh)
    expect(world).not.toBeNull()
    if (!world) {
      return
    }

    expect(world.topVertices.length).toBe(mesh.vertices.length)
    expect(world.baseVertices.length).toBe(mesh.vertices.length)
    expect(Number.isFinite(world.anchorX)).toBe(true)
    expect(Number.isFinite(world.anchorY)).toBe(true)

    const span = Math.max(...mesh.vertices.map((vertex) => vertex.z)) - Math.min(...mesh.vertices.map((vertex) => vertex.z))
    expect(span).toBeGreaterThan(1)

    for (let i = 0; i < mesh.vertices.length; i += 1) {
      const dz = world.topVertices[i].z - world.baseVertices[i].z
      expect(dz).toBeGreaterThan(0)
      expect(Math.abs(world.topVertices[i].x)).toBeLessThan(0.01)
      expect(Math.abs(world.topVertices[i].y)).toBeLessThan(0.01)
    }
  })
})
