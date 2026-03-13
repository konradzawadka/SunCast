// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readStorage, writeStorage } from './projectState.storage'
import type { ProjectState } from './projectState.types'

const DEFAULT_SUN = { enabled: true, datetimeIso: null, dailyDateIso: null }
const DEFAULT_SHADING = { enabled: true, gridResolutionM: 0.1 }
const DEFAULT_KWP = 4.3

function createState(): Pick<
  ProjectState,
  'footprints' | 'activeFootprintId' | 'obstacles' | 'activeObstacleId' | 'sunProjection' | 'shadingSettings'
> {
  return {
    footprints: {
      a: {
        footprint: {
          id: 'a',
          vertices: [
            [10, 10],
            [20, 10],
            [20, 20],
          ],
          kwp: 5,
        },
        constraints: { vertexHeights: [{ vertexIndex: 1, heightM: 2.2 }] },
        pitchAdjustmentPercent: 0,
      },
    },
    activeFootprintId: 'a',
    obstacles: {
      ob1: {
        id: 'ob1',
        kind: 'building',
        shape: {
          type: 'polygon-prism',
          polygon: [
            [11, 11],
            [12, 11],
            [12, 12],
          ],
        },
        heightAboveGroundM: 9,
      },
    },
    activeObstacleId: 'ob1',
    sunProjection: {
      enabled: false,
      datetimeIso: '2026-03-07T11:00',
      dailyDateIso: '2026-03-07',
    },
    shadingSettings: {
      enabled: false,
      gridResolutionM: 0.75,
    },
  }
}

describe('projectState.storage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('writes and reads project mapping round-trip', () => {
    writeStorage(createState(), 'uc6', DEFAULT_KWP)

    const loaded = readStorage(DEFAULT_SUN, DEFAULT_SHADING, DEFAULT_KWP, 'uc6')
    expect(loaded).not.toBeNull()
    expect(loaded?.activeFootprintId).toBe('a')
    expect(loaded?.footprints.a.footprint.kwp).toBe(5)
    expect(loaded?.footprints.a.constraints.vertexHeights).toEqual([{ vertexIndex: 1, heightM: 2.2 }])
    expect(loaded?.obstacles.ob1.kind).toBe('building')
    expect(loaded?.obstacles.ob1.heightAboveGroundM).toBe(9)
    expect(loaded?.activeObstacleId).toBe('ob1')
    expect(loaded?.sunProjection).toEqual({
      enabled: false,
      datetimeIso: '2026-03-07T11:00',
      dailyDateIso: '2026-03-07',
    })
    expect(loaded?.shadingSettings).toEqual({
      enabled: false,
      gridResolutionM: 0.75,
    })
  })

  it('returns null for malformed storage payload', () => {
    localStorage.setItem('suncast_project', '{bad json')
    expect(readStorage(DEFAULT_SUN, DEFAULT_SHADING, DEFAULT_KWP, 'uc6')).toBeNull()
  })

  it('falls back to defaults for missing projection and invalid kwp', () => {
    localStorage.setItem(
      'suncast_project',
      JSON.stringify({
        footprints: {
          b: {
            id: 'b',
            polygon: [
              [1, 1],
              [2, 1],
              [2, 2],
            ],
            vertexHeights: {},
            kwp: 'bad',
          },
        },
      }),
    )

    const loaded = readStorage(DEFAULT_SUN, DEFAULT_SHADING, DEFAULT_KWP, 'uc6')
    expect(loaded?.footprints.b.footprint.kwp).toBe(DEFAULT_KWP)
    expect(loaded?.sunProjection).toEqual(DEFAULT_SUN)
    expect(loaded?.shadingSettings).toEqual(DEFAULT_SHADING)
  })

  it('persists solverConfigVersion field', () => {
    writeStorage(createState(), 'uc9', DEFAULT_KWP)
    const payload = JSON.parse(localStorage.getItem('suncast_project') ?? '{}') as Record<string, unknown>
    expect(payload.solverConfigVersion).toBe('uc9')
    expect(payload.schemaVersion).toBe(3)
  })

  it('migrates legacy payload without schemaVersion', () => {
    localStorage.setItem(
      'suncast_project',
      JSON.stringify({
        footprints: {
          b: {
            id: 'b',
            polygon: [
              [1, 1],
              [2, 1],
              [2, 2],
            ],
            vertexHeights: { '0': 1.4 },
            kwp: 3.5,
          },
        },
        activeFootprintId: 'b',
      }),
    )

    const loaded = readStorage(DEFAULT_SUN, DEFAULT_SHADING, DEFAULT_KWP, 'uc8')
    expect(loaded?.activeFootprintId).toBe('b')
    expect(loaded?.footprints.b.constraints.vertexHeights).toEqual([{ vertexIndex: 0, heightM: 1.4 }])
    expect(loaded?.obstacles).toEqual({})
  })

  it('upgrades legacy default shading grid from 0.5 to 0.1 when solver config version changes', () => {
    localStorage.setItem(
      'suncast_project',
      JSON.stringify({
        schemaVersion: 3,
        footprints: {
          b: {
            id: 'b',
            polygon: [
              [1, 1],
              [2, 1],
              [2, 2],
            ],
            vertexHeights: {},
            kwp: 3.5,
          },
        },
        activeFootprintId: 'b',
        solverConfigVersion: 'uc6',
        shadingSettings: {
          enabled: true,
          gridResolutionM: 0.5,
        },
      }),
    )

    const loaded = readStorage(DEFAULT_SUN, DEFAULT_SHADING, DEFAULT_KWP, 'uc7')
    expect(loaded?.shadingSettings.gridResolutionM).toBe(0.1)
  })

  it('rejects unknown future schema version payload', () => {
    localStorage.setItem(
      'suncast_project',
      JSON.stringify({
        schemaVersion: 999,
        footprints: {},
        activeFootprintId: null,
      }),
    )

    expect(readStorage(DEFAULT_SUN, DEFAULT_SHADING, DEFAULT_KWP, 'uc6')).toBeNull()
  })

  it('does not throw when localStorage.setItem is unavailable', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })

    expect(() => writeStorage(createState(), 'uc6', DEFAULT_KWP)).toThrow('blocked')
    setItem.mockRestore()
  })
})
