import { buildLocalOrigin, lonLatToLocalMeters } from '../projection/localMeters'
import { normalizeObstaclesToPrisms } from './obstacleVolumes'
import { buildRoofSurfaceFromLocalVertices, sampleRoofGrid } from './roofSampling'
import { bboxesIntersect, expandBbox } from './shadowProjection'
import { DEFAULT_MAX_SHADOW_DISTANCE_CLAMP_M } from './constants'
import type {
  LocalRoofSurface,
  ObstaclePrism,
  PrepareShadingSceneInput,
  PreparedShadingRoof,
  PreparedShadingScene,
  ShadingRoofInput,
} from './types'

// Purpose: Encapsulates all roof and obstacle points behavior in one reusable function.
// Why: Improves readability by isolating a single responsibility behind a named function.
function allRoofAndObstaclePoints(input: Pick<PrepareShadingSceneInput, 'roofs' | 'obstacles'>): Array<[number, number]> {
  const points: Array<[number, number]> = []

  for (const roof of input.roofs) {
    for (const point of roof.polygon) {
      points.push(point)
    }
  }

  for (const obstacle of input.obstacles) {
    if (obstacle.shape === 'prism') {
      for (const point of obstacle.polygon) {
        points.push(point)
      }
    } else {
      points.push(obstacle.center)
    }
  }

  return points
}

// Purpose: Computes normalize roofs to local deterministically from the provided input values.
// Why: Keeps domain rules explicit, testable, and deterministic.
function normalizeRoofsToLocal(origin: ReturnType<typeof buildLocalOrigin>, roofs: ShadingRoofInput[]): LocalRoofSurface[] {
  const localRoofs: LocalRoofSurface[] = []

  for (const roof of roofs) {
    if (!Array.isArray(roof.polygon) || roof.polygon.length < 3 || roof.polygon.length !== roof.vertexHeightsM.length) {
      continue
    }

    const polygonLocal = roof.polygon.map((point) => lonLatToLocalMeters(origin, point))
    localRoofs.push(buildRoofSurfaceFromLocalVertices(roof.roofId, polygonLocal, roof.vertexHeightsM))
  }

  return localRoofs
}

// Purpose: Encapsulates prefilter obstacles for roof behavior in one reusable function.
// Why: Improves readability by isolating a single responsibility behind a named function.
function prefilterObstaclesForRoof(roof: LocalRoofSurface, obstacles: ObstaclePrism[], maxShadowDistanceM: number): ObstaclePrism[] {
  const searchBounds = expandBbox(roof.bbox, maxShadowDistanceM)
  return obstacles.filter((obstacle) => bboxesIntersect(searchBounds, obstacle.bbox))
}

// Purpose: Encapsulates prepare shading scene behavior in one reusable function.
// Why: Improves readability by isolating a single responsibility behind a named function.
export function prepareShadingScene(input: PrepareShadingSceneInput): PreparedShadingScene | null {
  if (!Number.isFinite(input.gridResolutionM) || input.gridResolutionM <= 0) {
    return null
  }

  if (input.roofs.length === 0) {
    return null
  }

  const allPoints = allRoofAndObstaclePoints(input)
  if (allPoints.length === 0) {
    return null
  }

  const origin = buildLocalOrigin(allPoints)
  const localRoofs = normalizeRoofsToLocal(origin, input.roofs)
  const obstacles = normalizeObstaclesToPrisms(origin, input.obstacles)

  const maxObstacleHeightM = obstacles.reduce((maxHeight, obstacle) => Math.max(maxHeight, obstacle.heightAboveGroundM), 0)
  const maxShadowDistanceClampM =
    Number.isFinite(input.maxShadowDistanceClampM) && input.maxShadowDistanceClampM !== undefined
      ? input.maxShadowDistanceClampM
      : DEFAULT_MAX_SHADOW_DISTANCE_CLAMP_M

  const roofs: PreparedShadingRoof[] = []
  const diagnostics = {
    roofsProcessed: 0,
    roofsSkipped: input.roofs.length - localRoofs.length,
    obstaclesProcessed: obstacles.length,
    sampleCount: 0,
    obstacleCandidatesChecked: 0,
  }

  for (const roof of localRoofs) {
    const samples = sampleRoofGrid(roof, input.gridResolutionM, {
      maxSampleCount: input.maxSampleCount,
      overflowStrategy: input.sampleOverflowStrategy,
    })
    const obstacleCandidates = prefilterObstaclesForRoof(roof, obstacles, maxShadowDistanceClampM)

    roofs.push({
      roofId: roof.roofId,
      surface: roof,
      samples,
      obstacleCandidates,
    })

    diagnostics.roofsProcessed += 1
    diagnostics.sampleCount += samples.length
    diagnostics.obstacleCandidatesChecked += obstacleCandidates.length * samples.length
  }

  return {
    origin,
    roofs,
    obstacles,
    maxObstacleHeightM,
    maxShadowDistanceClampM,
    diagnostics,
  }
}
