import { afterEach, describe, expect, it, vi } from 'vitest'
import { PhotonPlaceSearchProvider } from './photonPlaceSearchProvider'

describe('PhotonPlaceSearchProvider', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('maps Photon response to normalized results', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          features: [
            {
              geometry: { coordinates: [21.0122, 52.2297] },
              properties: { street: 'Marszalkowska', housenumber: '10', city: 'Warsaw', country: 'Poland' },
            },
          ],
        }),
      }),
    )

    const provider = new PhotonPlaceSearchProvider()
    const results = await provider.search('warsaw')

    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({
      label: 'Marszalkowska, 10, Warsaw, Poland',
      lon: 21.0122,
      lat: 52.2297,
    })
  })

  it('filters out invalid coordinates', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          features: [
            { geometry: { coordinates: ['bad', 52.2] }, properties: { name: 'bad' } },
            { geometry: { coordinates: [21.01, 52.22] }, properties: { name: 'ok' } },
          ],
        }),
      }),
    )

    const provider = new PhotonPlaceSearchProvider()
    const results = await provider.search('x')

    expect(results).toHaveLength(1)
    expect(results[0].label).toContain('ok')
  })
})
