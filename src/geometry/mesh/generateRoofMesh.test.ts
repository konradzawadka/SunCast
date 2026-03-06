import { describe, expect, it } from 'vitest'
import type { FootprintPolygon } from '../../types/geometry'
import { projectPointsToLocalMeters } from '../projection/localMeters'
import { generateRoofMesh } from './generateRoofMesh'

function pointInPolygon(point: { x: number; y: number }, polygon: Array<{ x: number; y: number }>): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const xi = polygon[i].x
    const yi = polygon[i].y
    const xj = polygon[j].x
    const yj = polygon[j].y
    const intersects =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi === 0 ? Number.EPSILON : yj - yi) + xi
    if (intersects) {
      inside = !inside
    }
  }
  return inside
}

function expectTrianglesInsideLocalFootprint(footprint: FootprintPolygon, triangleIndices: number[]) {
  const { points2d } = projectPointsToLocalMeters(footprint.vertices)
  for (let i = 0; i < triangleIndices.length; i += 3) {
    const a = points2d[triangleIndices[i]]
    const b = points2d[triangleIndices[i + 1]]
    const c = points2d[triangleIndices[i + 2]]
    const centroid = {
      x: (a.x + b.x + c.x) / 3,
      y: (a.y + b.y + c.y) / 3,
    }
    expect(pointInPolygon(centroid, points2d)).toBe(true)
  }
}

describe('generateRoofMesh', () => {
  it('removes duplicate consecutive footprint vertices before triangulation', () => {
    const footprint: FootprintPolygon = {
      id: 'dup-verts',
      vertices: [
        [-122.421, 37.772],
        [-122.418, 37.772],
        [-122.418, 37.772],
        [-122.418, 37.775],
        [-122.421, 37.775],
      ],
      kwp: 1,
    }

    const mesh = generateRoofMesh(footprint, [4, 4, 4, 4, 4])
    expect(mesh.vertices).toHaveLength(4)
    expect(mesh.triangleIndices).toHaveLength(6)
  })

  it('keeps triangulation triangles inside a concave footprint', () => {
    const footprint: FootprintPolygon = {
      id: 'concave',
      vertices: [
        [-122.421, 37.772],
        [-122.4175, 37.772],
        [-122.4175, 37.7735],
        [-122.419, 37.7735],
        [-122.419, 37.775],
        [-122.421, 37.775],
      ],
      kwp: 1,
    }

    const mesh = generateRoofMesh(footprint, [3, 3, 3, 3, 3, 3])
    expect(mesh.triangleIndices.length).toBeGreaterThan(0)
    expectTrianglesInsideLocalFootprint(footprint, mesh.triangleIndices)
  })

  it('keeps triangulation triangles inside a thin near-collinear footprint', () => {
    const footprint: FootprintPolygon = {
      id: 'thin',
      vertices: [
        [-122.421, 37.772],
        [-122.4165, 37.7720005],
        [-122.4164, 37.7724],
        [-122.4208, 37.77235],
      ],
      kwp: 1,
    }

    const mesh = generateRoofMesh(footprint, [2, 2.2, 2.1, 2])
    expectTrianglesInsideLocalFootprint(footprint, mesh.triangleIndices)
  })
})
