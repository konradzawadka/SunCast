import type { PlaceSearchProvider, PlaceSearchResult } from '../placeSearch.types'

interface PhotonFeature {
  geometry?: {
    coordinates?: unknown
  }
  properties?: {
    name?: string
    street?: string
    housenumber?: string
    city?: string
    state?: string
    country?: string
  }
}

interface PhotonResponse {
  features?: PhotonFeature[]
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null
  }
  return value
}

function isValidCoordinates(value: unknown): value is [number, number] {
  if (!Array.isArray(value) || value.length < 2) {
    return false
  }

  const lon = asFiniteNumber(value[0])
  const lat = asFiniteNumber(value[1])
  if (lon === null || lat === null) {
    return false
  }

  return lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180
}

function joinLabelParts(parts: Array<string | undefined>): string {
  return parts
    .filter((part): part is string => Boolean(part && part.trim() !== ''))
    .join(', ')
}

function mapFeature(feature: PhotonFeature, index: number): PlaceSearchResult | null {
  if (!isValidCoordinates(feature.geometry?.coordinates)) {
    return null
  }

  const [lon, lat] = feature.geometry.coordinates
  const props = feature.properties
  const primary = joinLabelParts([joinLabelParts([props?.street, props?.housenumber]), props?.name])
  const secondary = joinLabelParts([props?.city, props?.state, props?.country])
  const label = joinLabelParts([primary, secondary]) || `Result ${index + 1}`

  return {
    id: `${lat.toFixed(6)}:${lon.toFixed(6)}:${index}`,
    label,
    lat,
    lon,
  }
}

export class PhotonPlaceSearchProvider implements PlaceSearchProvider {
  async search(
    query: string,
    options?: { limit?: number; lang?: string; signal?: AbortSignal },
  ): Promise<PlaceSearchResult[]> {
    const params = new URLSearchParams({
      q: query,
      limit: String(options?.limit ?? 5),
    })
    if (options?.lang) {
      params.set('lang', options.lang)
    }

    const response = await fetch(`https://photon.komoot.io/api/?${params.toString()}`, {
      method: 'GET',
      signal: options?.signal,
    })

    if (!response.ok) {
      throw new Error(`Photon request failed (${response.status})`)
    }

    const data = (await response.json()) as PhotonResponse
    const results: PlaceSearchResult[] = []

    for (const [index, feature] of (data.features ?? []).entries()) {
      const mapped = mapFeature(feature, index)
      if (mapped) {
        results.push(mapped)
      }
    }

    return results
  }
}
