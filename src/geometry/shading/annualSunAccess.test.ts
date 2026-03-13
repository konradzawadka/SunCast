import { describe, expect, it } from 'vitest'
import { computeAnnualSunAccess } from './annualSunAccess'
import { prepareShadingScene } from './prepareShadingScene'

const METERS_PER_DEG = 111_319.49079327358

function metersToLonLat(xM: number, yM: number): [number, number] {
  return [xM / METERS_PER_DEG, yM / METERS_PER_DEG]
}

function makeScene(withBlockingObstacle = false) {
  const roofPolygon = [
    metersToLonLat(-2, -2),
    metersToLonLat(2, -2),
    metersToLonLat(2, 2),
    metersToLonLat(-2, 2),
  ] as Array<[number, number]>

  const scene = prepareShadingScene({
    gridResolutionM: 1,
    roofs: [
      {
        roofId: 'roof-1',
        polygon: roofPolygon,
        vertexHeightsM: [1, 1, 1, 1],
      },
    ],
    obstacles: withBlockingObstacle
      ? [
          {
            id: 'ob-1',
            kind: 'building',
            shape: 'prism' as const,
            polygon: roofPolygon,
            heightAboveGroundM: 12,
          },
        ]
      : [],
  })

  expect(scene).not.toBeNull()
  if (!scene) {
    throw new Error('Expected valid scene')
  }

  return scene
}

describe('computeAnnualSunAccess', () => {
  it('returns fully lit metrics for an unobstructed roof', () => {
    const scene = makeScene(false)
    const result = computeAnnualSunAccess({
      scene,
      year: 2026,
      timeZone: 'UTC',
      halfYearMirror: true,
      sampleWindowDays: 30,
      stepMinutes: 120,
    })

    expect(result).not.toBeNull()
    if (!result) {
      return
    }

    expect(result.roofs).toHaveLength(1)
    expect(result.roofs[0].daylightHours).toBeGreaterThan(0)
    expect(result.roofs[0].sunAccessRatio).toBeCloseTo(1, 8)
    expect(result.heatmapCells.length).toBe(scene.roofs[0].samples.length)
    for (const cell of result.heatmapCells) {
      expect(cell.litRatio).toBeCloseTo(1, 8)
    }
  })

  it('reports lower sun access when a blocking obstacle is present', () => {
    const clearScene = makeScene(false)
    const obstructedScene = makeScene(true)

    const clear = computeAnnualSunAccess({
      scene: clearScene,
      year: 2026,
      timeZone: 'UTC',
      halfYearMirror: true,
      sampleWindowDays: 20,
      stepMinutes: 90,
    })
    const obstructed = computeAnnualSunAccess({
      scene: obstructedScene,
      year: 2026,
      timeZone: 'UTC',
      halfYearMirror: true,
      sampleWindowDays: 20,
      stepMinutes: 90,
    })

    expect(clear).not.toBeNull()
    expect(obstructed).not.toBeNull()
    if (!clear || !obstructed) {
      return
    }

    expect(obstructed.roofs[0].sunAccessRatio).toBeLessThan(clear.roofs[0].sunAccessRatio)
    expect(obstructed.roofs[0].sunAccessRatio).toBeLessThan(0.5)
  })

  it('keeps mirrored-half-year estimation close to a full-year run', () => {
    const scene = makeScene(false)

    const mirrored = computeAnnualSunAccess({
      scene,
      year: 2026,
      timeZone: 'UTC',
      halfYearMirror: true,
      sampleWindowDays: 10,
      stepMinutes: 60,
    })

    const full = computeAnnualSunAccess({
      scene,
      year: 2026,
      timeZone: 'UTC',
      halfYearMirror: false,
      sampleWindowDays: 10,
      stepMinutes: 60,
    })

    expect(mirrored).not.toBeNull()
    expect(full).not.toBeNull()
    if (!mirrored || !full) {
      return
    }

    const daylightDelta = Math.abs(mirrored.roofs[0].daylightHours - full.roofs[0].daylightHours)
    expect(daylightDelta / full.roofs[0].daylightHours).toBeLessThan(0.15)
  })

  it('excludes all daylight when low-sun threshold is set above possible elevations', () => {
    const scene = makeScene(false)
    const result = computeAnnualSunAccess({
      scene,
      year: 2026,
      timeZone: 'UTC',
      halfYearMirror: false,
      sampleWindowDays: 30,
      stepMinutes: 120,
      lowSunElevationThresholdDeg: 95,
    })

    expect(result).not.toBeNull()
    if (!result) {
      return
    }

    expect(result.roofs[0].daylightHours).toBe(0)
    expect(result.roofs[0].sunHours).toBe(0)
    expect(result.roofs[0].sunAccessRatio).toBe(0)
    expect(result.heatmapCells.every((cell) => cell.litRatio === 0)).toBeTruthy()
  })

  it('supports explicit date range simulation between date1 and date2', () => {
    const scene = makeScene(false)

    const fullYear = computeAnnualSunAccess({
      scene,
      year: 2026,
      timeZone: 'UTC',
      halfYearMirror: false,
      sampleWindowDays: 1,
      stepMinutes: 120,
    })

    const dateRange = computeAnnualSunAccess({
      scene,
      dateStartIso: '2026-06-01',
      dateEndIso: '2026-06-30',
      timeZone: 'UTC',
      halfYearMirror: false,
      sampleWindowDays: 1,
      stepMinutes: 120,
    })

    expect(fullYear).not.toBeNull()
    expect(dateRange).not.toBeNull()
    if (!fullYear || !dateRange) {
      return
    }

    expect(dateRange.meta.dateStartIso).toBe('2026-06-01')
    expect(dateRange.meta.dateEndIso).toBe('2026-06-30')
    expect(dateRange.roofs[0].daylightHours).toBeLessThan(fullYear.roofs[0].daylightHours)
    expect(dateRange.roofs[0].sunAccessRatio).toBeGreaterThan(0)
  })
})
