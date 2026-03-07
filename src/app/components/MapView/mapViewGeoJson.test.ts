import { describe, expect, it } from 'vitest'
import type { FootprintPolygon, VertexHeightConstraint } from '../../../types/geometry'
import {
  buildDraftFeatures,
  syncInteractiveSources,
  toEdgeHeightLabelFeatures,
  toFootprintFeatures,
  toRing,
} from './mapViewGeoJson'

describe('mapViewGeoJson', () => {
  it('closes valid polygon rings', () => {
    const ring = toRing([
      [1, 2],
      [3, 4],
      [5, 6],
    ])

    expect(ring).toEqual([
      [1, 2],
      [3, 4],
      [5, 6],
      [1, 2],
    ])
  })

  it('filters invalid footprints when building footprint features', () => {
    const footprints: FootprintPolygon[] = [
      { id: 'valid', vertices: [[1, 1], [2, 2], [3, 1]], kwp: 1 },
      { id: 'invalid', vertices: [[1, 1], [2, 2]], kwp: 1 },
    ]

    const features = toFootprintFeatures(footprints, 'valid', new Set(['valid']))

    expect(features).toHaveLength(1)
    expect(features[0].properties).toEqual({
      footprintId: 'valid',
      active: 1,
      selected: 1,
    })
  })

  it('builds line and point features for draft geometry', () => {
    const features = buildDraftFeatures([
      [1, 1],
      [2, 2],
      [3, 3],
    ])

    expect(features).toHaveLength(4)
    expect(features[0].geometry.type).toBe('LineString')
  })

  it('returns edge labels only for edges with equal endpoint heights', () => {
    const labels = toEdgeHeightLabelFeatures(
      [
        [1, 1],
        [2, 1],
        [2, 2],
      ],
      new Map([
        [0, 1],
        [1, 1],
        [2, 4],
      ]),
    )

    expect(labels).toHaveLength(1)
    expect(labels[0].properties?.edgeHeightLabel).toBe('1.00 m')
  })

  it('clears active sources when active footprint is missing', () => {
    const calls: GeoJSON.FeatureCollection[] = []
    const source = {
      setData(data: GeoJSON.FeatureCollection) {
        calls.push(data)
      },
    }

    const map = {
      getSource(id: string) {
        if (
          id === 'footprints' ||
          id === 'active-footprint-edges' ||
          id === 'active-footprint-vertices' ||
          id === 'active-footprint-edge-labels'
        ) {
          return source
        }
        return undefined
      },
    }

    const vertexConstraints: VertexHeightConstraint[] = []
    syncInteractiveSources(map as never, {
      footprints: [{ id: 'f', vertices: [[1, 1], [2, 2], [2, 1]], kwp: 1 }],
      activeFootprint: null,
      selectedFootprintIds: [],
      vertexConstraints,
      selectedVertexIndex: null,
      selectedEdgeIndex: null,
    })

    expect(calls).toHaveLength(4)
    expect(calls.slice(1)).toEqual([
      { type: 'FeatureCollection', features: [] },
      { type: 'FeatureCollection', features: [] },
      { type: 'FeatureCollection', features: [] },
    ])
  })
})
