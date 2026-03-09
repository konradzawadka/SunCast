## Story — share configuration over URL

**Title**
Share SunCast roof configuration via URL

**Goal**
As a user, I want to generate a shareable URL that contains my current roof configuration, so that I can open the same setup on another device or send it to someone else without exporting files.

**Scope**
The shared config should include:

* footprint geometry (`geojson` / polygon coordinates)
* vertex heights
* `kWp`
* active footprint / selected footprints only if useful for UX
* no derived data such as solved mesh, metrics, warnings, chart results

**Payload rules**

* Serialize only the minimal persistent project data
* Compress serialized JSON
* Encode compressed bytes as URL-safe base64
* Store it in query param, for example: `?cfg=...`

**User flow**

1. User edits one or more roofs.
2. User clicks **Share**.
3. App builds compact payload from current project.
4. App compresses payload and encodes it to URL-safe base64.
5. App updates or generates a URL with `cfg` param.
6. App copies URL to clipboard.
7. User opens pasted link in another browser/device.
8. App detects `cfg` on startup.
9. App decodes + decompresses + validates payload.
10. App hydrates store from payload.
11. Shared config takes priority over localStorage for that session.

**Acceptance criteria**

1. When user clicks **Share**, a URL is generated from current config.
2. Opening that URL restores polygons, heights, and `kWp`.
3. Invalid or corrupted `cfg` does not crash app.
4. On invalid `cfg`, app falls back to normal startup and shows user-facing error.
5. Share payload does not include runtime-only state:

   * draw draft
   * map orbit state
   * solver mesh
   * warnings
   * temporary selections unless explicitly chosen
6. URL encoding is URL-safe.
7. App supports multiple footprints.
8. If browser supports `navigator.share`, it may be used; otherwise clipboard copy is enough.
9. If payload is too large for practical URL sharing, user gets a clear error.

---

## Plan for modification

## 1. Add explicit share model for URL payload

Create a dedicated mapper for shareable state, separate from localStorage persistence.

**Why**
Your current storage layer in `src/state/project-store/projectState.storage.ts` already persists the right core data, but URL sharing should not depend directly on localStorage format forever.

**New file**

* `src/state/project-store/projectState.share.ts`

**Responsibilities**

* `buildSharePayload(state)`
* `serializeSharePayload(payload)`
* `deserializeSharePayload(raw)`
* `validateSharePayload(parsed)`

**Suggested payload**

```ts
type SharedProjectPayload = {
  version: 1
  footprints: Array<{
    id: string
    polygon: Array<[number, number]>
    vertexHeights: Record<string, number>
    kwp: number
  }>
  activeFootprintId: string | null
  sunProjection?: {
    enabled: boolean
    datetimeIso: string | null
    dailyDateIso: string | null
  }
}
```

I would keep this close to `ProjectData`, but as a dedicated share contract.

---

## 2. Add compression + URL-safe base64 helpers

Create one isolated codec utility.

**New file**

* `src/shared/utils/shareCodec.ts` or `src/app/utils/shareCodec.ts`

**Responsibilities**

* JSON stringify / parse
* compress / decompress
* base64url encode / decode

**Recommendation**
Use browser-native `CompressionStream('gzip')` and `DecompressionStream('gzip')` first.
Add fallback path only if you need broader compatibility.

**Important**
Prefer **base64url**, not plain base64:

* `+` → `-`
* `/` → `_`
* remove trailing `=`

This avoids broken URLs.

---

## 3. Add import-from-URL on app startup

Current startup is in `useProjectStore()`:

* reads localStorage via `readStorage(...)`
* dispatches `LOAD`

Extend it so URL config is checked first.

**Best change**
In `useProjectStore.ts`:

1. read `cfg` from `window.location.search`
2. if present:

   * decode
   * decompress
   * validate
   * map to `ProjectState`
   * dispatch `LOAD`
3. else fallback to `readStorage(...)`

**Priority**
`cfg` should win over localStorage, because shared link is explicit user intent.

**Optional**
After successful hydrate, keep URL unchanged.
Do not auto-write back cleaned payload unless necessary.

---

## 4. Add Share action to controller

Extend `useSunCastController.ts`.

**Add to `SunCastSidebarModel`**

* `shareError: string | null`
* `shareSuccess: string | null`
* `onShareProject: () => Promise<void> | void`

**Controller logic**

* read current `state`
* build share payload
* encode to URL
* construct URL from `window.location.origin + pathname + ?cfg=...`
* try:

  * `navigator.share({ url })` if available
  * else `navigator.clipboard.writeText(url)`

**Error cases**

* empty project
* encode/decode failure
* URL too long
* clipboard/share failure

---

## 5. Add Share button in sidebar

Best placement: next to title/tutorial trigger in `SunCastSidebar.tsx`.

Current header already has:

* app title
* tutorial `?` button

Add:

* `Share` button

This is the most natural place because sharing is global project action.

**File**

* `src/app/screens/SunCastSidebar.tsx`

**UI behavior**

* button disabled if no footprints
* show short success/error text below header or under draw tools

---

## 6. Keep localStorage and URL-share responsibilities separate

Do not overload `projectState.storage.ts`.

Current file should remain focused on:

* localStorage read/write

URL share should live in:

* share mapper
* share codec
* initial hydrate helper

That keeps future backend/export work simpler.

---

## 7. Add length guard

This matters. Roof configs can become large.

Before copying/sharing:

* check generated URL length
* if above practical threshold, reject with message

**Practical MVP threshold**

* safe warning around `1800–4000` chars depending on tolerance
* conservative app rule: fail above `3500` chars

Reason: some messengers/browsers/proxies can break on long URLs.

---

## 8. Add tests

### Unit tests

Add tests for:

**`projectState.share.ts`**

* export minimal project
* import valid project
* invalid schema rejected
* missing fields rejected
* version mismatch rejected or handled

**`shareCodec.ts`**

* encode/decode roundtrip
* base64url roundtrip
* corrupted payload throws controlled error

### Store tests

In `useProjectStore` or startup helper:

* URL config overrides localStorage
* invalid URL config falls back to storage

### UI tests

* clicking Share calls clipboard/share path
* disabled state when project empty

---

## 9. Suggested implementation order

1. `projectState.share.ts`
2. `shareCodec.ts`
3. startup hydrate from `cfg`
4. controller share action
5. sidebar button
6. tests
7. user-facing error/success polish

---

## 10. Concrete files to touch

**New**

* `src/state/project-store/projectState.share.ts`
* `src/shared/utils/shareCodec.ts`

**Modify**

* `src/state/project-store/useProjectStore.ts`
* `src/app/hooks/useSunCastController.ts`
* `src/app/screens/SunCastSidebar.tsx`
* optionally `src/state/project-store/projectState.types.ts` if you want dedicated share types there

---

## Notes specific to your codebase

1. You already have a good persistence boundary in `projectState.storage.ts`. Reuse mapper logic, but do not mix URL logic into storage logic too much.
2. `ProjectData` is already close to what should be shared.
3. `drawDraft`, selection, orbit mode, solver outputs should stay out of shared payload.
4. Because your app is Vite/web, URL bootstrap in `useProjectStore()` is the cleanest MVP.
5. I would avoid adding external compression dependency first. Native gzip streams keep dependency count low.

---

## Minimal technical story for backlog

**Story**
Implement URL-based project sharing in SunCast. The app should serialize current project configuration, compress it, encode it as URL-safe base64, and expose it through a `cfg` query param. A new Share button should generate and copy/share the URL. On app startup, if `cfg` is present, the app should restore the shared configuration and use it instead of localStorage.

**Done when**

* Share button exists
* URL roundtrip works
* multiple footprints supported
* heights + `kWp` restored
* bad payload handled safely
* tests cover codec + hydrate path

Your best advisor Jacuś.
