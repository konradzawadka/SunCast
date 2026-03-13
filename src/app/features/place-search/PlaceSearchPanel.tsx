import { useState } from 'react'
import { Input } from '../../components/ui/input'
import { usePlaceSearch } from './usePlaceSearch'
import type { PlaceSearchResult } from './placeSearch.types'

interface PlaceSearchPanelProps {
  onSelectResult: (result: PlaceSearchResult) => void
}

export function PlaceSearchPanel({ onSelectResult }: PlaceSearchPanelProps) {
  const [query, setQuery] = useState('')
  const { results, loading, error, hasSearched } = usePlaceSearch({ query })

  const onSelect = (result: PlaceSearchResult) => {
    onSelectResult(result)
    setQuery('')
  }

  return (
    <section className="panel-section" data-testid="place-search-panel">
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search address or place"
        aria-label="Search address or place"
        title="Search by address, city, or point of interest."
        data-testid="place-search-input"
      />
      <div className="place-search-results" data-testid="place-search-results">
        {loading && <p className="place-search-meta">Searching...</p>}
        {!loading && error && <p className="place-search-meta">Search unavailable. You can continue by panning/zooming.</p>}
        {!loading && !error && hasSearched && results.length === 0 && <p className="place-search-meta">No places found</p>}
        {!loading && !error && results.length > 0 && (
          <ul className="place-search-list">
            {results.map((result, index) => (
              <li key={result.id}>
                <button
                  type="button"
                  onClick={() => onSelect(result)}
                  className="place-search-result-button"
                  title="Center map on this place."
                  data-testid={`place-search-result-${index}`}
                >
                  {result.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
