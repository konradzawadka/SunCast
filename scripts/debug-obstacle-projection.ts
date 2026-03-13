import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { generateObstacleMesh } from '../src/geometry/mesh/generateObstacleMesh'
import { buildLocalOrigin, localMetersToLonLat, lonLatToLocalMeters } from '../src/geometry/projection/localMeters'
import { buildObstacleLayerGeometry } from '../src/rendering/roof-layer/layerGeometryAdapters'
import { resolveLayerAnchor, toLayerRelativePoint } from '../src/rendering/roof-layer/layerRebasing'
import type { ObstacleStateEntry } from '../src/types/geometry'

function readNumberEnv(name: string, defaultValue: number): number {
  const raw = process.env[name]
  if (!raw) {
    return defaultValue
  }
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : defaultValue
}

function toFloat32(value: number): number {
  return new Float32Array([value])[0]
}

function extent(values: number[]): { min: number; max: number; span: number } {
  const min = Math.min(...values)
  const max = Math.max(...values)
  return { min, max, span: max - min }
}

const baseLon = readNumberEnv('DEBUG_BASE_LON', 20)
const baseLat = readNumberEnv('DEBUG_BASE_LAT', 52)
const sizeXM = Math.max(0.01, readNumberEnv('DEBUG_SIZE_X_M', 1))
const sizeYM = Math.max(0.01, readNumberEnv('DEBUG_SIZE_Y_M', 1))
const heightM = Math.max(0, readNumberEnv('DEBUG_HEIGHT_M', 1))
const outputPath = resolve(process.cwd(), process.env.DEBUG_OUTPUT_PATH ?? 'test-results/obstacle-projection-snapshot.json')

const origin = buildLocalOrigin([[baseLon, baseLat]])
const polygon = [
  localMetersToLonLat(origin, { x: 0, y: 0 }),
  localMetersToLonLat(origin, { x: sizeXM, y: 0 }),
  localMetersToLonLat(origin, { x: sizeXM, y: sizeYM }),
  localMetersToLonLat(origin, { x: 0, y: sizeYM }),
]

const obstacle: ObstacleStateEntry = {
  id: 'debug-obstacle',
  kind: 'building',
  shape: {
    type: 'polygon-prism',
    polygon,
  },
  heightAboveGroundM: heightM,
}

const mesh = generateObstacleMesh(obstacle)
if (!mesh) {
  throw new Error('Failed to generate obstacle mesh.')
}

const world = buildObstacleLayerGeometry([mesh], 1)[0]
if (!world) {
  throw new Error('Failed to project obstacle mesh to world geometry.')
}

const layerAnchor = resolveLayerAnchor([world])
const localMeshVertices = mesh.vertices.map((vertex) => lonLatToLocalMeters(origin, [vertex.lon, vertex.lat]))

const absoluteWorldVertices = world.topVertices.map((vertex) => ({
  x: world.anchorX + vertex.x,
  y: world.anchorY + vertex.y,
  z: vertex.z,
}))
const legacyQuantizedAbsolute = absoluteWorldVertices.map((vertex) => ({
  x: toFloat32(vertex.x),
  y: toFloat32(vertex.y),
  z: toFloat32(vertex.z),
}))
const rebasedAttributes = world.topVertices.map((vertex) =>
  toLayerRelativePoint(world.anchorX, world.anchorY, vertex, layerAnchor),
)
const rebasedQuantizedAttributes = rebasedAttributes.map((vertex) => ({
  x: toFloat32(vertex.x),
  y: toFloat32(vertex.y),
  z: toFloat32(vertex.z),
}))

const localXExtent = extent(localMeshVertices.map((vertex) => vertex.x))
const localYExtent = extent(localMeshVertices.map((vertex) => vertex.y))
const absoluteXExtent = extent(absoluteWorldVertices.map((vertex) => vertex.x))
const absoluteYExtent = extent(absoluteWorldVertices.map((vertex) => vertex.y))
const legacyQuantizedXExtent = extent(legacyQuantizedAbsolute.map((vertex) => vertex.x))
const legacyQuantizedYExtent = extent(legacyQuantizedAbsolute.map((vertex) => vertex.y))
const rebasedQuantizedXExtent = extent(rebasedQuantizedAttributes.map((vertex) => vertex.x))
const rebasedQuantizedYExtent = extent(rebasedQuantizedAttributes.map((vertex) => vertex.y))

const snapshot = {
  input: {
    baseLon,
    baseLat,
    sizeXM,
    sizeYM,
    heightM,
  },
  obstaclePolygonLonLat: polygon,
  mesh: {
    vertexCount: mesh.vertices.length,
    triangleCount: mesh.triangleIndices.length / 3,
  },
  world: {
    anchorX: world.anchorX,
    anchorY: world.anchorY,
    unitsPerMeter: world.unitsPerMeter,
  },
  extents: {
    localMeters: {
      xSpanM: localXExtent.span,
      ySpanM: localYExtent.span,
    },
    worldAbsolute: {
      xSpan: absoluteXExtent.span,
      ySpan: absoluteYExtent.span,
    },
    legacyQuantizedWorldAbsolute: {
      xSpan: legacyQuantizedXExtent.span,
      ySpan: legacyQuantizedYExtent.span,
    },
    rebasedQuantizedAttributes: {
      xSpan: rebasedQuantizedXExtent.span,
      ySpan: rebasedQuantizedYExtent.span,
    },
  },
  precisionDiagnostics: {
    legacyQuantizedWidthMApprox: legacyQuantizedXExtent.span / world.unitsPerMeter,
    rebasedQuantizedWidthMApprox: rebasedQuantizedXExtent.span / world.unitsPerMeter,
  },
}

mkdirSync(dirname(outputPath), { recursive: true })
writeFileSync(outputPath, JSON.stringify(snapshot, null, 2), 'utf8')

console.log(`[debug-obstacle-projection] snapshot written: ${outputPath}`)
console.log(
  JSON.stringify(
    {
      localSizeM: snapshot.extents.localMeters,
      legacyQuantizedWorldAbsolute: snapshot.extents.legacyQuantizedWorldAbsolute,
      rebasedQuantizedAttributes: snapshot.extents.rebasedQuantizedAttributes,
      precisionDiagnostics: snapshot.precisionDiagnostics,
    },
    null,
    2,
  ),
)
