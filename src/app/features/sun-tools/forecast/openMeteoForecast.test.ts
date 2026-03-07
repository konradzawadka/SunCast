import { describe, expect, it, vi } from 'vitest'
import { extractDateIso, fetchOpenMeteoTiltedIrradiance, parseOpenMeteoTiltedIrradiancePayload } from './openMeteoForecast'

describe('openMeteoForecast', () => {
  it('returns empty list for malformed payload', () => {
    expect(parseOpenMeteoTiltedIrradiancePayload({})).toEqual([])
    expect(
      parseOpenMeteoTiltedIrradiancePayload({
        hourly: {
          time: 'bad',
          global_tilted_irradiance: null,
        },
      }),
    ).toEqual([])
  })

  it('parses only finite timestamp/value pairs', () => {
    const payload = {
      hourly: {
        time: ['2026-03-07T10:00', 42, '2026-03-07T12:00'],
        global_tilted_irradiance: [500, 300, 'NaN'],
      },
    }

    expect(parseOpenMeteoTiltedIrradiancePayload(payload)).toEqual([
      { timestampIso: '2026-03-07T10:00', irradianceWm2: 500 },
    ])
  })

  it('fetches and parses payload from API', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          hourly: {
            time: ['2026-03-07T11:00'],
            global_tilted_irradiance: [700],
          },
        }),
        { status: 200 },
      ),
    )

    const points = await fetchOpenMeteoTiltedIrradiance({
      latDeg: 52.23,
      lonDeg: 21.01,
      roofPitchDeg: 35,
      roofAzimuthDeg: 180,
      timeZone: 'Europe/Warsaw',
      dateIso: '2026-03-07',
      fetchImpl,
    })

    expect(points).toEqual([{ timestampIso: '2026-03-07T11:00', irradianceWm2: 700 }])
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('extracts date from datetime input', () => {
    expect(extractDateIso('2026-03-07T12:34')).toBe('2026-03-07')
    expect(extractDateIso('invalid')).toBeNull()
  })
})
