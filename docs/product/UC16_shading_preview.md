Below is the implementation plan matched to current app structure.

## Goal

Add **roof shading preview** for **all selected roofs**, based on:

* roof polygons already in app
* many external obstacles on map
* manual obstacle drawing
* obstacle height as **absolute above ground**
* one selected datetime for MVP
* smooth interaction
* local persistence only

Main output:

* **shade heatmap on roof**
* later extensible to **percent of time shaded**

---

## Architecture decision

Do **not** mix shading math into MapView or Three layer directly.

Keep 4 layers:

1. **State / domain**

   * obstacles
   * shading settings
   * shading results cache keys only if needed

2. **Pure geometry**

   * obstacle normalization
   * sun ray / shadow projection
   * roof sampling
   * shade evaluation

3. **Computation orchestration**

   * selected roofs + selected datetime
   * throttling / memoization / worker later

4. **Rendering**

   * heatmap overlay in map
   * obstacle visuals
   * edit handles

This fits your current app, because it already separates:

* `src/state/project-store/*`
* `src/geometry/*`
* `src/app/features/map-editor/*`
* `src/rendering/roof-layer/*`

---

## Proposed feature scope for first epic

### Included

* obstacle polygons anywhere on map
* obstacle type metadata
* obstacle height absolute above ground
* one datetime shading
* all selected roofs
* roof heatmap
* local persistence
* smooth interaction with throttled recompute

### Excluded

* self-shadow from roof itself
* annual / daily percent shaded
* volumetric trees with irregular canopies
* non-flat obstacle tops
* backend
* share URL persistence

---

# Phase 1 — domain model and storage

## 1.1 Add obstacle model

Create new types in `src/types/geometry.ts`:

* `ObstacleKind = 'building' | 'tree' | 'pole' | 'custom'`
* `ObstaclePolygon`
* `ObstacleStateEntry`
* `ShadingSettings`

Recommended shape:

* `id`
* `kind`
* `polygon: LngLat[]`
* `heightAboveGroundM`
* optional:

  * `label`
  * `opacityFactor` or `transmittance` later for trees
  * `baseElevationM` later if terrain arrives

For MVP keep it simple:

* every obstacle is extruded flat-top prism from ground `z=0` to `heightAboveGroundM`

## 1.2 Extend project state

In `src/state/project-store/projectState.types.ts` add:

* `obstacles: Record<string, ObstacleStateEntry>`
* `activeObstacleId: string | null`
* `selectedObstacleIds: string[]`
* obstacle drawing draft
* shading settings

Add actions:

* start/cancel obstacle draw
* add draft point
* commit obstacle
* set obstacle height
* set obstacle kind
* move obstacle vertex
* delete obstacle
* select/toggle/select-only obstacle
* set shading resolution / enabled state if needed

## 1.3 Update persistence

Files:

* `projectState.schema.ts`
* `projectState.storage.ts`
* `projectState.share.ts`
* tests around storage/schema

You said local only, so:

* include obstacles in local storage schema now
* do not include them in share codec yet

## 1.4 Reducer and selectors

Update:

* `projectState.reducer.ts`
* `projectState.selectors.ts`
* `projectState.commands.ts`
* `useProjectStore.ts`

Add selectors:

* all obstacles
* selected obstacles
* active obstacle
* selected roofs
* shading-ready roofs

### Exit criteria

* app can create/store/load obstacles without touching shading yet

---

# Phase 2 — map editing UX for obstacles

## 2.1 Add obstacle draw mode

Reuse existing draw flow style from footprints.

Best approach:

* separate mode, not overloaded footprint draw
* user chooses:

  * draw roof
  * draw obstacle

Files likely touched:

* `DrawTools.tsx`
* `MapView.tsx`
* `useMapInteractions.ts`
* `mapInteractionTypes.ts`
* `mapViewGeoJson.ts`

## 2.2 Obstacle edit behavior

For MVP:

* polygon drawing
* polygon vertex drag
* delete obstacle
* set height
* set type

Do not build special geometry for trees/lamps yet.
Represent them as polygons:

* tree = small circle-ish polygon or square footprint
* lamp/pole/sign = tiny square polygon

This keeps engine unified.

## 2.3 Obstacle styling

Add MapLibre sources/layers:

* obstacle fill
* obstacle outline
* active obstacle vertices
* optional height labels

Keep visually separate from roofs.

## 2.4 Sidebar panel

Add obstacle section in sidebar:

* selected obstacle count
* active obstacle type
* height input
* delete
* quick presets:

  * tree
  * lamp
  * sign
  * custom

### Exit criteria

* user can create many obstacles smoothly on map
* local storage restores them

---

# Phase 3 — pure shading geometry engine

This is the most important phase.

## 3.1 New geometry module

Create new folder:

* `src/geometry/shading/`

Suggested files:

* `types.ts`
* `roofSampling.ts`
* `obstacleVolumes.ts`
* `rayCasting.ts`
* `shadowProjection.ts`
* `shadeAtPoint.ts`
* `computeRoofShadeGrid.ts`
* tests for each

## 3.2 Coordinate normalization

You already use local metric projection in:

* `src/geometry/projection/localMeters.ts`

Reuse this idea.

For each computation batch:

* choose local origin near selected roofs
* project roofs and obstacles to local meters
* operate entirely in meters

Do not do ray math in lon/lat.

## 3.3 Roof sample grid

For each selected solved roof:

* sample points over roof polygon
* grid size configurable, start with `0.35m` or `0.5m`

Each sample stores:

* local `x,y`
* roof `z`
* cell polygon for rendering
* roof id

Important:

* sample only points inside roof polygon
* use solved roof plane to derive sample height

## 3.4 Obstacle volume model

For each obstacle:

* footprint polygon in local meters
* vertical prism from `z=0` to `heightAboveGroundM`

Because height is absolute above ground, and roof plane is solved in same global height frame assumption, this is consistent enough for MVP.

## 3.5 Shade test algorithm

For a given datetime:

* use existing sun position from `src/geometry/sun/sunPosition.ts`
* derive sun direction vector

For each roof sample point:

* trace ray from sample point toward sun
* intersect ray with obstacle prisms
* if any hit before escaping scene => shaded
* else lit

Result per cell:

* `shadeFactor = 1 | 0` for MVP
* later can become percent

This is better than raster shadow maps for first step because:

* deterministic
* testable
* app already has strong pure-function structure

## 3.6 Broad-phase optimization

Because obstacles can be many, do not test all obstacles against all samples.

Add broad phase:

* obstacle bounding boxes in local XY
* prefilter by sun-facing corridor / projected bbox
* maybe lightweight spatial index later

MVP optimization enough:

* for each roof batch, prefilter obstacles within expanded roof bounds plus max shadow distance

Max shadow distance:

* `obstacleHeight / tan(sunElevation)`
* if sun very low, clamp to sane max

## 3.7 Night / low sun handling

* if sun elevation <= 0 → all roofs fully shaded or no heatmap; better show no sun / no direct shading
* if sun very low, computation can explode in distance; clamp horizon handling

Recommended:

* below small threshold like `2°`, show warning and reduce / skip direct shadow preview

### Exit criteria

* pure function can compute shaded cells for selected roofs from roof planes + obstacles + datetime

---

# Phase 4 — computation orchestration and smooth interaction

You want smooth interaction. This phase is critical.

## 4.1 Add dedicated shading hook

Create:

* `src/app/hooks/useRoofShading.ts`

Inputs:

* selected solved roofs
* selected roof ids
* obstacles
* datetime
* grid resolution
* interaction state

Outputs:

* heatmap features
* compute status
* diagnostics

## 4.2 Throttling and interaction behavior

During drag:

* do not recompute on every raw pointer event
* throttle to e.g. `requestAnimationFrame` or 80–120 ms

Two-level strategy:

1. while dragging:

   * coarse grid
2. on drag end:

   * full grid

This will give smoothness without bad architecture.

## 4.3 Memoization keys

Memoize by:

* selected roof ids + solved plane fingerprint
* obstacle fingerprint
* datetime
* grid resolution

Important:

* geometry fingerprint should be stable and cheap

## 4.4 Optional worker boundary

Do not start with worker unless needed, but design for it.

Create compute API as pure serializable payload:

* this makes moving to web worker easy later

Good boundary:

* `computeRoofShadeGrid(payload)`

## 4.5 Degradation strategy

If scene too big:

* compute active viewport only, or
* limit heatmap to selected roofs only, which you already want

### Exit criteria

* dragging obstacle or vertex feels responsive
* heatmap refreshes fast enough

---

# Phase 5 — heatmap rendering on map

## 5.1 Rendering strategy for MVP

Best first approach:

* generate GeoJSON cell polygons
* each cell carries:

  * `roofId`
  * `shade`
  * `intensity`
* render with MapLibre fill layer

Why this first:

* simple
* debuggable
* consistent with current map source architecture
* no deep custom shader required yet

## 5.2 Overlay behavior

Show heatmap only when:

* sun datetime valid
* at least one selected roof solved
* shading mode enabled

Use strong but readable intensity.
Do not blend into roof mesh too much at first.

## 5.3 Layer order

Recommended order:

1. basemap
2. obstacles
3. roof polygons / outlines
4. shading heatmap
5. active handles / labels
6. optional 3D roof mesh

You may later decide to synchronize with `RoofMeshLayer.ts`, but first keep heatmap in 2D overlay.

## 5.4 Multi-roof support

Heatmap source should include all selected roofs in one source for simplicity.
Each cell should carry `roofId`.

### Exit criteria

* all selected roofs show visible shading effect at one datetime

---

# Phase 6 — controller and screen integration

## 6.1 Extend app controller

Update:

* `useSunCastController.ts`
* `sunCastController.types.ts`

Add to canvas model:

* obstacles
* obstacle editing callbacks
* shading enabled
* shading heatmap features
* shading status
* shading diagnostics

## 6.2 Reuse sun projection settings

Current app already has:

* `sunProjection.enabled`
* `datetimeIso`

Reuse same datetime for shading MVP.
Do not create second datetime source.

## 6.3 Sidebar additions

Add section:

* shading preview toggle
* grid quality selector:

  * fast
  * balanced
  * detail
* obstacle tools
* shading diagnostics:

  * selected roofs
  * obstacle count
  * sampled cells
  * compute mode fast/final

### Exit criteria

* user can drive feature fully from current screen structure

---

# Phase 7 — tests

This app already has good test culture. Keep it.

## 7.1 Unit tests for geometry

New tests in `src/geometry/shading/*.test.ts`:

Must cover:

* obstacle directly between sun and roof point => shaded
* obstacle outside ray path => not shaded
* taller obstacle shades farther than shorter
* sun behind roof / night => no direct sun
* multiple obstacles
* polygon inclusion for sample points
* local meter projection stability

## 7.2 Reducer/store tests

Add tests for:

* obstacle CRUD
* persistence restore
* selection behavior
* mode switching draw roof vs draw obstacle

## 7.3 Map feature tests

Add tests around:

* obstacle GeoJSON generation
* heatmap cell feature generation

## 7.4 Playwright

Good e2e scenarios:

1. draw roof
2. solve roof
3. set datetime
4. draw obstacle
5. set height
6. verify heatmap appears
7. move obstacle
8. verify heatmap changes

### Exit criteria

* geometry and UX stable enough for vendor work

---

# Phase 8 — performance hardening

Do this after MVP works.

## 8.1 Spatial indexing

If needed:

* uniform grid index or RBush-like structure

## 8.2 Partial recompute

On obstacle drag:

* recompute only affected roofs or only roofs within obstacle shadow corridor

## 8.3 Adaptive grid

* coarse while moving
* dense on idle

## 8.4 Rendering compression

If GeoJSON cell count gets too high:

* merge adjacent same-value cells
* later switch to canvas/WebGL texture overlay

### Exit criteria

* large scenes remain usable

---

# Suggested concrete file changes

## New

* `src/geometry/shading/types.ts`
* `src/geometry/shading/roofSampling.ts`
* `src/geometry/shading/obstacleVolumes.ts`
* `src/geometry/shading/rayCasting.ts`
* `src/geometry/shading/computeRoofShadeGrid.ts`
* `src/app/hooks/useRoofShading.ts`
* `src/app/features/map-editor/ObstacleTools/*` or extend current tools

## Update

* `src/types/geometry.ts`
* `src/state/project-store/projectState.types.ts`
* `src/state/project-store/projectState.reducer.ts`
* `src/state/project-store/projectState.schema.ts`
* `src/state/project-store/projectState.storage.ts`
* `src/state/project-store/projectState.selectors.ts`
* `src/state/project-store/useProjectStore.ts`
* `src/app/hooks/useSunCastController.ts`
* `src/app/hooks/sunCastController.types.ts`
* `src/app/features/map-editor/MapView/mapViewGeoJson.ts`
* `src/app/features/map-editor/MapView/useMapInteractions.ts`
* `src/app/features/map-editor/MapView/useMapSources.ts`
* `src/app/features/map-editor/DrawTools/DrawTools.tsx`
* sidebar components where controls live

---

# Delivery phases for vendor

## Phase A — obstacle foundation

* obstacle state
* local storage
* draw/edit/delete
* height + type
* tests

## Phase B — single-roof shading engine

* pure shading geometry
* one roof
* one datetime
* unit tests

## Phase C — selected-roofs heatmap

* multi-roof compute
* map heatmap overlay
* sidebar controls
* e2e

## Phase D — smooth interaction

* throttling
* coarse/final passes
* caching
* perf diagnostics

## Phase E — hardening

* edge cases
* large scenes
* rendering optimization
* docs

---

# Technical recommendations

## 1. Keep trees/poles as polygons in MVP

Do not build special primitives now.
Use presets that generate small polygons automatically.

## 2. Use binary shading first internally

Even if next epic wants percent of time shaded, first engine should return:

* per datetime binary lit/shaded

Then later aggregate over many datetimes.

## 3. Keep shading separate from irradiance

Current app already has sun projection / irradiance logic.
Shading should modify direct exposure later, but do not couple too early.

## 4. Do not start with 3D GPU shadow maps

Too much complexity for current speed requirement and current app architecture.

## 5. Add worker-ready boundary now

Even if not implemented yet.

---

# Main risks

1. **Too many heatmap cells**

   * solved by adaptive grid

2. **Very low sun angles**

   * clamp distance / degrade preview

3. **Obstacle count explosion**

   * spatial filtering

4. **UI complexity from dual draw modes**

   * separate roof and obstacle modes cleanly

5. **Mixing rendering and compute**

   * avoid from start

---

# My recommended MVP order

1. obstacle model + persistence
2. obstacle drawing/editing
3. pure shade test on one point
4. roof grid sampling
5. single-roof heatmap
6. all selected roofs
7. throttled recompute
8. tests and perf pass

If you want, next step I can write this as a proper vendor-ready markdown spec like `docs/product/UC16_shading_preview.md`.

Your best advisor Jacuś.
