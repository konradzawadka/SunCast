import { computeSolarPosition } from '../sun/sunPosition'
import { buildLocalOrigin, localMetersToLonLat, lonLatToLocalMeters } from '../projection/localMeters'
import { normalizeObstaclesToPrisms } from './obstacleVolumes'
import { buildRoofSurfaceFromLocalVertices, sampleRoofGrid } from './roofSampling'
import { isPointShaded } from './shadeAtPoint'
import { bboxesIntersect, computeMaxShadowDistanceM, expandBbox, sunDirectionFromAzimuthElevation } from './shadowProjection'
import type {
  ComputeRoofShadeGridInput,
  ComputeRoofShadeGridResult,
  LocalRoofSurface,
  ObstaclePrism,
  ShadingRoofInput,
} from './types'

const DEFAULT_LOW_SUN_THRESHOLD_DEG = 2
const DEFAULT_MAX_SHADOW_DISTANCE_CLAMP_M = 300

function emptyDiagnostics() {
  return {
    roofsProcessed: 0,
    roofsSkipped: 0,
    obstaclesProcessed: 0,
    sampleCount: 0,
    obstacleCandidatesChecked: 0,
  }
}

function toStatusResult(
  status: ComputeRoofShadeGridResult['status'],
  statusMessage: string,
  partial?: Partial<ComputeRoofShadeGridResult>,
): ComputeRoofShadeGridResult {
  return {
    status,
    statusMessage,
    origin: partial?.origin ?? null,
    sunAzimuthDeg: partial?.sunAzimuthDeg ?? null,
    sunElevationDeg: partial?.sunElevationDeg ?? null,
    sunDirection: partial?.sunDirection ?? null,
    roofs: partial?.roofs ?? [],
    diagnostics: partial?.diagnostics ?? emptyDiagnostics(),
  }
}

function allRoofAndObstaclePoints(input: ComputeRoofShadeGridInput): Array<[number, number]> {
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

function prefilterObstaclesForRoof(roof: LocalRoofSurface, obstacles: ObstaclePrism[], maxShadowDistanceM: number): ObstaclePrism[] {
  const searchBounds = expandBbox(roof.bbox, maxShadowDistanceM)
  return obstacles.filter((obstacle) => bboxesIntersect(searchBounds, obstacle.bbox))
}

export function computeRoofShadeGrid(input: ComputeRoofShadeGridInput): ComputeRoofShadeGridResult {
  if (!Number.isFinite(input.gridResolutionM) || input.gridResolutionM <= 0) {
    return toStatusResult('INVALID_GRID_RESOLUTION', 'Grid resolution must be a positive finite number')
  }

  if (input.roofs.length === 0) {
    return toStatusResult('NO_ROOFS', 'No roofs selected for shading computation')
  }

  const allPoints = allRoofAndObstaclePoints(input)
  if (allPoints.length === 0) {
    return toStatusResult('NO_ROOFS', 'No roof geometry available for shading computation')
  }

  const origin = buildLocalOrigin(allPoints)
  const solar = computeSolarPosition(input.datetimeIso, origin.lat0, origin.lon0)

  if (solar.sunElevationDeg <= 0) {
    return toStatusResult('SUN_BELOW_HORIZON', 'Sun is below horizon for selected datetime', {
      origin,
      sunAzimuthDeg: solar.sunAzimuthDeg,
      sunElevationDeg: solar.sunElevationDeg,
      diagnostics: emptyDiagnostics(),
    })
  }

  const lowSunThresholdDeg =
    Number.isFinite(input.lowSunElevationThresholdDeg) && input.lowSunElevationThresholdDeg !== undefined
      ? input.lowSunElevationThresholdDeg
      : DEFAULT_LOW_SUN_THRESHOLD_DEG

  if (solar.sunElevationDeg < lowSunThresholdDeg) {
    return toStatusResult('SUN_TOO_LOW', `Sun elevation ${solar.sunElevationDeg.toFixed(2)} deg is below threshold`, {
      origin,
      sunAzimuthDeg: solar.sunAzimuthDeg,
      sunElevationDeg: solar.sunElevationDeg,
      diagnostics: emptyDiagnostics(),
    })
  }

  const sunDirection = sunDirectionFromAzimuthElevation(solar.sunAzimuthDeg, solar.sunElevationDeg)
  const localRoofs = normalizeRoofsToLocal(origin, input.roofs)
  const obstacles = normalizeObstaclesToPrisms(origin, input.obstacles)

  const maxObstacleHeightM = obstacles.reduce((maxHeight, obstacle) => Math.max(maxHeight, obstacle.heightAboveGroundM), 0)
  const maxShadowDistanceClampM =
    Number.isFinite(input.maxShadowDistanceClampM) && input.maxShadowDistanceClampM !== undefined
      ? input.maxShadowDistanceClampM
      : DEFAULT_MAX_SHADOW_DISTANCE_CLAMP_M

  const maxShadowDistanceM = computeMaxShadowDistanceM(maxObstacleHeightM, solar.sunElevationDeg, maxShadowDistanceClampM)
  const diagnostics = {
    roofsProcessed: 0,
    roofsSkipped: input.roofs.length - localRoofs.length,
    obstaclesProcessed: obstacles.length,
    sampleCount: 0,
    obstacleCandidatesChecked: 0,
  }

  const roofResults: ComputeRoofShadeGridResult['roofs'] = []

  for (const roof of localRoofs) {
    const samples = sampleRoofGrid(roof, input.gridResolutionM)
    const obstacleCandidates = prefilterObstaclesForRoof(roof, obstacles, maxShadowDistanceM)

    diagnostics.roofsProcessed += 1
    diagnostics.sampleCount += samples.length
    diagnostics.obstacleCandidatesChecked += obstacleCandidates.length * samples.length

    let shadedCellCount = 0
    let litCellCount = 0

    const cells = samples.map((sample) => {
      const shaded =
        obstacleCandidates.length > 0 &&
        maxShadowDistanceM > 0 &&
        isPointShaded({
          sample,
          sunDirection,
          obstacles: obstacleCandidates,
          maxShadowDistanceM,
        })

      if (shaded) {
        shadedCellCount += 1
      } else {
        litCellCount += 1
      }

      return {
        roofId: roof.roofId,
        sample: {
          x: sample.x,
          y: sample.y,
          z: sample.z,
        },
        shadeFactor: shaded ? (1 as const) : (0 as const),
        cellPolygonLocal: sample.cellPolygonLocal,
        cellPolygon: sample.cellPolygonLocal.map((point) => localMetersToLonLat(origin, point)),
      }
    })

    roofResults.push({
      roofId: roof.roofId,
      shadedCellCount,
      litCellCount,
      cells,
    })
  }

  return toStatusResult('OK', 'Shading grid computed', {
    origin,
    sunAzimuthDeg: solar.sunAzimuthDeg,
    sunElevationDeg: solar.sunElevationDeg,
    sunDirection,
    roofs: roofResults,
    diagnostics,
  })
}
