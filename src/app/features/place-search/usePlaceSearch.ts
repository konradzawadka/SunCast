import { useEffect, useMemo, useRef, useState } from 'react'
import { PhotonPlaceSearchProvider } from './providers/photonPlaceSearchProvider'
import type { PlaceSearchProvider, PlaceSearchResult } from './placeSearch.types'

const QUERY_MIN_LENGTH = 3
const DEFAULT_DEBOUNCE_MS = 300
const DEFAULT_LIMIT = 5
const SUPPORTED_LANGS = new Set(['de', 'en', 'fr'])

interface UsePlaceSearchArgs {
  query: string
  provider?: PlaceSearchProvider
  debounceMs?: number
}

interface UsePlaceSearchResult {
  results: PlaceSearchResult[]
  loading: boolean
  error: string | null
  hasSearched: boolean
}

const defaultProvider = new PhotonPlaceSearchProvider()

function resolveProviderLang(locale: string): string | undefined {
  const normalized = locale.trim().toLowerCase()
  if (!normalized) {
    return undefined
  }

  const baseLang = normalized.split('-')[0]
  if (SUPPORTED_LANGS.has(baseLang)) {
    return baseLang
  }

  return undefined
}

export function usePlaceSearch({
  query,
  provider,
  debounceMs = DEFAULT_DEBOUNCE_MS,
}: UsePlaceSearchArgs): UsePlaceSearchResult {
  const normalizedQuery = query.trim()
  const searchProvider = useMemo(() => provider ?? defaultProvider, [provider])
  const [results, setResults] = useState<PlaceSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (normalizedQuery.length < QUERY_MIN_LENGTH) {
      abortRef.current?.abort()
      abortRef.current = null
      setResults([])
      setLoading(false)
      setError(null)
      setHasSearched(false)
      return
    }

    const timeoutId = window.setTimeout(async () => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      setLoading(true)
      setError(null)

      try {
        const nextResults = await searchProvider.search(normalizedQuery, {
          limit: DEFAULT_LIMIT,
          lang: resolveProviderLang(navigator.language),
          signal: controller.signal,
        })
        if (!controller.signal.aborted) {
          setResults(nextResults.slice(0, DEFAULT_LIMIT))
          setHasSearched(true)
        }
      } catch (caughtError) {
        if (controller.signal.aborted) {
          return
        }
        setResults([])
        setHasSearched(true)
        setError(caughtError instanceof Error ? caughtError.message : 'Search failed')
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }, debounceMs)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [debounceMs, normalizedQuery, searchProvider])

  return { results, loading, error, hasSearched }
}
