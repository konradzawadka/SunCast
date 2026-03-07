import maplibregl from 'maplibre-gl'
import * as THREE from 'three'
import type { RoofMeshData } from '../../types/geometry'
import { buildRoofWorldGeometry, type RoofWorldMeshGeometry } from './roofWorldGeometry'
import { acquireSharedThreeRenderer, releaseSharedThreeRenderer } from './sharedThreeRenderer'

const RENDER_EPSILON_M = 0.05
const TOP_COLOR_HEX = 0xff6155
const WALL_COLOR_HEX = 0xe63a33
const BASE_COLOR_HEX = 0xbf3a35

function createTopGeometry(world: RoofWorldMeshGeometry): THREE.BufferGeometry | null {
  if (world.topVertices.length < 3 || world.triangleIndices.length < 3) {
    return null
  }

  const zEpsilon = RENDER_EPSILON_M * world.unitsPerMeter
  const positions = new Float32Array(world.topVertices.length * 3)
  for (let i = 0; i < world.topVertices.length; i += 1) {
    const vertex = world.topVertices[i]
    const baseIndex = i * 3
    positions[baseIndex] = vertex.x
    positions[baseIndex + 1] = vertex.y
    positions[baseIndex + 2] = vertex.z + zEpsilon
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setIndex(world.triangleIndices)
  geometry.computeVertexNormals()
  return geometry
}

function createWallGeometry(world: RoofWorldMeshGeometry): THREE.BufferGeometry | null {
  if (world.topVertices.length < 3 || world.baseVertices.length < 3) {
    return null
  }

  const wallPositions: number[] = []
  const vertexCount = world.topVertices.length

  for (let i = 0; i < vertexCount; i += 1) {
    const topCurrent = world.topVertices[i]
    const topNext = world.topVertices[(i + 1) % vertexCount]
    const baseCurrent = world.baseVertices[i]
    const baseNext = world.baseVertices[(i + 1) % vertexCount]

    wallPositions.push(topCurrent.x, topCurrent.y, topCurrent.z)
    wallPositions.push(topNext.x, topNext.y, topNext.z)
    wallPositions.push(baseNext.x, baseNext.y, baseNext.z)

    wallPositions.push(topCurrent.x, topCurrent.y, topCurrent.z)
    wallPositions.push(baseNext.x, baseNext.y, baseNext.z)
    wallPositions.push(baseCurrent.x, baseCurrent.y, baseCurrent.z)
  }

  if (wallPositions.length === 0) {
    return null
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(wallPositions, 3))
  geometry.computeVertexNormals()
  return geometry
}

function createBaseGeometry(world: RoofWorldMeshGeometry): THREE.BufferGeometry | null {
  if (world.baseVertices.length < 3 || world.triangleIndices.length < 3) {
    return null
  }

  const positions = new Float32Array(world.baseVertices.length * 3)
  for (let i = 0; i < world.baseVertices.length; i += 1) {
    const vertex = world.baseVertices[i]
    const baseIndex = i * 3
    positions[baseIndex] = vertex.x
    positions[baseIndex + 1] = vertex.y
    positions[baseIndex + 2] = vertex.z
  }

  const reversedIndices: number[] = []
  for (let i = 0; i < world.triangleIndices.length; i += 3) {
    const a = world.triangleIndices[i]
    const b = world.triangleIndices[i + 1]
    const c = world.triangleIndices[i + 2]
    if (a === undefined || b === undefined || c === undefined) {
      continue
    }
    reversedIndices.push(a, c, b)
  }

  if (reversedIndices.length < 3) {
    return null
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setIndex(reversedIndices)
  geometry.computeVertexNormals()
  return geometry
}

function disposeGroupGeometry(group: THREE.Group): void {
  while (group.children.length > 0) {
    const child = group.children[group.children.length - 1]
    group.remove(child)
    if (child instanceof THREE.Mesh && child.geometry) {
      child.geometry.dispose()
    }
  }
}

export class RoofMeshLayer implements maplibregl.CustomLayerInterface {
  id: string
  type = 'custom' as const
  renderingMode = '3d' as const

  private map: maplibregl.Map | null = null
  private gl: (WebGLRenderingContext | WebGL2RenderingContext) | null = null
  private meshes: RoofMeshData[] = []
  private zExaggeration = 1
  private scene: THREE.Scene | null = null
  private camera: THREE.Camera | null = null
  private renderer: THREE.WebGLRenderer | null = null
  private roofGroup: THREE.Group | null = null
  private topMaterial: THREE.MeshBasicMaterial | null = null
  private wallMaterial: THREE.MeshBasicMaterial | null = null
  private baseMaterial: THREE.MeshBasicMaterial | null = null
  private visible = true

  constructor(id = 'roof-mesh-layer') {
    this.id = id
  }

  onAdd(map: maplibregl.Map, gl: WebGLRenderingContext | WebGL2RenderingContext): void {
    this.map = map
    this.gl = gl

    this.scene = new THREE.Scene()
    this.camera = new THREE.Camera()
    this.roofGroup = new THREE.Group()
    this.scene.add(this.roofGroup)

    this.topMaterial = new THREE.MeshBasicMaterial({
      color: TOP_COLOR_HEX,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
    })
    this.wallMaterial = new THREE.MeshBasicMaterial({
      color: WALL_COLOR_HEX,
      transparent: true,
      opacity: 0.92,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
    })
    this.baseMaterial = new THREE.MeshBasicMaterial({
      color: BASE_COLOR_HEX,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
    })

    this.renderer = acquireSharedThreeRenderer(map, gl)

    this.rebuildGeometry()
  }

  onRemove(): void {
    if (this.roofGroup) {
      disposeGroupGeometry(this.roofGroup)
    }
    this.topMaterial?.dispose()
    this.wallMaterial?.dispose()
    this.baseMaterial?.dispose()
    if (this.gl) {
      releaseSharedThreeRenderer(this.gl)
    }

    this.topMaterial = null
    this.wallMaterial = null
    this.baseMaterial = null
    this.roofGroup = null
    this.renderer = null
    this.scene = null
    this.camera = null
    this.gl = null
    this.map = null
  }

  setMeshes(meshes: RoofMeshData[]): void {
    this.meshes = meshes
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
    if (!this.visible || !this.renderer || !this.camera || !this.scene) {
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
    if (!this.roofGroup || !this.topMaterial || !this.wallMaterial || !this.baseMaterial) {
      return
    }

    disposeGroupGeometry(this.roofGroup)

    for (const mesh of this.meshes) {
      const worldGeometry = buildRoofWorldGeometry(mesh, this.zExaggeration)
      if (!worldGeometry) {
        continue
      }

      const topGeometry = createTopGeometry(worldGeometry)
      if (topGeometry) {
        const topMesh = new THREE.Mesh(topGeometry, this.topMaterial)
        topMesh.frustumCulled = false
        this.roofGroup.add(topMesh)
      }

      const wallGeometry = createWallGeometry(worldGeometry)
      if (wallGeometry) {
        const wallMesh = new THREE.Mesh(wallGeometry, this.wallMaterial)
        wallMesh.frustumCulled = false
        this.roofGroup.add(wallMesh)
      }

      const baseGeometry = createBaseGeometry(worldGeometry)
      if (baseGeometry) {
        const baseMesh = new THREE.Mesh(baseGeometry, this.baseMaterial)
        baseMesh.frustumCulled = false
        this.roofGroup.add(baseMesh)
      }
    }

    this.map?.triggerRepaint()
  }
}
