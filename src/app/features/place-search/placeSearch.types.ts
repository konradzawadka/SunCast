import type { PlaceSearchResult } from '../../../types/presentation-contracts'

export type { PlaceSearchResult }

export interface PlaceSearchProvider {
  search(
    query: string,
    options?: { limit?: number; lang?: string; signal?: AbortSignal },
  ): Promise<PlaceSearchResult[]>
}
