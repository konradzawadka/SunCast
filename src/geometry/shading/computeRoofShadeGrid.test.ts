import { describe, expect, it } from 'vitest'
import { computeSolarPosition } from '../sun/sunPosition'
import { computeRoofShadeGrid } from './computeRoofShadeGrid'
import { sunDirectionFromAzimuthElevation } from './shadowProjection'

const METERS_PER_DEG = 111_319.49079327358

function metersToLonLat(xM: number, yM: number): [number, number] {
  return [xM / METERS_PER_DEG, yM / METERS_PER_DEG]
}

describe('computeRoofShadeGrid', () => {
  it('computes roof shading grid and marks some cells shaded when an obstacle is on sun path', () => {
    const datetimeIso = '2026-03-20T09:00:00Z'
    const solar = computeSolarPosition(datetimeIso, 0, 0)
    expect(solar.sunElevationDeg).toBeGreaterThan(2)

    const sunDirection = sunDirectionFromAzimuthElevation(solar.sunAzimuthDeg, solar.sunElevationDeg)
    const horizontalNorm = Math.sqrt(sunDirection.x * sunDirection.x + sunDirection.y * sunDirection.y)

    const alongX = (sunDirection.x / horizontalNorm) * 2
    const alongY = (sunDirection.y / horizontalNorm) * 2
    const perpX = -(sunDirection.y / horizontalNorm) * 0.8
    const perpY = (sunDirection.x / horizontalNorm) * 0.8

    const result = computeRoofShadeGrid({
      datetimeIso,
      gridResolutionM: 0.8,
      roofs: [
        {
          roofId: 'roof-1',
          polygon: [
            metersToLonLat(-2, -2),
            metersToLonLat(2, -2),
            metersToLonLat(2, 2),
            metersToLonLat(-2, 2),
          ],
          vertexHeightsM: [1, 1, 1, 1],
        },
      ],
      obstacles: [
        {
          id: 'ob-1',
          kind: 'building',
          shape: 'prism',
          polygon: [
            metersToLonLat(alongX - perpX, alongY - perpY),
            metersToLonLat(alongX + perpX, alongY + perpY),
            metersToLonLat(alongX + perpX + sunDirection.x * 0.8, alongY + perpY + sunDirection.y * 0.8),
            metersToLonLat(alongX - perpX + sunDirection.x * 0.8, alongY - perpY + sunDirection.y * 0.8),
          ],
          heightAboveGroundM: 12,
        },
      ],
      maxShadowDistanceClampM: 60,
    })

    expect(result.status).toBe('OK')
    expect(result.roofs).toHaveLength(1)
    expect(result.diagnostics.sampleCount).toBeGreaterThan(0)

    const shadedCount = result.roofs[0].shadedCellCount
    const litCount = result.roofs[0].litCellCount
    expect(shadedCount + litCount).toBe(result.roofs[0].cells.length)
    expect(shadedCount).toBeGreaterThan(0)
  })

  it('returns SUN_BELOW_HORIZON for nighttime datetime', () => {
    const result = computeRoofShadeGrid({
      datetimeIso: '2026-03-20T00:30:00Z',
      gridResolutionM: 0.8,
      roofs: [
        {
          roofId: 'roof-1',
          polygon: [
            metersToLonLat(-2, -2),
            metersToLonLat(2, -2),
            metersToLonLat(2, 2),
            metersToLonLat(-2, 2),
          ],
          vertexHeightsM: [1, 1, 1, 1],
        },
      ],
      obstacles: [],
    })

    expect(result.status).toBe('SUN_BELOW_HORIZON')
    expect(result.roofs).toEqual([])
  })
})
