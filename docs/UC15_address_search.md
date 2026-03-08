## Story — find place by address

**Title**
Find place by typed address and move the map without own backend

**Goal**
As a user, I want to type an address or place name and jump the map to that location, so that I can start drawing my roof without manually navigating across the map.

**Why**
Today the app expects the user to navigate manually to the target place before drawing.
That is acceptable for short moves, but it becomes slow and annoying when the user wants to jump directly to a specific roof.

This story adds a lightweight search flow that:

* works fully in the browser
* does not require your own backend
* updates the map using the existing app location schema
* stays isolated from project storage and share-config payload

---

## Provider strategy

For long-term stability, geocoding should be implemented behind a **small provider adapter**, not hardwired directly into UI.

### Default provider for MVP

Use **Photon** as the default browser-side provider:

* public HTTP API
* common and widely used in OSM-based projects
* no own backend required
* simple query model

Example request:

```txt
GET https://photon.komoot.io/api/?q=<query>&limit=5
```

### Stability rule

UI and controller must never depend on Photon response shape directly.
Instead, the app should depend on one internal normalized contract.

That gives you:

* easy provider swap later
* safer tests
* no provider-specific fields leaking into app schema
* possibility to add fallback provider later without rewriting the feature

### Suggested fallback-ready design

Create one adapter interface such as:

```ts
export interface PlaceSearchProvider {
  search(query: string, options?: { limit?: number; lang?: string }): Promise<PlaceSearchResult[]>
}
```

Then implement:

* `PhotonPlaceSearchProvider` now
* optional future providers later

Examples of future replacements if needed:

* Nominatim-compatible hosted provider
* commercial geocoder with browser-safe API key model
* self-hosted Photon later if you ever want full control

---

## Internal app contract

The app should use one normalized result type only:

```ts
export interface PlaceSearchResult {
  id: string
  label: string
  lat: number
  lon: number
}
```

This keeps the feature compliant with the current app model:

* map center is still plain `lat/lon`
* no provider-specific payload is stored in project state
* no geocoder payload is added to shareable config schema

---

## Scope

This story covers:

* place/address text input
* debounced forward geocoding in browser
* compact result list
* click result to move the map
* update existing location hash
* normalized provider adapter for long-term stability

This story does **not** cover:

* reverse geocoding
* recent searches
* favorites
* routing
* backend proxy
* persistent geocoder data in project store
* storing search state in shared config

---

## Existing schema compatibility

The current app already reads map location from URL hash using location fields such as:

* `lat`
* `lon` / `lng`

This feature should stay compliant by only updating the existing map-center hash state.

### Rule

Selecting a place must:

* move the map camera
* update current hash location
* not modify project payload structure
* not extend `cfg` share schema

So geocoding is a **navigation helper**, not project data.

---

## User story

As a user,
I want to find a place by typing an address or place name,
so that I can immediately open the correct map area and start editing the roof there.

---

## User flow

1. User opens SunCast.
2. User sees a search input near map controls or sidebar header.
3. User types an address, city, or place name.
4. App waits for a short debounce.
5. App sends a browser-side geocoding request through internal place-search adapter.
6. App displays top matching places.
7. User selects one result.
8. App centers the map on that place.
9. App updates hash with the selected `lat/lon`.
10. User starts drawing the roof polygon.

---

## Functional behavior

### 1) Search input

Add one compact input:

* placeholder: `Search address or place`
* active in normal map workflow
* clearable if convenient

### 2) Query threshold

To avoid noisy requests:

* no request for empty value
* no request for trimmed query shorter than `3` characters

### 3) Debounce

Use a short debounce, for example:

* `300 ms`

This prevents request spam during typing.

### 4) Request cancellation

When a newer query starts:

* abort the previous request
* ignore stale responses

This prevents old results from overriding current search.

### 5) Results list

Show a compact list below the input:

* maximum `5` results
* display human-readable label
* allow click selection
* optional keyboard support later

### 6) Result selection

When user selects a result:

* move map center to `lat/lon`
* set practical edit zoom level if needed
* close or clear results list
* write selected position into current hash schema

### 7) Error handling

If provider request fails:

* show small non-blocking error
* do not break map/editor state
* keep current typed query

### 8) Empty result behavior

If provider returns no usable results:

* show `No places found`
* do not change map state

---

## Provider adapter behavior

### Required normalization

Provider response must be mapped into:

```ts
PlaceSearchResult[]
```

No raw provider fields should escape the adapter.

### Photon mapping direction

For Photon, adapter should map:

* `geometry.coordinates[1]` -> `lat`
* `geometry.coordinates[0]` -> `lon`
* provider display fields -> `label`
* stable derived string -> `id`

### Validation rule

Discard provider entries that do not contain valid finite coordinates.

---

## UI placement

Best initial placement:

* near top of sidebar
* or near map utility controls

Preferred rule:

* visible enough to support first step of workflow
* should not interfere with draw/edit controls

A good default is a small search block in `SunCastSidebar` header area.

---

## Data model rules

### Must not be persisted as project data

Do **not** store these in main project persistence:

* current text query
* current result list
* loading state
* geocoder provider response

These are transient UI states only.

### Allowed persistence

Only the existing map location hash may be updated when user selects a result.

---

## Acceptance criteria

1. User can type an address or place name in the app.
2. App performs forward geocoding directly from the browser.
3. App does not require own backend for this feature.
4. Search requests are debounced.
5. Queries shorter than 3 characters do not trigger a request.
6. Search results are shown in a compact selectable list.
7. Selecting a result moves the map to the selected place.
8. Selecting a result updates the existing hash location schema with `lat/lon`.
9. The feature does not modify project-share payload schema.
10. The feature does not persist provider payload inside project state.
11. Failed requests show a safe UI error and do not break editing.
12. Provider-specific response shape is isolated behind an internal adapter.
13. The app depends only on normalized `PlaceSearchResult` objects.

---

## Suggested implementation direction

### New types

* `src/features/place-search/placeSearch.types.ts`

```ts
export interface PlaceSearchResult {
  id: string
  label: string
  lat: number
  lon: number
}

export interface PlaceSearchProvider {
  search(query: string, options?: { limit?: number; lang?: string }): Promise<PlaceSearchResult[]>
}
```

### New provider adapter

* `src/features/place-search/providers/photonPlaceSearchProvider.ts`

Responsibilities:

* call Photon API
* parse response
* normalize results
* validate coordinates
* return `PlaceSearchResult[]`

### New feature hook or service

* `src/features/place-search/usePlaceSearch.ts`
  or
* `src/features/place-search/placeSearch.service.ts`

Responsibilities:

* debounce trigger
* request cancellation
* loading/error/result state

### New UI component

* `src/features/place-search/PlaceSearchPanel.tsx`

Responsibilities:

* input field
* result list
* loading/error/empty state
* selection callback

### Existing integration points

Likely integration points:

* `SunCastSidebar.tsx` for UI placement
* controller-level map action to center camera
* existing hash update helper or equivalent map-center setter

---

## Suggested implementation notes

### Hash update

Reuse existing location write convention if already present.
Do not invent a second map-center schema.

### Zoom rule

Use a consistent “editing zoom” on selection only if current map integration needs it.
Otherwise updating center alone is enough.

### Language

If provider allows language bias, use current app/browser locale when easy.
But keep it optional in adapter API.

### Rate-limit safety

Because this is a public provider:

* keep debounce
* keep result limit low
* avoid querying on every focus/change event

---

## Minimal test direction

### Unit tests

* adapter maps Photon response to `PlaceSearchResult`
* invalid entries are filtered out
* short query is skipped
* stale request does not override fresh result

### Playwright / UI tests

* type address -> results appear
* click result -> map center changes
* hash updates to selected coordinates
* provider failure -> safe error is shown

---

## Future-safe extension path

Later, without changing UI contract, you can add:

* provider fallback chain
* map-bias by current viewport
* result keyboard navigation
* reverse geocoding on map click
* self-hosted provider for full control

That is why the adapter boundary is part of this story, not an optional extra.
