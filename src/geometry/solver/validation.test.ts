import { describe, expect, it } from 'vitest'
import type { FootprintPolygon } from '../../types/geometry'
import { validateFootprint } from './validation'

const ORIGIN_LON = -122.42
const ORIGIN_LAT = 37.77

function atGrid(x: number, y: number): [number, number] {
  return [ORIGIN_LON + x * 1e-4, ORIGIN_LAT + y * 1e-4]
}

function footprint(id: string, vertices: Array<[number, number]>): FootprintPolygon {
  return {
    id,
    vertices,
    kwp: 1,
  }
}

describe('validateFootprint', () => {
  it('returns no errors when footprint is not provided', () => {
    expect(validateFootprint(null)).toEqual([])
  })

  it('rejects polygons with fewer than 3 vertices', () => {
    const roof = footprint('line-segment', [atGrid(0, 0), atGrid(2, 0)])

    expect(validateFootprint(roof)).toEqual(['Roof polygon must have at least 3 vertices'])
  })

  it('rejects polygons that do not contain 3 distinct vertices', () => {
    const repeatedCorner = atGrid(0, 0)
    const roof = footprint('repeated-point', [repeatedCorner, repeatedCorner, repeatedCorner])

    expect(validateFootprint(roof)).toEqual(['Roof polygon must have at least 3 distinct vertices'])
  })

  it('rejects polygons with a sub-5mm edge in local meters', () => {
    const roof = footprint('tiny-edge', [
      [ORIGIN_LON, ORIGIN_LAT],
      [ORIGIN_LON + 5e-8, ORIGIN_LAT],
      [ORIGIN_LON + 1e-4, ORIGIN_LAT + 1e-4],
    ])

    expect(validateFootprint(roof)).toEqual(['Roof polygon edges must be longer than 0.005 m'])
  })

  it('accepts a realistic non-self-intersecting building footprint', () => {
    const roof = footprint('city-block-lot', [atGrid(0, 0), atGrid(4, 0), atGrid(5, 2), atGrid(3, 4), atGrid(0, 3)])

    expect(validateFootprint(roof)).toEqual([])
  })

  it('rejects bow-tie footprints with crossing edges', () => {
    const roof = footprint('bow-tie', [atGrid(0, 0), atGrid(4, 4), atGrid(0, 4), atGrid(4, 0)])

    expect(validateFootprint(roof)).toEqual(['Roof polygon cannot self-intersect'])
  })

  it('rejects non-adjacent edges when the second segment start touches the first segment', () => {
    const roof = footprint('d1-collinear-touch', [atGrid(0, 0), atGrid(4, 0), atGrid(2, 0), atGrid(2, 2)])

    expect(validateFootprint(roof)).toEqual(['Roof polygon cannot self-intersect'])
  })

  it('rejects non-adjacent edges when the second segment end touches the first segment', () => {
    const roof = footprint('d2-collinear-touch', [atGrid(0, 0), atGrid(4, 0), atGrid(2, 2), atGrid(2, 0)])

    expect(validateFootprint(roof)).toEqual(['Roof polygon cannot self-intersect'])
  })

  it('rejects non-adjacent edges when the first segment start lies on the second segment', () => {
    const roof = footprint('d3-collinear-touch', [atGrid(2, 0), atGrid(4, 0), atGrid(2, -1), atGrid(2, 1)])

    expect(validateFootprint(roof)).toEqual(['Roof polygon cannot self-intersect'])
  })

  it('rejects non-adjacent edges when the first segment end lies on the second segment', () => {
    const roof = footprint('d4-collinear-touch', [atGrid(0, 0), atGrid(2, 0), atGrid(2, -1), atGrid(2, 1)])

    expect(validateFootprint(roof)).toEqual(['Roof polygon cannot self-intersect'])
  })
})
