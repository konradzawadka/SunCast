import { useEffect, useMemo, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import type { FootprintPolygon, RoofMeshData, VertexHeightConstraint } from '../../../types/geometry'
import { DebugOverlayLayer } from '../../../rendering/roof-layer/DebugOverlayLayer'
import { RoofMeshLayer } from '../../../rendering/roof-layer/RoofMeshLayer'
import { projectPointsToLocalMeters } from '../../../geometry/projection/localMeters'

interface MapViewProps {
  footprints: FootprintPolygon[]
  activeFootprint: FootprintPolygon | null
  selectedFootprintIds: string[]
  drawDraft: Array<[number, number]>
  isDrawing: boolean
  orbitEnabled: boolean
  onToggleOrbit: () => void
  roofMeshes: RoofMeshData[]
  vertexConstraints: VertexHeightConstraint[]
  selectedVertexIndex: number | null
  selectedEdgeIndex: number | null
  onSelectVertex: (vertexIndex: number) => void
  onSelectEdge: (edgeIndex: number) => void
  onSelectFootprint: (footprintId: string, multiSelect: boolean) => void
  onClearSelection: () => void
  onMoveVertex: (vertexIndex: number, point: [number, number]) => boolean
  onMoveEdge: (edgeIndex: number, delta: [number, number]) => boolean
  onMoveRejected: () => void
  onAdjustHeight: (stepM: number) => void
  showSolveHint: boolean
  diagnostics: {
    constraintCount: number
    minHeightM: number
    maxHeightM: number
    pitchDeg: number
    triangleCount: number
  } | null
  onMapClick: (point: [number, number]) => void
  onBearingChange: (bearingDeg: number) => void
  onPitchChange: (pitchDeg: number) => void
  onInitialized?: () => void
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
const AUTO_FOCUS_MAX_ZOOM = 19
const CLICK_HIT_TOLERANCE_PX = 10
const DRAG_HIT_TOLERANCE_PX = 12
const FOOTPRINT_HIT_LAYER_ID = 'footprints-hit'
const EDGE_HIT_LAYER_ID = 'active-footprint-edge-hit'
const VERTEX_HIT_LAYER_ID = 'active-footprint-vertex-hit'
const HEIGHT_STEP_M = 0.1
const HEIGHT_STEP_SHIFT_M = 1.0
const DEBUG_Z_EXAGGERATION = 40

interface DragState {
  type: 'vertex' | 'edge'
  index: number
  lastLngLat: [number, number]
  invalidAttempted: boolean
}

function edgeLengthMeters(vertices: Array<[number, number]>, edgeIndex: number): number | null {
  if (edgeIndex < 0 || edgeIndex >= vertices.length) {
    return null
  }
  const start = vertices[edgeIndex]
  const end = vertices[(edgeIndex + 1) % vertices.length]
  const { points2d } = projectPointsToLocalMeters([start, end])
  const dx = points2d[1].x - points2d[0].x
  const dy = points2d[1].y - points2d[0].y
  return Math.sqrt(dx * dx + dy * dy)
}

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

function toFootprintFeatures(
  footprints: FootprintPolygon[],
  activeFootprintId: string | null,
  selectedFootprintIds: Set<string>,
): GeoJSON.Feature<GeoJSON.Polygon>[] {
  return footprints
    .filter((footprint) => footprint.vertices.length >= 3)
    .map((footprint) => ({
      type: 'Feature',
      properties: {
        footprintId: footprint.id,
        active: activeFootprintId === footprint.id ? 1 : 0,
        selected: selectedFootprintIds.has(footprint.id) ? 1 : 0,
      },
      geometry: {
        type: 'Polygon',
        coordinates: [toRing(footprint.vertices)],
      },
    }))
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
  footprints: FootprintPolygon[],
  activeFootprint: FootprintPolygon | null,
  selectedFootprintIds: string[],
  nextVertexConstraints: VertexHeightConstraint[],
  nextSelectedVertex: number | null,
  nextSelectedEdge: number | null,
): void {
  const footprintsSource = map.getSource('footprints') as maplibregl.GeoJSONSource | undefined
  const edgeSource = map.getSource('active-footprint-edges') as maplibregl.GeoJSONSource | undefined
  const vertexSource = map.getSource('active-footprint-vertices') as maplibregl.GeoJSONSource | undefined
  const edgeLabelSource = map.getSource('active-footprint-edge-labels') as maplibregl.GeoJSONSource | undefined

  if (!footprintsSource || !edgeSource || !vertexSource || !edgeLabelSource) {
    return
  }

  const empty: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }

  footprintsSource.setData({
    type: 'FeatureCollection',
    features: toFootprintFeatures(footprints, activeFootprint?.id ?? null, new Set(selectedFootprintIds)),
  })

  if (!activeFootprint || activeFootprint.vertices.length < 3) {
    edgeSource.setData(empty)
    vertexSource.setData(empty)
    edgeLabelSource.setData(empty)
    return
  }

  const heightMap = new Map<number, number>(
    nextVertexConstraints.map((constraint) => [constraint.vertexIndex, constraint.heightM]),
  )

  edgeSource.setData({
    type: 'FeatureCollection',
    features: toEdgeSourceFeatures(activeFootprint.vertices, nextSelectedEdge),
  })

  vertexSource.setData({
    type: 'FeatureCollection',
    features: toVertexSourceFeatures(activeFootprint.vertices, heightMap, nextSelectedVertex, nextSelectedEdge),
  })

  edgeLabelSource.setData({
    type: 'FeatureCollection',
    features: toEdgeHeightLabelFeatures(activeFootprint.vertices, heightMap),
  })
}

export function MapView({
  footprints,
  activeFootprint,
  selectedFootprintIds,
  drawDraft,
  isDrawing,
  orbitEnabled,
  onToggleOrbit,
  roofMeshes,
  vertexConstraints,
  selectedVertexIndex,
  selectedEdgeIndex,
  onSelectVertex,
  onSelectEdge,
  onSelectFootprint,
  onClearSelection,
  onMoveVertex,
  onMoveEdge,
  onMoveRejected,
  onAdjustHeight,
  showSolveHint,
  diagnostics,
  onMapClick,
  onBearingChange,
  onPitchChange,
  onInitialized,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const roofLayerRef = useRef<RoofMeshLayer | null>(null)
  const debugOverlayLayerRef = useRef<DebugOverlayLayer | null>(null)
  const drawingRef = useRef(isDrawing)
  const onClickRef = useRef(onMapClick)
  const onSelectVertexRef = useRef(onSelectVertex)
  const onSelectEdgeRef = useRef(onSelectEdge)
  const onSelectFootprintRef = useRef(onSelectFootprint)
  const onClearSelectionRef = useRef(onClearSelection)
  const onMoveVertexRef = useRef(onMoveVertex)
  const onMoveEdgeRef = useRef(onMoveEdge)
  const onMoveRejectedRef = useRef(onMoveRejected)
  const onAdjustHeightRef = useRef(onAdjustHeight)
  const onBearingChangeRef = useRef(onBearingChange)
  const onPitchChangeRef = useRef(onPitchChange)
  const onInitializedRef = useRef(onInitialized)
  const footprintsRef = useRef(footprints)
  const activeFootprintRef = useRef(activeFootprint)
  const selectedFootprintIdsRef = useRef(selectedFootprintIds)
  const draftRef = useRef(drawDraft)
  const roofMeshesRef = useRef(roofMeshes)
  const selectedVertexRef = useRef(selectedVertexIndex)
  const selectedEdgeRef = useRef(selectedEdgeIndex)
  const vertexConstraintsRef = useRef(vertexConstraints)
  const orbitEnabledRef = useRef(orbitEnabled)
  const hasAppliedInitialFootprintFocusRef = useRef(false)
  const [debugEnabled, setDebugEnabled] = useState(true)
  const debugEnabledRef = useRef(debugEnabled)
  const dragStateRef = useRef<DragState | null>(null)
  const [gizmoScreenPos, setGizmoScreenPos] = useState<{ left: number; top: number } | null>(null)
  const [mapZoom, setMapZoom] = useState(18)
  const [mapPitch, setMapPitch] = useState(0)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [hoveredEdgeLength, setHoveredEdgeLength] = useState<{ left: number; top: number; lengthM: number } | null>(null)
  const hoveredEdgeLengthRef = useRef<{ left: number; top: number; lengthM: number } | null>(null)

  const adjustOrbitCamera = (bearingDeltaDeg: number, pitchDeltaDeg: number) => {
    const map = mapRef.current
    if (!map) {
      return
    }
    const nextPitch = Math.max(0, Math.min(MAX_ORBIT_PITCH_DEG, map.getPitch() + pitchDeltaDeg))
    map.easeTo({
      bearing: map.getBearing() + bearingDeltaDeg,
      pitch: nextPitch,
      duration: 220,
    })
  }

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
    onSelectFootprintRef.current = onSelectFootprint
  }, [onSelectFootprint])

  useEffect(() => {
    onClearSelectionRef.current = onClearSelection
  }, [onClearSelection])

  useEffect(() => {
    onMoveVertexRef.current = onMoveVertex
  }, [onMoveVertex])

  useEffect(() => {
    onMoveEdgeRef.current = onMoveEdge
  }, [onMoveEdge])

  useEffect(() => {
    onMoveRejectedRef.current = onMoveRejected
  }, [onMoveRejected])

  useEffect(() => {
    onAdjustHeightRef.current = onAdjustHeight
  }, [onAdjustHeight])

  useEffect(() => {
    onBearingChangeRef.current = onBearingChange
  }, [onBearingChange])

  useEffect(() => {
    onPitchChangeRef.current = onPitchChange
  }, [onPitchChange])

  useEffect(() => {
    onInitializedRef.current = onInitialized
  }, [onInitialized])

  useEffect(() => {
    footprintsRef.current = footprints
  }, [footprints])

  useEffect(() => {
    activeFootprintRef.current = activeFootprint
  }, [activeFootprint])

  useEffect(() => {
    selectedFootprintIdsRef.current = selectedFootprintIds
  }, [selectedFootprintIds])

  useEffect(() => {
    draftRef.current = drawDraft
  }, [drawDraft])

  useEffect(() => {
    roofMeshesRef.current = roofMeshes
  }, [roofMeshes])

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
    orbitEnabledRef.current = orbitEnabled
  }, [orbitEnabled])

  useEffect(() => {
    debugEnabledRef.current = debugEnabled
  }, [debugEnabled])

  useEffect(() => {
    hoveredEdgeLengthRef.current = hoveredEdgeLength
  }, [hoveredEdgeLength])

  const gizmoAnchor = useMemo(() => {
    if (!activeFootprint || activeFootprint.vertices.length < 3 || !orbitEnabled) {
      return null
    }
    if (selectedVertexIndex !== null && selectedVertexIndex >= 0 && selectedVertexIndex < activeFootprint.vertices.length) {
      return activeFootprint.vertices[selectedVertexIndex]
    }
    if (selectedEdgeIndex !== null && selectedEdgeIndex >= 0 && selectedEdgeIndex < activeFootprint.vertices.length) {
      const start = activeFootprint.vertices[selectedEdgeIndex]
      const end = activeFootprint.vertices[(selectedEdgeIndex + 1) % activeFootprint.vertices.length]
      return [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2] as [number, number]
    }
    return null
  }, [activeFootprint, orbitEnabled, selectedEdgeIndex, selectedVertexIndex])

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
          footprints: {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          },
          'active-footprint-edges': {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          },
          'active-footprint-vertices': {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          },
          'active-footprint-edge-labels': {
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
            id: 'footprints-fill',
            type: 'fill',
            source: 'footprints',
            paint: {
              'fill-color': ['case', ['==', ['get', 'active'], 1], '#e5b422', '#7ca5ff'],
              'fill-opacity': ['case', ['==', ['get', 'selected'], 1], 0.3, 0.12],
            },
          },
          {
            id: 'footprints-line',
            type: 'line',
            source: 'footprints',
            paint: {
              'line-color': ['case', ['==', ['get', 'active'], 1], '#f7cc52', ['==', ['get', 'selected'], 1], '#8fe287', '#93b4ff'],
              'line-width': ['case', ['==', ['get', 'selected'], 1], 2.8, 1.5],
            },
          },
          {
            id: FOOTPRINT_HIT_LAYER_ID,
            type: 'fill',
            source: 'footprints',
            paint: {
              'fill-color': '#000000',
              'fill-opacity': 0,
            },
          },
          {
            id: EDGE_HIT_LAYER_ID,
            type: 'line',
            source: 'active-footprint-edges',
            paint: {
              'line-color': '#d8ad31',
              'line-width': ['case', ['==', ['get', 'selected'], 1], 5, 3],
              'line-opacity': ['case', ['==', ['get', 'selected'], 1], 0.88, 0.42],
            },
          },
          {
            id: VERTEX_HIT_LAYER_ID,
            type: 'circle',
            source: 'active-footprint-vertices',
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
            source: 'active-footprint-vertices',
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
            source: 'active-footprint-edge-labels',
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
    onBearingChangeRef.current(map.getBearing())
    onPitchChangeRef.current(map.getPitch())
    setMapZoom(map.getZoom())
    setMapPitch(map.getPitch())

    map.on('load', () => {
      setMapLoaded(true)
      const roofLayer = new RoofMeshLayer('roof-mesh-layer')
      const debugOverlayLayer = new DebugOverlayLayer('roof-debug-overlay-layer')
      roofLayerRef.current = roofLayer
      debugOverlayLayerRef.current = debugOverlayLayer
      map.addLayer(roofLayer)
      map.addLayer(debugOverlayLayer)
      updateInteractiveSources(
        map,
        footprintsRef.current,
        activeFootprintRef.current,
        selectedFootprintIdsRef.current,
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

      const zExaggeration = debugEnabledRef.current ? DEBUG_Z_EXAGGERATION : 1
      roofLayer.setMeshes(roofMeshesRef.current)
      roofLayer.setZExaggeration(zExaggeration)
      debugOverlayLayer.setMeshes(roofMeshesRef.current)
      debugOverlayLayer.setZExaggeration(zExaggeration)
      debugOverlayLayer.setVisible(debugEnabledRef.current)
      onInitializedRef.current?.()
    })

    map.on('click', (event) => {
      if (drawingRef.current) {
        onClickRef.current([event.lngLat.lng, event.lngLat.lat])
        return
      }

      const hitBounds: [maplibregl.PointLike, maplibregl.PointLike] = [
        [event.point.x - CLICK_HIT_TOLERANCE_PX, event.point.y - CLICK_HIT_TOLERANCE_PX],
        [event.point.x + CLICK_HIT_TOLERANCE_PX, event.point.y + CLICK_HIT_TOLERANCE_PX],
      ]
      const hits = map.queryRenderedFeatures(hitBounds, {
        layers: [VERTEX_HIT_LAYER_ID, EDGE_HIT_LAYER_ID, FOOTPRINT_HIT_LAYER_ID],
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

      const footprintHit = hits.find((feature) => feature.layer.id === FOOTPRINT_HIT_LAYER_ID)
      const rawFootprintId = footprintHit?.properties?.footprintId
      if (typeof rawFootprintId === 'string' && rawFootprintId) {
        onSelectFootprintRef.current(rawFootprintId, event.originalEvent.ctrlKey || event.originalEvent.metaKey)
        return
      }

      onClearSelectionRef.current()
    })

    map.on('mousedown', (event) => {
      if (drawingRef.current || orbitEnabledRef.current) {
        return
      }

      const hitBounds: [maplibregl.PointLike, maplibregl.PointLike] = [
        [event.point.x - DRAG_HIT_TOLERANCE_PX, event.point.y - DRAG_HIT_TOLERANCE_PX],
        [event.point.x + DRAG_HIT_TOLERANCE_PX, event.point.y + DRAG_HIT_TOLERANCE_PX],
      ]
      const hits = map.queryRenderedFeatures(hitBounds, {
        layers: [VERTEX_HIT_LAYER_ID, EDGE_HIT_LAYER_ID],
      })
      const vertexHit = hits.find((feature) => feature.layer.id === VERTEX_HIT_LAYER_ID)
      if (vertexHit?.properties && vertexHit.properties.vertexIndex !== undefined) {
        const rawVertexIndex = vertexHit.properties.vertexIndex
        const vertexIndex = typeof rawVertexIndex === 'number' ? rawVertexIndex : Number(rawVertexIndex)
        if (!Number.isInteger(vertexIndex)) {
          return
        }

        dragStateRef.current = {
          type: 'vertex',
          index: vertexIndex,
          lastLngLat: [event.lngLat.lng, event.lngLat.lat],
          invalidAttempted: false,
        }
        map.dragPan.disable()
        map.getCanvas().style.cursor = 'grabbing'
      }

      if (dragStateRef.current) {
        return
      }

      const edgeHit = hits.find((feature) => feature.layer.id === EDGE_HIT_LAYER_ID)
      if (!edgeHit?.properties || edgeHit.properties.edgeIndex === undefined) {
        return
      }
      const rawEdgeIndex = edgeHit.properties.edgeIndex
      const edgeIndex = typeof rawEdgeIndex === 'number' ? rawEdgeIndex : Number(rawEdgeIndex)
      if (!Number.isInteger(edgeIndex)) {
        return
      }

      dragStateRef.current = {
        type: 'edge',
        index: edgeIndex,
        lastLngLat: [event.lngLat.lng, event.lngLat.lat],
        invalidAttempted: false,
      }
      map.dragPan.disable()
      map.getCanvas().style.cursor = 'grabbing'
    })

    map.on('mousemove', (event) => {
      if (!drawingRef.current && !orbitEnabledRef.current && !dragStateRef.current) {
        const hitBounds: [maplibregl.PointLike, maplibregl.PointLike] = [
          [event.point.x - DRAG_HIT_TOLERANCE_PX, event.point.y - DRAG_HIT_TOLERANCE_PX],
          [event.point.x + DRAG_HIT_TOLERANCE_PX, event.point.y + DRAG_HIT_TOLERANCE_PX],
        ]
        const hits = map.queryRenderedFeatures(hitBounds, {
          layers: [VERTEX_HIT_LAYER_ID, EDGE_HIT_LAYER_ID],
        })
        const hasInteractiveHit = hits.some(
          (feature) => feature.layer.id === VERTEX_HIT_LAYER_ID || feature.layer.id === EDGE_HIT_LAYER_ID,
        )
        map.getCanvas().style.cursor = hasInteractiveHit ? 'grab' : ''

        const edgeHit = hits.find((feature) => feature.layer.id === EDGE_HIT_LAYER_ID)
        const rawEdgeIndex = edgeHit?.properties?.edgeIndex
        const edgeIndex = typeof rawEdgeIndex === 'number' ? rawEdgeIndex : Number(rawEdgeIndex)
        const active = activeFootprintRef.current
        if (Number.isInteger(edgeIndex) && active && active.vertices.length >= 2) {
          const lengthM = edgeLengthMeters(active.vertices, edgeIndex)
          if (lengthM !== null) {
            const start = active.vertices[edgeIndex]
            const end = active.vertices[(edgeIndex + 1) % active.vertices.length]
            const midLon = (start[0] + end[0]) / 2
            const midLat = (start[1] + end[1]) / 2
            const midScreen = map.project({ lng: midLon, lat: midLat })
            setHoveredEdgeLength({ left: midScreen.x, top: midScreen.y, lengthM })
          } else {
            setHoveredEdgeLength(null)
          }
        } else {
          setHoveredEdgeLength(null)
        }
      } else if (hoveredEdgeLengthRef.current !== null) {
        setHoveredEdgeLength(null)
      }

      const dragState = dragStateRef.current
      if (!dragState || drawingRef.current || orbitEnabledRef.current) {
        return
      }

      if (dragState.type === 'vertex') {
        const applied = onMoveVertexRef.current(dragState.index, [event.lngLat.lng, event.lngLat.lat])
        if (!applied) {
          dragState.invalidAttempted = true
        } else {
          dragState.lastLngLat = [event.lngLat.lng, event.lngLat.lat]
        }
        return
      }

      const deltaLng = event.lngLat.lng - dragState.lastLngLat[0]
      const deltaLat = event.lngLat.lat - dragState.lastLngLat[1]
      if (deltaLng === 0 && deltaLat === 0) {
        return
      }

      const applied = onMoveEdgeRef.current(dragState.index, [deltaLng, deltaLat])
      if (!applied) {
        dragState.invalidAttempted = true
        return
      }
      dragState.lastLngLat = [event.lngLat.lng, event.lngLat.lat]
    })

    const finishDrag = () => {
      const dragState = dragStateRef.current
      if (!dragState) {
        return
      }
      dragStateRef.current = null
      map.dragPan.enable()
      map.getCanvas().style.cursor = ''
      setHoveredEdgeLength(null)
      if (dragState.invalidAttempted) {
        onMoveRejectedRef.current()
      }
    }

    map.on('mouseup', finishDrag)
    map.on('mouseout', finishDrag)

    const emitBearing = () => {
      onBearingChangeRef.current(map.getBearing())
    }
    const emitPitch = () => {
      const nextPitch = map.getPitch()
      onPitchChangeRef.current(nextPitch)
      setMapPitch(nextPitch)
    }
    const emitZoom = () => {
      setMapZoom(map.getZoom())
    }
    map.on('rotate', emitBearing)
    map.on('pitch', emitPitch)
    map.on('zoom', emitZoom)

    mapRef.current = map

    return () => {
      map.off('rotate', emitBearing)
      map.off('pitch', emitPitch)
      map.off('zoom', emitZoom)
      map.remove()
      mapRef.current = null
      roofLayerRef.current = null
      debugOverlayLayerRef.current = null
      setHoveredEdgeLength(null)
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) {
      return
    }

    updateInteractiveSources(
      map,
      footprints,
      activeFootprint,
      selectedFootprintIds,
      vertexConstraints,
      selectedVertexIndex,
      selectedEdgeIndex,
    )
  }, [activeFootprint, footprints, selectedEdgeIndex, selectedFootprintIds, selectedVertexIndex, vertexConstraints])

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
    const map = mapRef.current
    if (!map || !mapLoaded || hasAppliedInitialFootprintFocusRef.current) {
      return
    }

    const firstFootprint = footprints.find((candidate) => candidate.vertices.length >= 3)
    if (!firstFootprint) {
      return
    }

    hasAppliedInitialFootprintFocusRef.current = true
    map.fitBounds(toBounds(firstFootprint.vertices), {
      padding: 80,
      duration: 0,
      maxZoom: AUTO_FOCUS_MAX_ZOOM,
    })
  }, [footprints, mapLoaded])

  useEffect(() => {
    roofLayerRef.current?.setMeshes(roofMeshes)
    debugOverlayLayerRef.current?.setMeshes(roofMeshes)
  }, [roofMeshes])

  useEffect(() => {
    const roofLayer = roofLayerRef.current
    const debugLayer = debugOverlayLayerRef.current
    const map = mapRef.current
    if (!roofLayer || !debugLayer || !map || !map.getLayer('roof-debug-overlay-layer')) {
      return
    }

    const zExaggeration = debugEnabled ? DEBUG_Z_EXAGGERATION : 1
    roofLayer.setZExaggeration(zExaggeration)
    debugLayer.setZExaggeration(zExaggeration)
    debugLayer.setVisible(debugEnabled)
  }, [debugEnabled])

  useEffect(() => {
    const map = mapRef.current
    if (!map) {
      return
    }

    if (!orbitEnabled) {
      map.dragRotate.disable()
      map.touchZoomRotate.disableRotation()
      if (map.getLayer('footprints-fill')) {
        map.setPaintProperty('footprints-fill', 'fill-opacity', ['case', ['==', ['get', 'active'], 1], 0.24, 0.12])
      }
      map.easeTo({
        pitch: 0,
        bearing: 0,
        duration: 350,
      })
      return
    }

    map.dragRotate.enable()
    map.touchZoomRotate.enableRotation()
    if (map.getLayer('footprints-fill')) {
      map.setPaintProperty('footprints-fill', 'fill-opacity', 0)
    }

    const focusFootprint = activeFootprint ?? footprints.find((candidate) => candidate.vertices.length >= 3) ?? null
    if (focusFootprint && focusFootprint.vertices.length >= 3) {
      map.fitBounds(toBounds(focusFootprint.vertices), {
        padding: 80,
        duration: 500,
        bearing: ORBIT_BEARING_DEG,
        pitch: ORBIT_PITCH_DEG,
        maxZoom: AUTO_FOCUS_MAX_ZOOM,
      })
      return
    }

    map.easeTo({
      pitch: ORBIT_PITCH_DEG,
      bearing: ORBIT_BEARING_DEG,
      duration: 500,
    })
  }, [activeFootprint, footprints, orbitEnabled])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !gizmoAnchor || !orbitEnabled) {
      setGizmoScreenPos(null)
      return
    }

    const updateGizmoPosition = () => {
      const projected = map.project({ lng: gizmoAnchor[0], lat: gizmoAnchor[1] })
      setGizmoScreenPos({ left: projected.x, top: projected.y })
    }

    updateGizmoPosition()
    map.on('move', updateGizmoPosition)
    map.on('rotate', updateGizmoPosition)
    map.on('pitch', updateGizmoPosition)
    map.on('zoom', updateGizmoPosition)
    map.on('resize', updateGizmoPosition)
    return () => {
      map.off('move', updateGizmoPosition)
      map.off('rotate', updateGizmoPosition)
      map.off('pitch', updateGizmoPosition)
      map.off('zoom', updateGizmoPosition)
      map.off('resize', updateGizmoPosition)
    }
  }, [gizmoAnchor, orbitEnabled])

  return (
    <div className="map-root-wrap">
      <div ref={containerRef} className="map-root" data-testid="map-canvas" />
      <button type="button" className="map-orbit-toggle" onClick={onToggleOrbit} data-testid="orbit-toggle-button">
        {orbitEnabled ? 'Exit orbit' : 'Orbit'}
      </button>
      <button
        type="button"
        className="map-debug-toggle"
        onClick={() => setDebugEnabled((enabled) => !enabled)}
        data-testid="debug-overlay-toggle-button"
      >
        {debugEnabled ? 'Hide debug' : 'Show debug'}
      </button>
      <div className="map-ground-label">Ground roof polygon</div>
      {orbitEnabled && (
        <div className="map-camera-controls">
          <button
            type="button"
            data-testid="map-rotate-left-button"
            onClick={() => adjustOrbitCamera(-15, 0)}
            title="Rotate left"
          >
            ⟲
          </button>
          <button
            type="button"
            data-testid="map-rotate-right-button"
            onClick={() => adjustOrbitCamera(15, 0)}
            title="Rotate right"
          >
            ⟳
          </button>
          <button
            type="button"
            data-testid="map-pitch-up-button"
            onClick={() => adjustOrbitCamera(0, 6)}
            title="Pitch up"
          >
            ↥
          </button>
          <button
            type="button"
            data-testid="map-pitch-down-button"
            onClick={() => adjustOrbitCamera(0, -6)}
            title="Pitch down"
          >
            ↧
          </button>
        </div>
      )}
      {debugEnabled && diagnostics && (
        <div className="map-debug-hud" data-testid="map-debug-hud">
          <p>constraints: {diagnostics.constraintCount}</p>
          <p>
            min/max/span: {diagnostics.minHeightM.toFixed(2)}m / {diagnostics.maxHeightM.toFixed(2)}m /{' '}
            {(diagnostics.maxHeightM - diagnostics.minHeightM).toFixed(2)}m
          </p>
          <p>pitch: {diagnostics.pitchDeg.toFixed(2)} deg</p>
          <p>triangles: {diagnostics.triangleCount}</p>
          <p>
            map pitch/zoom: {mapPitch.toFixed(1)} deg / {mapZoom.toFixed(2)}
          </p>
        </div>
      )}
      {debugEnabled && roofMeshes.length === 0 && !isDrawing && (
        <div className="map-debug-hint" data-testid="map-debug-hint">
          Debug overlay needs a solved roof (set at least 3 constraints).
        </div>
      )}
      {!isDrawing && activeFootprint && <div className="map-selection-hint">Click a vertex or edge to edit its height</div>}
      {hoveredEdgeLength && !isDrawing && !orbitEnabled && (
        <div
          className="map-edge-hover-label"
          style={{ left: `${hoveredEdgeLength.left}px`, top: `${hoveredEdgeLength.top}px` }}
          data-testid="map-edge-hover-label"
        >
          {hoveredEdgeLength.lengthM.toFixed(2)} m
        </div>
      )}
      {orbitEnabled && gizmoScreenPos && (
        <div className="height-gizmo" style={{ left: `${gizmoScreenPos.left}px`, top: `${gizmoScreenPos.top}px` }}>
          <button
            type="button"
            className="height-gizmo-button"
            onClick={(event) =>
              onAdjustHeightRef.current(event.shiftKey ? HEIGHT_STEP_SHIFT_M : HEIGHT_STEP_M)
            }
          >
            ▲
          </button>
          <button
            type="button"
            className="height-gizmo-button"
            onClick={(event) =>
              onAdjustHeightRef.current(event.shiftKey ? -HEIGHT_STEP_SHIFT_M : -HEIGHT_STEP_M)
            }
          >
            ▼
          </button>
        </div>
      )}
      {orbitEnabled && showSolveHint && activeFootprint && <div className="map-hint">Add heights to solve plane</div>}
    </div>
  )
}
