import type maplibregl from 'maplibre-gl'
import {
  ACTIVE_OBSTACLE_VERTICES_SOURCE_ID,
  ACTIVE_EDGE_LABELS_SOURCE_ID,
  ACTIVE_EDGES_SOURCE_ID,
  ACTIVE_VERTICES_SOURCE_ID,
  DRAFT_SOURCE_ID,
  EDGE_HIT_LAYER_ID,
  FOOTPRINT_HIT_LAYER_ID,
  FOOTPRINTS_SOURCE_ID,
  OBSTACLES_SOURCE_ID,
  OBSTACLE_HIT_LAYER_ID,
  OBSTACLE_VERTEX_HIT_LAYER_ID,
  SATELLITE_TILES,
  VERTEX_HIT_LAYER_ID,
} from './mapViewConstants'

export function createMapStyle(): maplibregl.StyleSpecification {
  return {
    version: 8,
    sources: {
      satellite: {
        type: 'raster',
        tiles: [SATELLITE_TILES],
        tileSize: 256,
        attribution: 'Esri, Maxar, Earthstar Geographics, and the GIS User Community',
      },
      [FOOTPRINTS_SOURCE_ID]: {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      },
      [OBSTACLES_SOURCE_ID]: {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      },
      [ACTIVE_EDGES_SOURCE_ID]: {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      },
      [ACTIVE_VERTICES_SOURCE_ID]: {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      },
      [ACTIVE_EDGE_LABELS_SOURCE_ID]: {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      },
      [ACTIVE_OBSTACLE_VERTICES_SOURCE_ID]: {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      },
      [DRAFT_SOURCE_ID]: {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      },
    },
    layers: [
      { id: 'satellite', type: 'raster', source: 'satellite' },
      {
        id: 'footprints-fill',
        type: 'fill',
        source: FOOTPRINTS_SOURCE_ID,
        paint: {
          'fill-color': ['case', ['==', ['get', 'active'], 1], '#e5b422', '#7ca5ff'],
          'fill-opacity': ['case', ['==', ['get', 'selected'], 1], 0.3, 0.12],
        },
      },
      {
        id: 'footprints-line',
        type: 'line',
        source: FOOTPRINTS_SOURCE_ID,
        paint: {
          'line-color': ['case', ['==', ['get', 'active'], 1], '#f7cc52', ['==', ['get', 'selected'], 1], '#8fe287', '#93b4ff'],
          'line-width': ['case', ['==', ['get', 'selected'], 1], 2.8, 1.5],
        },
      },
      {
        id: FOOTPRINT_HIT_LAYER_ID,
        type: 'fill',
        source: FOOTPRINTS_SOURCE_ID,
        paint: {
          'fill-color': '#000000',
          'fill-opacity': 0,
        },
      },
      {
        id: 'obstacles-fill',
        type: 'fill',
        source: OBSTACLES_SOURCE_ID,
        paint: {
          'fill-color': ['case', ['==', ['get', 'active'], 1], '#9ca3af', '#6b7280'],
          'fill-opacity': ['case', ['==', ['get', 'selected'], 1], 0.32, 0.2],
        },
      },
      {
        id: 'obstacles-line',
        type: 'line',
        source: OBSTACLES_SOURCE_ID,
        paint: {
          'line-color': ['case', ['==', ['get', 'active'], 1], '#d1d5db', '#9ca3af'],
          'line-width': ['case', ['==', ['get', 'selected'], 1], 2.6, 1.6],
        },
      },
      {
        id: OBSTACLE_HIT_LAYER_ID,
        type: 'fill',
        source: OBSTACLES_SOURCE_ID,
        paint: {
          'fill-color': '#000000',
          'fill-opacity': 0,
        },
      },
      {
        id: EDGE_HIT_LAYER_ID,
        type: 'line',
        source: ACTIVE_EDGES_SOURCE_ID,
        paint: {
          'line-color': '#d8ad31',
          'line-width': ['case', ['==', ['get', 'selected'], 1], 5, 3],
          'line-opacity': ['case', ['==', ['get', 'selected'], 1], 0.88, 0.42],
        },
      },
      {
        id: VERTEX_HIT_LAYER_ID,
        type: 'circle',
        source: ACTIVE_VERTICES_SOURCE_ID,
        paint: {
          'circle-color': ['case', ['==', ['get', 'selected'], 1], '#5fe8ff', '#ffd167'],
          'circle-radius': ['case', ['==', ['get', 'selected'], 1], 7, 5],
          'circle-stroke-color': '#0f1316',
          'circle-stroke-width': 1.25,
        },
      },
      {
        id: 'vertex-height-labels',
        type: 'symbol',
        source: ACTIVE_VERTICES_SOURCE_ID,
        layout: {
          'text-field': ['get', 'heightLabel'],
          'text-size': 11,
          'text-offset': [0, -1.4],
          'text-font': ['Open Sans Semibold'],
        },
        paint: {
          'text-color': '#d5f4ff',
          'text-halo-color': '#0f171b',
          'text-halo-width': 1.1,
        },
      },
      {
        id: 'edge-height-labels',
        type: 'symbol',
        source: ACTIVE_EDGE_LABELS_SOURCE_ID,
        layout: {
          'text-field': ['get', 'edgeHeightLabel'],
          'text-size': 11,
          'text-offset': [0, 0.8],
          'text-font': ['Open Sans Semibold'],
        },
        paint: {
          'text-color': '#ffe59a',
          'text-halo-color': '#0f171b',
          'text-halo-width': 1,
        },
      },
      {
        id: OBSTACLE_VERTEX_HIT_LAYER_ID,
        type: 'circle',
        source: ACTIVE_OBSTACLE_VERTICES_SOURCE_ID,
        paint: {
          'circle-color': '#ffdea8',
          'circle-radius': 5,
          'circle-stroke-color': '#291d0f',
          'circle-stroke-width': 1.2,
        },
      },
      {
        id: 'draft-line',
        type: 'line',
        source: DRAFT_SOURCE_ID,
        paint: {
          'line-color': '#ff6b6b',
          'line-width': 2,
          'line-dasharray': [2, 1],
        },
      },
      {
        id: 'draft-points',
        type: 'circle',
        source: DRAFT_SOURCE_ID,
        paint: {
          'circle-color': '#ff6b6b',
          'circle-radius': 4,
        },
      },
    ],
  }
}
