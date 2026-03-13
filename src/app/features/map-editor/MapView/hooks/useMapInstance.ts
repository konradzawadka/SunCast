import { useEffect, useRef, useState, type RefObject } from 'react'
import maplibregl from 'maplibre-gl'
import * as THREE from 'three'
import type { ShadeHeatmapFeature } from '../../../../analysis/analysis.types'
import { WorldMeshLayer } from '../roof-layer/RoofMeshLayer'
import {
  buildRoofHeatmapOverlayGeometry,
  type RoofHeatmapOverlayGeometry,
} from '../roof-layer/roofHeatmapOverlay'
import type { RoofHeatmapOverlayWorkerResponse } from '../roof-layer/roofHeatmapOverlayWorker.types'
import { acquireSharedThreeRenderer, releaseSharedThreeRenderer } from '../roof-layer/sharedThreeRenderer'
import type { RoofMeshData } from '../../../../../types/geometry'
import { MAX_ORBIT_PITCH_DEG } from '../mapViewConstants'
import { createMapStyle } from '../createMapStyle'
import { parseMapCenterFromHash } from '../mapCenterFromHash'
import { useLatest } from '../useLatest'
import { reportAppErrorCode } from '../../../../../shared/errors'

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
}

// Purpose: Updates heatmap group in a controlled way.
// Why: Makes state transitions explicit and easier to reason about during edits.
function clearHeatmapGroup(group: THREE.Group): void {
  while (group.children.length > 0) {
    const child = group.children[group.children.length - 1]
    group.remove(child)
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose()
    }
  }
}

// Purpose: Encapsulates to three heatmap geometry behavior in one reusable function.
// Why: Improves readability by isolating a single responsibility behind a named function.
function toThreeHeatmapGeometry(data: RoofHeatmapOverlayGeometry): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(data.colors, 3))
  geometry.setIndex(new THREE.BufferAttribute(data.indices, 1))
  return geometry
}

// Purpose: Builds heatmap geometry from the provided inputs.
// Why: Centralizes object/geometry construction and avoids duplicated assembly logic.
export function buildHeatmapGeometry(
  roofMeshes: RoofMeshData[],
  features: ShadeHeatmapFeature[],
  zExaggeration: number,
): { geometry: THREE.BufferGeometry; anchorX: number; anchorY: number } | null {
  const overlay = buildRoofHeatmapOverlayGeometry(roofMeshes, features, zExaggeration)
  if (!overlay) {
    return null
  }
  return { geometry: toThreeHeatmapGeometry(overlay), anchorX: overlay.anchorX, anchorY: overlay.anchorY }
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
  private worker: Worker | null = null
  private rebuildRequestId = 0
  private layerAnchorX = 0
  private layerAnchorY = 0
  private layerRebaseMatrix = new THREE.Matrix4()
  private reportedWorkerUnavailable = false
  private reportedWorkerFailure = false
  private reportedWorkerDispatchFailure = false

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
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    })
    this.renderer = acquireSharedThreeRenderer(map, gl)
    this.initWorker()
    this.requestGeometryRebuild()
  }

  onRemove(): void {
    if (this.group) {
      clearHeatmapGroup(this.group)
    }
    this.material?.dispose()
    if (this.gl) {
      releaseSharedThreeRenderer(this.gl)
    }
    this.worker?.terminate()
    this.worker = null
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
    this.requestGeometryRebuild()
  }

  setHeatmapFeatures(features: ShadeHeatmapFeature[]): void {
    this.heatmapFeatures = features
    this.requestGeometryRebuild()
  }

  setZExaggeration(zExaggeration: number): void {
    this.zExaggeration = Math.max(0.1, zExaggeration)
    this.requestGeometryRebuild()
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
    this.layerRebaseMatrix.makeTranslation(this.layerAnchorX, this.layerAnchorY, 0)
    this.camera.projectionMatrix.multiply(this.layerRebaseMatrix)
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

  private initWorker(): void {
    if (typeof Worker === 'undefined') {
      this.setDegraded(
        'Heatmap worker is unavailable. Heatmap processing stopped.',
        'worker-unavailable',
        'Worker constructor is not available in this runtime.',
      )
      return
    }
    this.worker = new Worker(new URL('../roof-layer/roofHeatmapOverlay.worker.ts', import.meta.url), {
      type: 'module',
    })
    this.worker.onmessage = (event: MessageEvent<RoofHeatmapOverlayWorkerResponse>) => {
      const { requestId, geometry, error } = event.data
      if (error) {
        console.error(`Roof heatmap worker failed: ${error}`)
        this.setDegraded('Heatmap worker failed. Heatmap processing stopped.', 'worker-failed', error)
        if (requestId === this.rebuildRequestId) {
          this.applyOverlayGeometry(requestId, null)
        }
        return
      }
      this.applyOverlayGeometry(requestId, geometry)
    }
  }

  private requestGeometryRebuild(): void {
    if (!this.group || !this.material) {
      return
    }
    const requestId = this.rebuildRequestId + 1
    this.rebuildRequestId = requestId

    if (this.worker) {
      try {
        this.worker.postMessage({
          requestId,
          roofMeshes: this.roofMeshes,
          heatmapFeatures: this.heatmapFeatures,
          zExaggeration: this.zExaggeration,
        })
        return
      } catch (error) {
        console.error('Failed to dispatch roof heatmap worker job', error)
        this.setDegraded('Heatmap worker dispatch failed. Heatmap processing stopped.', 'dispatch-failed', error)
        this.worker.terminate()
        this.worker = null
      }
    }

    this.applyOverlayGeometry(requestId, null)
  }

  private setDegraded(message: string, reason: 'worker-unavailable' | 'worker-failed' | 'dispatch-failed', cause: unknown): void {
    const shouldReport =
      (reason === 'worker-unavailable' && !this.reportedWorkerUnavailable) ||
      (reason === 'worker-failed' && !this.reportedWorkerFailure) ||
      (reason === 'dispatch-failed' && !this.reportedWorkerDispatchFailure)
    if (!shouldReport) {
      return
    }

    if (reason === 'worker-unavailable') {
      this.reportedWorkerUnavailable = true
    } else if (reason === 'worker-failed') {
      this.reportedWorkerFailure = true
    } else {
      this.reportedWorkerDispatchFailure = true
    }
    reportAppErrorCode('HEATMAP_WORKER_UNAVAILABLE', message, {
      cause,
      context: { area: 'roof-heatmap-layer', reason, enableStateReset: true },
    })
  }

  private applyOverlayGeometry(requestId: number, overlay: RoofHeatmapOverlayGeometry | null): void {
    if (requestId !== this.rebuildRequestId || !this.group || !this.material) {
      return
    }

    clearHeatmapGroup(this.group)

    if (!overlay) {
      this.layerAnchorX = 0
      this.layerAnchorY = 0
      this.map?.triggerRepaint()
      return
    }

    this.layerAnchorX = overlay.anchorX
    this.layerAnchorY = overlay.anchorY
    const mesh = new THREE.Mesh(toThreeHeatmapGeometry(overlay), this.material)
    mesh.position.set(0, 0, 0)
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
  const hasReportedMapInitErrorRef = useRef(false)
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
      
      map.addLayer(roofLayer)
      map.addLayer(heatmapLayer)
      map.addLayer(obstacleLayer)
      obstacleLayer.setZExaggeration(1)
      roofLayer.setZExaggeration(1)
      heatmapLayer.setZExaggeration(1)
      onInitializedRef.current?.()
    }
    const handleError = (event: { error?: Error }) => {
      if (!mapLoadedRef.current && event.error) {
        if (!hasReportedMapInitErrorRef.current) {
          hasReportedMapInitErrorRef.current = true
          reportAppErrorCode('MAP_INIT_FAILED', 'Map failed to load.', {
            cause: event.error,
            context: { area: 'map-view', reason: 'maplibre-load-error', enableStateReset: true },
          })
        }
      }
    }

    const loadTimeout = window.setTimeout(() => {
      if (!mapLoadedRef.current) {
        if (!hasReportedMapInitErrorRef.current) {
          hasReportedMapInitErrorRef.current = true
          reportAppErrorCode('MAP_INIT_FAILED', 'Map load timed out.', {
            context: { area: 'map-view', reason: 'maplibre-load-timeout', enableStateReset: true },
          })
        }
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
      hasReportedMapInitErrorRef.current = false
    }
  }, [onInitializedRef])

  return { containerRef, mapRef, roofLayerRef, obstacleLayerRef, heatmapLayerRef, mapLoaded }
}
