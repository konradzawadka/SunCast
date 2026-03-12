import { describe, expect, it } from 'vitest'
import {
  buildSharePayload,
  deserializeSharePayload,
  serializeSharePayload,
  validateSharePayload,
} from './projectState.share'

const DEFAULT_SUN = { enabled: true, datetimeIso: null, dailyDateIso: null }
const DEFAULT_KWP = 4.3
const DEFAULT_SHADING = { enabled: true, gridResolutionM: 0.5 }

describe('projectState.share', () => {
  it('builds and deserializes shared payload', () => {
    const payload = buildSharePayload({
      footprints: {
        fp1: {
          footprint: {
            id: 'fp1',
            vertices: [
              [1, 1],
              [2, 1],
              [2, 2],
            ],
            kwp: 6,
          },
          constraints: {
            vertexHeights: [{ vertexIndex: 1, heightM: 3.2 }],
          },
          pitchAdjustmentPercent: 12,
        },
      },
      activeFootprintId: 'fp1',
      sunProjection: {
        enabled: false,
        datetimeIso: '2026-03-07T11:00',
        dailyDateIso: '2026-03-07',
      },
    })

    const loaded = deserializeSharePayload(serializeSharePayload(payload), DEFAULT_SUN, DEFAULT_KWP, DEFAULT_SHADING)
    expect(loaded.activeFootprintId).toBe('fp1')
    expect(loaded.selectedFootprintIds).toEqual(['fp1'])
    expect(loaded.footprints.fp1.footprint.kwp).toBe(6)
    expect(loaded.footprints.fp1.constraints.vertexHeights).toEqual([{ vertexIndex: 1, heightM: 3.2 }])
    expect(loaded.footprints.fp1.pitchAdjustmentPercent).toBe(12)
    expect(payload.schemaVersion).toBe(2)
  })

  it('rejects invalid payload schema', () => {
    expect(
      validateSharePayload({
        schemaVersion: 2,
        footprints: [{ id: 'fp1', polygon: [], vertexHeights: {}, kwp: 5 }],
        activeFootprintId: 'fp1',
      }),
    ).toBe(false)

    expect(() => deserializeSharePayload('{"version":2}', DEFAULT_SUN, DEFAULT_KWP, DEFAULT_SHADING)).toThrow(
      'Invalid share payload',
    )
  })

  it('migrates legacy v1 payload into current schema', () => {
    const legacy = JSON.stringify({
      version: 1,
      footprints: [
        {
          id: 'legacy',
          polygon: [
            [1, 1],
            [2, 1],
            [2, 2],
          ],
          vertexHeights: { '2': 4.1 },
          kwp: 7,
        },
      ],
      activeFootprintId: 'legacy',
    })

    const loaded = deserializeSharePayload(legacy, DEFAULT_SUN, DEFAULT_KWP, DEFAULT_SHADING)
    expect(loaded.activeFootprintId).toBe('legacy')
    expect(loaded.footprints.legacy.constraints.vertexHeights).toEqual([{ vertexIndex: 2, heightM: 4.1 }])
  })
})
