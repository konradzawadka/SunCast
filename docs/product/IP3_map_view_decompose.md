# MapView.tsx Improvement Plan

`MapView.tsx` currently handles too many responsibilities at once: map initialization, source/layer setup, hit-testing, drag interactions, orbit behavior, debug rendering, and overlay UI.
The main goal should be to split it into smaller, testable modules and make the component easier to understand and extend.

## Main issues

### 1. Too many responsibilities in one component

`MapView` acts as:

* React container
* MapLibre adapter
* interaction controller
* overlay renderer

This makes the file hard to review and risky to change.

### 2. Heavy use of `useRef` to avoid stale closures

This pattern works, but it shows that event handling is too tightly coupled with React lifecycle.

### 3. GeoJSON building logic is spread around

Draft features and interactive sources are built in multiple places instead of through one clear adapter layer.

### 4. Large initialization effect

The map setup lives in one long `useEffect`, which makes the lifecycle harder to follow and harder to test.

### 5. Domain logic is mixed together

Footprint editing, vertex/edge interactions, orbit camera behavior, and debug UI are all in one file.

### 6. Event handling does not scale well

`click`, `mousedown`, `mousemove`, `mouseup`, `mouseout`, `rotate`, `pitch`, and `zoom` are handled procedurally in one block, which will become harder to maintain as more features are added.

---

# Refactor plan

## 1. Split `MapView.tsx` into focused modules

Break the file into:

* `MapView.tsx` — composition only, keeps the main structure small
* `useMapInstance.ts` — map creation and cleanup
* `useMapInteractions.ts` — click, hover, selection, drag
* `useOrbitCamera.ts` — orbit mode behavior, pitch/bearing sync, gizmo anchor
* `useMapSources.ts` — source/layer synchronization
* `mapViewGeoJson.ts` — GeoJSON builders and geometry helpers
* `mapViewConstants.ts` — constants and layer/source IDs
* `MapOverlayControls.tsx` — HUD, buttons, debug UI, orbit controls

This should be the highest priority change because it gives the biggest readability improvement.

---

## 2. Extract map style and layer configuration

Move the inline map style definition into a dedicated factory, for example:

* `createMapStyle()`

Benefits:

* shorter main component
* easier review of map layers
* easier future changes to style and sources
* simpler testing of map configuration

---

## 3. Centralize source synchronization

Instead of calling update logic from different places, define clear sync functions:

* `syncInteractiveSources(map, state)`
* `syncDraftSource(map, drawDraft)`
* `syncRoofMeshLayers(map, roofMeshes, debugEnabled)`

This will reduce duplication and make data flow into the map easier to understand.

---

## 4. Replace repeated ref-updating patterns with a helper

There is repeated code like:

* store callback in `useRef`
* update `.current` in `useEffect`

Wrap this into a helper such as:

* `useLatest(value)`

This will remove noise and make the file much cleaner.

---

## 5. Extract hit-testing helpers

Selection logic for footprint, edge, and vertex is currently spread across different event handlers.

Create dedicated helpers such as:

* `getHitFeatures(map, point, tolerance, layers)`
* `getVertexHit(hits)`
* `getEdgeHit(hits)`
* `getFootprintHit(hits)`

This will simplify handlers and reduce interaction bugs.

---

## 6. Separate hover logic from drag logic

`mousemove` currently handles several responsibilities at once:

* hover cursor updates
* edge length label updates
* vertex dragging
* edge dragging

Split this into:

* `handleHoverMove`
* `handleDragMove`

This will make the interaction flow much easier to reason about.

---

## 7. Isolate orbit mode behavior

Orbit mode currently mixes several concerns:

* map rotation/pitch handling
* footprint opacity changes
* autofocus
* gizmo positioning

Move this into a dedicated orbit module with responsibilities like:

* `applyOrbitMode(map, enabled, focusFootprint)`
* `updateGizmoScreenPosition(map, anchor)`

This will make orbit mode easier to evolve without breaking editing behavior.

---

## 8. Reduce scattered local UI state

Some UI state can be grouped for clarity. For example:

* `mapZoom` and `mapPitch` can be combined into a camera HUD state object
* hover-related state can be grouped into a dedicated hook

This will make the state model more intentional and easier to follow.

---

## 9. Introduce typed intermediate state objects

Instead of passing many independent arguments into update functions, introduce structured types such as:

* `InteractiveMapState`

This will:

* improve readability
* reduce parameter mismatch risk
* make future refactors safer

---

## 10. Move pure logic into testable utilities

The easiest parts to unit test are:

* bounds calculation
* ring creation
* edge length calculation
* GeoJSON builders
* hit result parsing helpers

These should be extracted into pure utility functions and covered with tests.

---

# Recommended implementation order

## Phase 1 — safe refactor without behavior changes

* extract constants
* extract GeoJSON builders
* add `useLatest`
* move map style into `createMapStyle()`

## Phase 2 — interaction cleanup

* extract hit-testing helpers
* split hover and drag logic
* isolate drag lifecycle behavior

## Phase 3 — feature-area separation

* add `useOrbitCamera`
* add `useMapSources`
* move overlay UI into `MapOverlayControls`

## Phase 4 — test coverage

* add unit tests for geometry and GeoJSON utilities
* add interaction-level tests for selection, drag, and orbit mode

---

# Priority order

The best order is:

1. split `MapView.tsx` into modules
2. extract hit-testing and drag logic
3. centralize source/layer synchronization
4. clean up HUD, debug, and orbit UI

This gives the largest readability gain with the lowest regression risk.

---

# Expected outcome

After this refactor:

* `MapView.tsx` becomes much smaller and easier to read
* map lifecycle is easier to understand
* interaction logic becomes easier to debug
* orbit mode becomes isolated
* future features can be added without turning the file into a bottleneck

