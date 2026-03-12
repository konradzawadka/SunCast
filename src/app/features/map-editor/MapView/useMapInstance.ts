import { useEffect, useRef, useState, type RefObject } from 'react'
import maplibregl from 'maplibre-gl'
import * as THREE from 'three'
import type { ShadeHeatmapFeature } from '../../../hooks/useRoofShading'
import { WorldMeshLayer } from '../../../../rendering/roof-layer/RoofMeshLayer'
import { buildWorldMeshGeometry, type WorldPoint } from '../../../../rendering/roof-layer/meshWorldGeometry'
import { acquireSharedThreeRenderer, releaseSharedThreeRenderer } from '../../../../rendering/roof-layer/sharedThreeRenderer'
import type { RoofMeshData } from '../../../../types/geometry'
import { MAX_ORBIT_PITCH_DEG } from './mapViewConstants'
import { createMapStyle } from './createMapStyle'
import { parseMapCenterFromHash } from './mapCenterFromHash'
import { useLatest } from './useLatest'

interface UseMapInstanceArgs {
  onInitialized?: () => void
}

interface UseMapInstanceResult {
  containerRef: RefObject<HTMLDivElement | null>
  mapRef: RefObject<maplibregl.Map | null>
  roofLayerRef: RefObject<WorldMeshLayer | null>
  obstacleLayerRef: RefObject<WorldMeshLayer | null>
  heatmapLayerRef: RefObject<RoofHeatmapLayer | null>
  mapLoaded: boolean
  mapError: string | null
}

const EARTH_CIRCUMFERENCE_M = 40075016.68557849
const DEG_TO_RAD = Math.PI / 180
const HEATMAP_RENDER_EPSILON_M = 0.08

function lonToMercatorX(lonDeg: number): number {
  return (lonDeg + 180) / 360
}

function latToMercatorY(latDeg: number): number {
  const latRad = latDeg * DEG_TO_RAD
  const mercN = Math.log(Math.tan(Math.PI * 0.25 + latRad * 0.5))
  return (1 - mercN / Math.PI) * 0.5
}

function meterInMercatorCoordinateUnits(latDeg: number): number {
  return 1 / (EARTH_CIRCUMFERENCE_M * Math.cos(latDeg * DEG_TO_RAD))
}

function barycentricWeights(
  x: number,
  y: number,
  a: WorldPoint,
  b: WorldPoint,
  c: WorldPoint,
): [number, number, number] | null {
  const denominator = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y)
  if (Math.abs(denominator) < Number.EPSILON) {
    return null
  }

  const weightA = ((b.y - c.y) * (x - c.x) + (c.x - b.x) * (y - c.y)) / denominator
  const weightB = ((c.y - a.y) * (x - c.x) + (a.x - c.x) * (y - c.y)) / denominator
  const weightC = 1 - weightA - weightB
  const tolerance = 1e-6
  if (weightA < -tolerance || weightB < -tolerance || weightC < -tolerance) {
    return null
  }

  return [weightA, weightB, weightC]
}

function interpolateRoofZ(roofMeshes: RoofMeshData[], lon: number, lat: number, zExaggeration: number): number | null {
  const x = lonToMercatorX(lon)
  const y = latToMercatorY(lat)
  for (const roofMesh of roofMeshes) {
    const roof = buildWorldMeshGeometry(roofMesh, zExaggeration)
    if (!roof) {
      continue
    }

    for (let i = 0; i < roof.triangleIndices.length; i += 3) {
      const a = roof.topVertices[roof.triangleIndices[i] ?? -1]
      const b = roof.topVertices[roof.triangleIndices[i + 1] ?? -1]
      const c = roof.topVertices[roof.triangleIndices[i + 2] ?? -1]
      if (!a || !b || !c) {
        continue
      }
      const weights = barycentricWeights(x, y, a, b, c)
      if (!weights) {
        continue
      }
      const [wa, wb, wc] = weights
      return wa * a.z + wb * b.z + wc * c.z
    }
  }

  return null
}

function heatmapColor(intensity: number): [number, number, number] {
  const t = Math.max(0, Math.min(1, intensity))
  return [0.15 + (1 - t) * 0.47, 0.23 + (1 - t) * 0.49, 0.38 + (1 - t) * 0.45]
}

function buildHeatmapGeometry(
  roofMeshes: RoofMeshData[],
  features: ShadeHeatmapFeature[],
  zExaggeration: number,
): THREE.BufferGeometry | null {
  const positions: number[] = []
  const colors: number[] = []
  const indices: number[] = []

  for (const feature of features) {
    const ring = feature.geometry.coordinates[0] ?? []
    if (ring.length < 4) {
      continue
    }

    const ringWithoutClosure = ring.slice(0, -1)
    if (ringWithoutClosure.length < 3) {
      continue
    }

    const contour: THREE.Vector2[] = []
    const zValues: number[] = []
    let skipCell = false
    for (const [lon, lat] of ringWithoutClosure) {
      const z = interpolateRoofZ(roofMeshes, lon, lat, zExaggeration)
      if (z === null) {
        skipCell = true
        break
      }
      contour.push(new THREE.Vector2(lonToMercatorX(lon), latToMercatorY(lat)))
      zValues.push(z + HEATMAP_RENDER_EPSILON_M * meterInMercatorCoordinateUnits(lat))
    }
    if (skipCell || contour.length < 3) {
      continue
    }

    const triangles = THREE.ShapeUtils.triangulateShape(contour, [])
    if (triangles.length === 0) {
      continue
    }

    const [r, g, b] = heatmapColor(feature.properties.intensity)
    const baseIndex = positions.length / 3

    for (let i = 0; i < contour.length; i += 1) {
      positions.push(contour[i].x, contour[i].y, zValues[i])
      colors.push(r, g, b)
    }
    for (const [a, bIndex, c] of triangles) {
      indices.push(baseIndex + a, baseIndex + bIndex, baseIndex + c)
    }
  }

  if (indices.length === 0) {
    return null
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setIndex(indices)
  return geometry
}

class RoofHeatmapLayer implements maplibregl.CustomLayerInterface {
  id: string
  type = 'custom' as const
  renderingMode = '3d' as const
  private map: maplibregl.Map | null = null
  private gl: (WebGLRenderingContext | WebGL2RenderingContext) | null = null
  private scene: THREE.Scene | null = null
  private camera: THREE.Camera | null = null
  private renderer: THREE.WebGLRenderer | null = null
  private group: THREE.Group | null = null
  private material: THREE.MeshBasicMaterial | null = null
  private roofMeshes: RoofMeshData[] = []
  private heatmapFeatures: ShadeHeatmapFeature[] = []
  private zExaggeration = 1
  private visible = false

  constructor(id = 'roof-heatmap-layer') {
    this.id = id
  }

  onAdd(map: maplibregl.Map, gl: WebGLRenderingContext | WebGL2RenderingContext): void {
    this.map = map
    this.gl = gl
    this.scene = new THREE.Scene()
    this.camera = new THREE.Camera()
    this.group = new THREE.Group()
    this.scene.add(this.group)
    this.material = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.88,
      depthTest: true,
      depthWrite: false,
      side: THREE.FrontSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    })
    this.renderer = acquireSharedThreeRenderer(map, gl)
    this.rebuildGeometry()
  }

  onRemove(): void {
    if (this.group) {
      while (this.group.children.length > 0) {
        const child = this.group.children[this.group.children.length - 1]
        this.group.remove(child)
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose()
        }
      }
    }
    this.material?.dispose()
    if (this.gl) {
      releaseSharedThreeRenderer(this.gl)
    }
    this.map = null
    this.gl = null
    this.scene = null
    this.camera = null
    this.renderer = null
    this.group = null
    this.material = null
  }

  setRoofMeshes(meshes: RoofMeshData[]): void {
    this.roofMeshes = meshes
    this.rebuildGeometry()
  }

  setHeatmapFeatures(features: ShadeHeatmapFeature[]): void {
    this.heatmapFeatures = features
    this.rebuildGeometry()
  }

  setZExaggeration(zExaggeration: number): void {
    this.zExaggeration = Math.max(0.1, zExaggeration)
    this.rebuildGeometry()
  }

  setVisible(visible: boolean): void {
    this.visible = visible
    this.map?.triggerRepaint()
  }

  render(_gl: WebGLRenderingContext | WebGL2RenderingContext, options: maplibregl.CustomRenderMethodInput): void {
    if (!this.visible || !this.renderer || !this.scene || !this.camera) {
      return
    }
    const projectionMatrix = options.defaultProjectionData?.mainMatrix ?? options.modelViewProjectionMatrix
    this.camera.projectionMatrix.fromArray(projectionMatrix as ArrayLike<number>)
    this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert()
    this.camera.matrixWorld.identity()
    this.camera.matrixWorldInverse.identity()
    const canvas = this.map?.getCanvas()
    if (canvas) {
      this.renderer.setViewport(0, 0, canvas.width, canvas.height)
    }
    this.renderer.resetState()
    this.renderer.render(this.scene, this.camera)
  }

  private rebuildGeometry(): void {
    if (!this.group || !this.material) {
      return
    }
    while (this.group.children.length > 0) {
      const child = this.group.children[this.group.children.length - 1]
      this.group.remove(child)
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose()
      }
    }

    const geometry = buildHeatmapGeometry(this.roofMeshes, this.heatmapFeatures, this.zExaggeration)
    if (!geometry) {
      this.map?.triggerRepaint()
      return
    }
    const mesh = new THREE.Mesh(geometry, this.material)
    mesh.frustumCulled = false
    this.group.add(mesh)
    this.map?.triggerRepaint()
  }
}

export function useMapInstance({ onInitialized }: UseMapInstanceArgs): UseMapInstanceResult {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const roofLayerRef = useRef<WorldMeshLayer | null>(null)
  const obstacleLayerRef = useRef<WorldMeshLayer | null>(null)
  const heatmapLayerRef = useRef<RoofHeatmapLayer | null>(null)
  const mapLoadedRef = useRef(false)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [mapError, setMapError] = useState<string | null>(null)
  const onInitializedRef = useLatest(onInitialized)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return
    }

    const initialCenter = parseMapCenterFromHash(window.location.hash) ?? [20.8094, 52.1677]

    const map = new maplibregl.Map({
      container: containerRef.current,
      canvasContextAttributes: {
        antialias: true,
      },
      style: createMapStyle(),
      center: initialCenter,
      zoom: 18,
      pitch: 0,
      bearing: 0,
      maxPitch: MAX_ORBIT_PITCH_DEG,
    })

    map.addControl(new maplibregl.NavigationControl(), 'top-left')

    const handleLoad = () => {
      mapLoadedRef.current = true
      setMapError(null)
      setMapLoaded(true)
      const obstacleLayer = new WorldMeshLayer('obstacle-mesh-layer', {
        topColorHex: 0x9ca3af,
        wallColorHex: 0x6b7280,
        baseColorHex: 0x4b5563,
      }, {
        top: true,
        walls: true,
        base: false,
      })
      const roofLayer = new WorldMeshLayer(
        'roof-mesh-layer',
        {},
        {
          top: true,
          walls: false,
          base: false,
        },
      )
      const heatmapLayer = new RoofHeatmapLayer('roof-heatmap-layer')
      obstacleLayerRef.current = obstacleLayer
      roofLayerRef.current = roofLayer
      heatmapLayerRef.current = heatmapLayer
      map.addLayer(obstacleLayer)
      map.addLayer(roofLayer)
      map.addLayer(heatmapLayer)
      obstacleLayer.setZExaggeration(1)
      roofLayer.setZExaggeration(1)
      heatmapLayer.setZExaggeration(1)
      onInitializedRef.current?.()
    }
    const handleError = (event: { error?: Error }) => {
      if (!mapLoadedRef.current && event.error) {
        setMapError('Map failed to load. Check connection and tile availability.')
      }
    }

    const loadTimeout = window.setTimeout(() => {
      if (!mapLoadedRef.current) {
        setMapError('Map is taking too long to load. You can continue with sidebar-only actions.')
      }
    }, 12000)

    map.on('load', handleLoad)
    map.on('error', handleError)
    mapRef.current = map

    return () => {
      window.clearTimeout(loadTimeout)
      map.off('load', handleLoad)
      map.off('error', handleError)
      map.remove()
      mapRef.current = null
      roofLayerRef.current = null
      obstacleLayerRef.current = null
      heatmapLayerRef.current = null
      mapLoadedRef.current = false
      setMapLoaded(false)
    }
  }, [onInitializedRef])

  return { containerRef, mapRef, roofLayerRef, obstacleLayerRef, heatmapLayerRef, mapLoaded, mapError }
}
