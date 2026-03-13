import maplibregl from 'maplibre-gl'
import * as THREE from 'three'
import type { RoofMeshData } from '../../types/geometry'
import type { ShadeHeatmapFeature } from '../../app/analysis/analysis.types'
import type { RoofHeatmapOverlayWorkerResponse } from '../../app/features/map-editor/MapView/roof-layer/roofHeatmapOverlayWorker.types'
import type { RoofHeatmapOverlayGeometry } from '../../app/features/map-editor/MapView/roof-layer/roofHeatmapOverlay'
import { acquireSharedThreeRenderer, releaseSharedThreeRenderer } from '../../app/features/map-editor/MapView/roof-layer/sharedThreeRenderer'
import { reportAppErrorCode } from '../../shared/errors'
import { clearHeatmapGroup, toThreeHeatmapGeometry } from './heatmapGeometry'

export class RoofHeatmapLayer implements maplibregl.CustomLayerInterface {
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
    this.worker = new Worker(
      new URL('../../app/features/map-editor/MapView/roof-layer/roofHeatmapOverlay.worker.ts', import.meta.url),
      {
        type: 'module',
      },
    )
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

  private setDegraded(
    message: string,
    reason: 'worker-unavailable' | 'worker-failed' | 'dispatch-failed',
    cause: unknown,
  ): void {
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
