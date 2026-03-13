import { computeSolarPosition } from '../sun/sunPosition'
import { localMetersToLonLat } from '../projection/localMeters'
import { computeShadeSnapshot } from './computeShadeSnapshot'
import { prepareShadingScene } from './prepareShadingScene'
import type { ComputeRoofShadeGridInput, ComputeRoofShadeGridResult } from './types'

// Purpose: Encapsulates empty diagnostics behavior in one reusable function.
// Why: Improves readability by isolating a single responsibility behind a named function.
function emptyDiagnostics() {
  return {
    roofsProcessed: 0,
    roofsSkipped: 0,
    obstaclesProcessed: 0,
    sampleCount: 0,
    obstacleCandidatesChecked: 0,
  }
}

// Purpose: Encapsulates to status result behavior in one reusable function.
// Why: Improves readability by isolating a single responsibility behind a named function.
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

// Purpose: Computes compute roof shade grid deterministically from the provided input values.
// Why: Keeps domain rules explicit, testable, and deterministic.
export function computeRoofShadeGrid(input: ComputeRoofShadeGridInput): ComputeRoofShadeGridResult {
  if (!Number.isFinite(input.gridResolutionM) || input.gridResolutionM <= 0) {
    return toStatusResult('INVALID_GRID_RESOLUTION', 'Grid resolution must be a positive finite number')
  }

  if (input.roofs.length === 0) {
    return toStatusResult('NO_ROOFS', 'No roofs selected for shading computation')
  }

  const scene = prepareShadingScene({
    roofs: input.roofs,
    obstacles: input.obstacles,
    gridResolutionM: input.gridResolutionM,
    maxSampleCount: input.maxSampleCount,
    sampleOverflowStrategy: input.sampleOverflowStrategy,
    maxShadowDistanceClampM: input.maxShadowDistanceClampM,
  })

  if (!scene || scene.roofs.length === 0) {
    return toStatusResult('NO_ROOFS', 'No roof geometry available for shading computation')
  }

  const solar = computeSolarPosition(input.datetimeIso, scene.origin.lat0, scene.origin.lon0)
  const snapshot = computeShadeSnapshot({
    scene,
    sunAzimuthDeg: solar.sunAzimuthDeg,
    sunElevationDeg: solar.sunElevationDeg,
    lowSunElevationThresholdDeg: input.lowSunElevationThresholdDeg,
    maxShadowDistanceClampM: input.maxShadowDistanceClampM,
  })

  if (snapshot.status !== 'OK') {
    return toStatusResult(snapshot.status, snapshot.statusMessage, {
      origin: scene.origin,
      sunAzimuthDeg: snapshot.sunAzimuthDeg,
      sunElevationDeg: snapshot.sunElevationDeg,
      sunDirection: snapshot.sunDirection,
      diagnostics: snapshot.diagnostics,
    })
  }

  const roofSnapshotById = new Map(snapshot.roofs.map((roof) => [roof.roofId, roof]))

  const roofs: ComputeRoofShadeGridResult['roofs'] = scene.roofs.map((roof) => {
    const roofSnapshot = roofSnapshotById.get(roof.roofId)
    if (!roofSnapshot) {
      return {
        roofId: roof.roofId,
        shadedCellCount: 0,
        litCellCount: roof.samples.length,
        cells: roof.samples.map((sample) => ({
          roofId: roof.roofId,
          sample: { x: sample.x, y: sample.y, z: sample.z },
          shadeFactor: 0,
          cellPolygonLocal: sample.cellPolygonLocal,
          cellPolygon: sample.cellPolygonLocal.map((point) => localMetersToLonLat(scene.origin, point)),
        })),
      }
    }

    return {
      roofId: roof.roofId,
      shadedCellCount: roofSnapshot.shadedCellCount,
      litCellCount: roofSnapshot.litCellCount,
      cells: roof.samples.map((sample, index) => ({
        roofId: roof.roofId,
        sample: { x: sample.x, y: sample.y, z: sample.z },
        shadeFactor: roofSnapshot.shadeFactors[index] ?? 0,
        cellPolygonLocal: sample.cellPolygonLocal,
        cellPolygon: sample.cellPolygonLocal.map((point) => localMetersToLonLat(scene.origin, point)),
      })),
    }
  })

  return toStatusResult('OK', 'Shading grid computed', {
    origin: scene.origin,
    sunAzimuthDeg: snapshot.sunAzimuthDeg,
    sunElevationDeg: snapshot.sunElevationDeg,
    sunDirection: snapshot.sunDirection,
    roofs,
    diagnostics: snapshot.diagnostics,
  })
}
