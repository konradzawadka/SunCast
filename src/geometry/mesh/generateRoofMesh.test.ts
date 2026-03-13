import { describe, expect, it } from 'vitest'
import type { FootprintPolygon } from '../../types/geometry'
import { buildLocalOrigin, localMetersToLonLat, projectPointsToLocalMeters } from '../projection/localMeters'
import { generateRoofMesh } from './generateRoofMesh'

const MIN_TRIANGLE_AREA_M2 = 1e-5

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

function edgeLengthsMeters(vertices: Array<[number, number]>): number[] {
  const { points2d } = projectPointsToLocalMeters(vertices)
  const lengths: number[] = []
  for (let i = 0; i < points2d.length; i += 1) {
    const a = points2d[i]
    const b = points2d[(i + 1) % points2d.length]
    lengths.push(Math.hypot(b.x - a.x, b.y - a.y))
  }
  return lengths
}

function triangleAreasMeters2(vertices: Array<[number, number]>, triangleIndices: number[]): number[] {
  const { points2d } = projectPointsToLocalMeters(vertices)
  const areas: number[] = []
  for (let i = 0; i < triangleIndices.length; i += 3) {
    const a = points2d[triangleIndices[i]]
    const b = points2d[triangleIndices[i + 1]]
    const c = points2d[triangleIndices[i + 2]]
    const area = Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) * 0.5
    areas.push(area)
  }
  return areas
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

  it('triangulates a 0.5m x 0.5m roof around lon/lat 20,52', () => {
    const center: [number, number] = [20, 52]
    const origin = buildLocalOrigin([center])
    const halfSizeM = 0.25
    const vertices: Array<[number, number]> = [
      localMetersToLonLat(origin, { x: -halfSizeM, y: -halfSizeM }),
      localMetersToLonLat(origin, { x: halfSizeM, y: -halfSizeM }),
      localMetersToLonLat(origin, { x: halfSizeM, y: halfSizeM }),
      localMetersToLonLat(origin, { x: -halfSizeM, y: halfSizeM }),
    ]
    const footprint: FootprintPolygon = {
      id: 'half-meter-at-20-52',
      vertices,
      kwp: 1,
    }

    const mesh = generateRoofMesh(footprint, [3, 3.1, 3.2, 3.1])
    expect(mesh.vertices).toHaveLength(4)
    expect(mesh.triangleIndices).toHaveLength(6)

    const lengths = edgeLengthsMeters(mesh.vertices.map((vertex) => [vertex.lon, vertex.lat]))
    for (const length of lengths) {
      expect(length).toBeCloseTo(0.5, 3)
    }
  })

  it('filters near-zero-area sliver triangles from earcut output', () => {
    const center: [number, number] = [20, 52]
    const origin = buildLocalOrigin([center])
    const localPolygon = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0.50001, y: 0.00001 },
      { x: 0, y: 1 },
    ]
    const vertices: Array<[number, number]> = localPolygon.map((point) => localMetersToLonLat(origin, point))
    const footprint: FootprintPolygon = {
      id: 'sliver-filter',
      vertices,
      kwp: 1,
    }

    const mesh = generateRoofMesh(footprint, [1, 1, 1, 1, 1])
    expect(mesh.triangleIndices).toHaveLength(6)

    const areas = triangleAreasMeters2(
      mesh.vertices.map((vertex) => [vertex.lon, vertex.lat]),
      mesh.triangleIndices,
    )
    for (const area of areas) {
      expect(area).toBeGreaterThanOrEqual(1e-5)
    }
  })

  it('drops triangles below minimum area threshold', () => {
    const center: [number, number] = [20, 52]
    const origin = buildLocalOrigin([center])
    const localPolygon = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0.50001, y: 0.00001 },
      { x: 0, y: 1 },
    ]
    const vertices: Array<[number, number]> = localPolygon.map((point) => localMetersToLonLat(origin, point))
    const footprint: FootprintPolygon = {
      id: 'minimum-area-filter',
      vertices,
      kwp: 1,
    }

    const mesh = generateRoofMesh(footprint, [1, 1, 1, 1, 1])
    const areas = triangleAreasMeters2(
      mesh.vertices.map((vertex) => [vertex.lon, vertex.lat]),
      mesh.triangleIndices,
    )
    expect(Math.min(...areas)).toBeGreaterThanOrEqual(MIN_TRIANGLE_AREA_M2)
  })
})
