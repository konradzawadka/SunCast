export interface PlaceSearchResult {
  id: string
  label: string
  lat: number
  lon: number
}

export interface PlaceSearchProvider {
  search(
    query: string,
    options?: { limit?: number; lang?: string; signal?: AbortSignal },
  ): Promise<PlaceSearchResult[]>
}
