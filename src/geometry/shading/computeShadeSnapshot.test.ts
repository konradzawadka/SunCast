import { describe, expect, it } from 'vitest'
import { prepareShadingScene } from './prepareShadingScene'
import { computeShadeSnapshot } from './computeShadeSnapshot'
import { sunDirectionFromAzimuthElevation } from './shadowProjection'

const METERS_PER_DEG = 111_319.49079327358

function metersToLonLat(xM: number, yM: number): [number, number] {
  return [xM / METERS_PER_DEG, yM / METERS_PER_DEG]
}

describe('computeShadeSnapshot', () => {
  it('does not mark cells as direct-sun lit when sun is behind roof plane', () => {
    const scene = prepareShadingScene({
      gridResolutionM: 1,
      roofs: [
        {
          roofId: 'roof-1',
          polygon: [
            metersToLonLat(-2, -2),
            metersToLonLat(2, -2),
            metersToLonLat(2, 2),
            metersToLonLat(-2, 2),
          ],
          vertexHeightsM: [0, 4, 4, 0],
        },
      ],
      obstacles: [],
    })

    expect(scene).not.toBeNull()
    if (!scene) {
      throw new Error('Expected valid scene')
    }

    const sunDirection = sunDirectionFromAzimuthElevation(90, 20)
    const plane = scene.roofs[0].surface.plane
    const normalLength = Math.sqrt(plane.p * plane.p + plane.q * plane.q + 1)
    const roofNormal = {
      x: -plane.p / normalLength,
      y: -plane.q / normalLength,
      z: 1 / normalLength,
    }
    const cosIncidence =
      roofNormal.x * sunDirection.x + roofNormal.y * sunDirection.y + roofNormal.z * sunDirection.z

    expect(cosIncidence).toBeLessThan(0)

    const snapshot = computeShadeSnapshot({
      scene,
      sunAzimuthDeg: 90,
      sunElevationDeg: 20,
      lowSunElevationThresholdDeg: 2,
      maxShadowDistanceClampM: 300,
    })

    expect(snapshot.status).toBe('OK')
    expect(snapshot.roofs).toHaveLength(1)
    expect(snapshot.roofs[0].litCellCount).toBe(0)
    expect(snapshot.roofs[0].shadedCellCount).toBe(snapshot.roofs[0].shadeFactors.length)
    expect(snapshot.roofs[0].shadeFactors.every((factor) => factor === 1)).toBe(true)
  })
})
