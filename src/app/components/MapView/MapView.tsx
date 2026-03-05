import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import type { FootprintPolygon, RoofMeshData, VertexHeightConstraint } from '../../../types/geometry'
import { RoofMeshLayer } from '../../../rendering/roof-layer/RoofMeshLayer'

interface MapViewProps {
  footprint: FootprintPolygon | null
  drawDraft: Array<[number, number]>
  isDrawing: boolean
  orbitEnabled: boolean
  onToggleOrbit: () => void
  roofMesh: RoofMeshData | null
  vertexConstraints: VertexHeightConstraint[]
  selectedVertexIndex: number | null
  selectedEdgeIndex: number | null
  onSelectVertex: (vertexIndex: number) => void
  onSelectEdge: (edgeIndex: number) => void
  onClearSelection: () => void
  showSolveHint: boolean
  onMapClick: (point: [number, number]) => void
}

const SATELLITE_TILES =
  'https://server.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'

function toRing(vertices: Array<[number, number]>): Array<[number, number]> {
  if (vertices.length < 3) {
    return vertices
  }
  return [...vertices, vertices[0]]
}

type MapFeature = GeoJSON.Feature<GeoJSON.Point | GeoJSON.LineString | GeoJSON.Polygon>

const ORBIT_PITCH_DEG = 60
const ORBIT_BEARING_DEG = -20
const MAX_ORBIT_PITCH_DEG = 85
const CLICK_HIT_TOLERANCE_PX = 10
const EDGE_HIT_LAYER_ID = 'footprint-edge-hit'
const VERTEX_HIT_LAYER_ID = 'footprint-vertex-hit'

function toBounds(vertices: Array<[number, number]>): maplibregl.LngLatBoundsLike {
  let minLon = vertices[0][0]
  let minLat = vertices[0][1]
  let maxLon = vertices[0][0]
  let maxLat = vertices[0][1]

  for (const [lon, lat] of vertices) {
    minLon = Math.min(minLon, lon)
    minLat = Math.min(minLat, lat)
    maxLon = Math.max(maxLon, lon)
    maxLat = Math.max(maxLat, lat)
  }

  return [
    [minLon, minLat],
    [maxLon, maxLat],
  ]
}

function toEdgeSourceFeatures(
  vertices: Array<[number, number]>,
  selectedEdgeIndex: number | null,
): GeoJSON.Feature<GeoJSON.LineString>[] {
  const features: GeoJSON.Feature<GeoJSON.LineString>[] = []
  for (let i = 0; i < vertices.length; i += 1) {
    features.push({
      type: 'Feature',
      properties: { edgeIndex: i, selected: selectedEdgeIndex === i ? 1 : 0 },
      geometry: {
        type: 'LineString',
        coordinates: [vertices[i], vertices[(i + 1) % vertices.length]],
      },
    })
  }
  return features
}

function toVertexSourceFeatures(
  vertices: Array<[number, number]>,
  vertexHeights: Map<number, number>,
  selectedVertexIndex: number | null,
  selectedEdgeIndex: number | null,
): GeoJSON.Feature<GeoJSON.Point>[] {
  return vertices.map((vertex, idx) => {
    const height = vertexHeights.get(idx)
    const selectedByEdge =
      selectedEdgeIndex !== null && (idx === selectedEdgeIndex || idx === (selectedEdgeIndex + 1) % vertices.length)
    return {
      type: 'Feature',
      properties: {
        vertexIndex: idx,
        selected: selectedVertexIndex === idx || selectedByEdge ? 1 : 0,
        heightLabel: height !== undefined ? `${height.toFixed(2)} m` : '',
      },
      geometry: {
        type: 'Point',
        coordinates: vertex,
      },
    }
  })
}

function toEdgeHeightLabelFeatures(
  vertices: Array<[number, number]>,
  vertexHeights: Map<number, number>,
): GeoJSON.Feature<GeoJSON.Point>[] {
  const features: GeoJSON.Feature<GeoJSON.Point>[] = []
  for (let i = 0; i < vertices.length; i += 1) {
    const next = (i + 1) % vertices.length
    const hA = vertexHeights.get(i)
    const hB = vertexHeights.get(next)
    if (hA === undefined || hB === undefined || hA !== hB) {
      continue
    }

    const a = vertices[i]
    const b = vertices[next]
    features.push({
      type: 'Feature',
      properties: {
        edgeIndex: i,
        edgeHeightLabel: `${hA.toFixed(2)} m`,
      },
      geometry: {
        type: 'Point',
        coordinates: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
      },
    })
  }
  return features
}

function updateInteractiveSources(
  map: maplibregl.Map,
  nextFootprint: FootprintPolygon | null,
  nextVertexConstraints: VertexHeightConstraint[],
  nextSelectedVertex: number | null,
  nextSelectedEdge: number | null,
): void {
  const footprintSource = map.getSource('footprint') as maplibregl.GeoJSONSource | undefined
  const edgeSource = map.getSource('footprint-edges') as maplibregl.GeoJSONSource | undefined
  const vertexSource = map.getSource('footprint-vertices') as maplibregl.GeoJSONSource | undefined
  const edgeLabelSource = map.getSource('footprint-edge-labels') as maplibregl.GeoJSONSource | undefined

  if (!footprintSource || !edgeSource || !vertexSource || !edgeLabelSource) {
    return
  }

  if (!nextFootprint || nextFootprint.vertices.length < 3) {
    const empty: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }
    footprintSource.setData(empty)
    edgeSource.setData(empty)
    vertexSource.setData(empty)
    edgeLabelSource.setData(empty)
    return
  }

  const heightMap = new Map<number, number>(nextVertexConstraints.map((constraint) => [constraint.vertexIndex, constraint.heightM]))

  footprintSource.setData({
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Polygon',
          coordinates: [toRing(nextFootprint.vertices)],
        },
      },
    ],
  })

  edgeSource.setData({
    type: 'FeatureCollection',
    features: toEdgeSourceFeatures(nextFootprint.vertices, nextSelectedEdge),
  })

  vertexSource.setData({
    type: 'FeatureCollection',
    features: toVertexSourceFeatures(nextFootprint.vertices, heightMap, nextSelectedVertex, nextSelectedEdge),
  })

  edgeLabelSource.setData({
    type: 'FeatureCollection',
    features: toEdgeHeightLabelFeatures(nextFootprint.vertices, heightMap),
  })
}

export function MapView({
  footprint,
  drawDraft,
  isDrawing,
  orbitEnabled,
  onToggleOrbit,
  roofMesh,
  vertexConstraints,
  selectedVertexIndex,
  selectedEdgeIndex,
  onSelectVertex,
  onSelectEdge,
  onClearSelection,
  showSolveHint,
  onMapClick,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const roofLayerRef = useRef<RoofMeshLayer | null>(null)
  const drawingRef = useRef(isDrawing)
  const onClickRef = useRef(onMapClick)
  const onSelectVertexRef = useRef(onSelectVertex)
  const onSelectEdgeRef = useRef(onSelectEdge)
  const onClearSelectionRef = useRef(onClearSelection)
  const footprintRef = useRef(footprint)
  const draftRef = useRef(drawDraft)
  const roofMeshRef = useRef(roofMesh)
  const selectedVertexRef = useRef(selectedVertexIndex)
  const selectedEdgeRef = useRef(selectedEdgeIndex)
  const vertexConstraintsRef = useRef(vertexConstraints)

  useEffect(() => {
    drawingRef.current = isDrawing
  }, [isDrawing])

  useEffect(() => {
    onClickRef.current = onMapClick
  }, [onMapClick])

  useEffect(() => {
    onSelectVertexRef.current = onSelectVertex
  }, [onSelectVertex])

  useEffect(() => {
    onSelectEdgeRef.current = onSelectEdge
  }, [onSelectEdge])

  useEffect(() => {
    onClearSelectionRef.current = onClearSelection
  }, [onClearSelection])

  useEffect(() => {
    footprintRef.current = footprint
  }, [footprint])

  useEffect(() => {
    draftRef.current = drawDraft
  }, [drawDraft])

  useEffect(() => {
    roofMeshRef.current = roofMesh
  }, [roofMesh])

  useEffect(() => {
    selectedVertexRef.current = selectedVertexIndex
  }, [selectedVertexIndex])

  useEffect(() => {
    selectedEdgeRef.current = selectedEdgeIndex
  }, [selectedEdgeIndex])

  useEffect(() => {
    vertexConstraintsRef.current = vertexConstraints
  }, [vertexConstraints])

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return
    }

    const map = new maplibregl.Map({
      container: containerRef.current,
      canvasContextAttributes: {
        antialias: true,
      },
      style: {
        version: 8,
        sources: {
          satellite: {
            type: 'raster',
            tiles: [SATELLITE_TILES],
            tileSize: 256,
            attribution: 'Esri, Maxar, Earthstar Geographics, and the GIS User Community',
          },
          footprint: {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          },
          'footprint-edges': {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          },
          'footprint-vertices': {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          },
          'footprint-edge-labels': {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          },
          draft: {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          },
        },
        layers: [
          { id: 'satellite', type: 'raster', source: 'satellite' },
          {
            id: 'footprint-fill',
            type: 'fill',
            source: 'footprint',
            paint: {
              'fill-color': '#e5b422',
              'fill-opacity': 0.2,
            },
          },
          {
            id: 'footprint-line',
            type: 'line',
            source: 'footprint',
            paint: {
              'line-color': '#f7cc52',
              'line-width': 2,
            },
          },
          {
            id: EDGE_HIT_LAYER_ID,
            type: 'line',
            source: 'footprint-edges',
            paint: {
              'line-color': '#d8ad31',
              'line-width': ['case', ['==', ['get', 'selected'], 1], 5, 3],
              'line-opacity': ['case', ['==', ['get', 'selected'], 1], 0.88, 0.42],
            },
          },
          {
            id: VERTEX_HIT_LAYER_ID,
            type: 'circle',
            source: 'footprint-vertices',
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
            source: 'footprint-vertices',
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
            source: 'footprint-edge-labels',
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
            id: 'draft-line',
            type: 'line',
            source: 'draft',
            paint: {
              'line-color': '#ff6b6b',
              'line-width': 2,
              'line-dasharray': [2, 1],
            },
          },
          {
            id: 'draft-points',
            type: 'circle',
            source: 'draft',
            paint: {
              'circle-color': '#ff6b6b',
              'circle-radius': 4,
            },
          },
        ],
      },
      center: [-73.989, 40.733],
      zoom: 18,
      pitch: 0,
      bearing: 0,
      maxPitch: MAX_ORBIT_PITCH_DEG,
    })

    map.addControl(new maplibregl.NavigationControl(), 'top-right')

    map.on('load', () => {
      const roofLayer = new RoofMeshLayer('roof-mesh-layer')
      roofLayerRef.current = roofLayer
      map.addLayer(roofLayer)
      updateInteractiveSources(
        map,
        footprintRef.current,
        vertexConstraintsRef.current,
        selectedVertexRef.current,
        selectedEdgeRef.current,
      )

      const draftSource = map.getSource('draft') as maplibregl.GeoJSONSource | undefined
      if (draftSource) {
        const features: MapFeature[] = []
        if (draftRef.current.length >= 2) {
          features.push({
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: draftRef.current,
            },
          })
        }
        for (const point of draftRef.current) {
          features.push({
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Point',
              coordinates: point,
            },
          })
        }
        draftSource.setData({ type: 'FeatureCollection', features })
      }

      roofLayer.setMesh(roofMeshRef.current)
    })

    map.on('click', (event) => {
      if (drawingRef.current) {
        onClickRef.current([event.lngLat.lng, event.lngLat.lat])
        return
      }

      const currentFootprint = footprintRef.current
      if (!currentFootprint || currentFootprint.vertices.length < 3) {
        onClearSelectionRef.current()
        return
      }

      const hitBounds: [maplibregl.PointLike, maplibregl.PointLike] = [
        [event.point.x - CLICK_HIT_TOLERANCE_PX, event.point.y - CLICK_HIT_TOLERANCE_PX],
        [event.point.x + CLICK_HIT_TOLERANCE_PX, event.point.y + CLICK_HIT_TOLERANCE_PX],
      ]
      const hits = map.queryRenderedFeatures(hitBounds, {
        layers: [VERTEX_HIT_LAYER_ID, EDGE_HIT_LAYER_ID],
      })

      const vertexHit = hits.find((feature) => feature.layer.id === VERTEX_HIT_LAYER_ID)
      if (vertexHit?.properties && vertexHit.properties.vertexIndex !== undefined) {
        const rawVertexIndex = vertexHit.properties.vertexIndex
        const vertexIndex = typeof rawVertexIndex === 'number' ? rawVertexIndex : Number(rawVertexIndex)
        if (Number.isInteger(vertexIndex)) {
          onSelectVertexRef.current(vertexIndex)
          return
        }
      }

      const edgeHit = hits.find((feature) => feature.layer.id === EDGE_HIT_LAYER_ID)
      if (edgeHit?.properties && edgeHit.properties.edgeIndex !== undefined) {
        const rawEdgeIndex = edgeHit.properties.edgeIndex
        const edgeIndex = typeof rawEdgeIndex === 'number' ? rawEdgeIndex : Number(rawEdgeIndex)
        if (Number.isInteger(edgeIndex)) {
          onSelectEdgeRef.current(edgeIndex)
          return
        }
      }

      onClearSelectionRef.current()
    })

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
      roofLayerRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) {
      return
    }

    updateInteractiveSources(map, footprint, vertexConstraints, selectedVertexIndex, selectedEdgeIndex)
  }, [footprint, selectedEdgeIndex, selectedVertexIndex, vertexConstraints])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) {
      return
    }

    const source = map.getSource('draft') as maplibregl.GeoJSONSource | undefined
    if (!source) {
      return
    }

    const features: MapFeature[] = []

    if (drawDraft.length >= 2) {
      features.push({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: drawDraft,
        },
      })
    }

    for (const point of drawDraft) {
      features.push({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Point',
          coordinates: point,
        },
      })
    }

    source.setData({
      type: 'FeatureCollection',
      features,
    })
  }, [drawDraft])

  useEffect(() => {
    roofLayerRef.current?.setMesh(roofMesh)
  }, [roofMesh])

  useEffect(() => {
    const map = mapRef.current
    if (!map) {
      return
    }

    if (!orbitEnabled) {
      map.dragRotate.disable()
      map.touchZoomRotate.disableRotation()
      map.easeTo({
        pitch: 0,
        bearing: 0,
        duration: 350,
      })
      return
    }

    map.dragRotate.enable()
    map.touchZoomRotate.enableRotation()

    const hasFootprint = footprint && footprint.vertices.length >= 3
    if (hasFootprint) {
      map.fitBounds(toBounds(footprint.vertices), {
        padding: 80,
        duration: 500,
        bearing: ORBIT_BEARING_DEG,
        pitch: ORBIT_PITCH_DEG,
        maxZoom: 20,
      })
      return
    }

    map.easeTo({
      pitch: ORBIT_PITCH_DEG,
      bearing: ORBIT_BEARING_DEG,
      duration: 500,
    })
  }, [footprint, orbitEnabled])

  return (
    <div className="map-root-wrap">
      <div ref={containerRef} className="map-root" />
      <button type="button" className="map-orbit-toggle" onClick={onToggleOrbit}>
        {orbitEnabled ? 'Exit orbit' : 'Orbit'}
      </button>
      {!isDrawing && footprint && <div className="map-selection-hint">Click a vertex or edge to edit its height</div>}
      {orbitEnabled && showSolveHint && footprint && (
        <div className="map-hint">Add heights to solve plane</div>
      )}
    </div>
  )
}
