Conclusion: implement it as a **separate annual-simulation pipeline**, not as an extension of the live shading preview.

Biggest mistake to avoid:

* do **not** put yearly simulation into `useRoofShading`
* do **not** recompute roof normalization + obstacle normalization for every timestamp
* do **not** overload the current live heatmap state with annual data without an explicit mode

## Target UX

In `SunOverlayColumn.tsx` add a new panel:

* button: **Run annual sun access simulation**
* optional controls:

  * year
  * date from (`date1`)
  * date to (`date2`)
  * day step: default `5`
  * time step: default `30 min`
  * half-year mirror: default `on`
  * grid resolution: default reuse current shading grid
* result:

  * `Sun hours / year`
  * `Daylight hours considered`
  * `Sun access ratio`
  * button: **Show annual heatmap on roof**
  * button: **Clear simulation**

The map should then render a heatmap where:

* `intensity = litRatio`
* `0` = almost always shaded
* `1` = almost always sunlit

## What already exists and should be reused

Good reusable pieces:

* live shading engine: `src/geometry/shading/computeRoofShadeGrid.ts`
* roof cell generation: `src/geometry/shading/roofSampling.ts`
* point shadow test: `src/geometry/shading/shadeAtPoint.ts`
* annual day-window sampling pattern: `src/geometry/sun/annualEstimation.ts`
* current live shading hook/cache: `src/app/hooks/useRoofShading.ts`
* current map heatmap rendering: `src/rendering/roof-layer/roofHeatmapOverlay.ts`
* current sun tools insertion point: `src/app/features/sun-tools/SunOverlayColumn.tsx`

That means you are not building a new feature from zero. You already have 70% of the plumbing.

---

# Implementation plan

## Phase 1 — split the shading engine into reusable preparation + snapshot compute

### Goal

Stop rebuilding the whole scene for each simulated timestamp.

### New files

* `src/geometry/shading/prepareShadingScene.ts`
* `src/geometry/shading/computeShadeSnapshot.ts`
* maybe `src/geometry/shading/annualSunAccess.ts`
* update `src/geometry/shading/index.ts`

### Refactor

Extract from `computeRoofShadeGrid.ts`:

### `prepareShadingScene(input)`

Should do once:

* build local origin
* normalize roofs to local
* normalize obstacles to prisms
* build roof surfaces
* sample roof cells
* precompute roof obstacle candidates
* keep enough metadata to later convert local cells back to lon/lat

Return something like:

```ts
interface PreparedShadingScene {
  origin: ...
  roofs: Array<{
    roofId: string
    surface: LocalRoofSurface
    samples: RoofSample[]
    obstacleCandidates: ObstaclePrism[]
  }>
  maxObstacleHeightM: number
}
```

### `computeShadeSnapshot(scene, solar)`

Should do per timestamp:

* reject if sun below horizon / too low
* compute `sunDirection`
* compute `maxShadowDistanceM`
* for each roof sample call `isPointShaded(...)`
* return lit/shaded cells only

### Why

This is the real performance win.
Without this, annual simulation is just brute-force repetition of current preview logic.

---

## Phase 2 — create annual simulation engine

### New file

* `src/geometry/shading/annualSunAccess.ts`

### Input

```ts
interface AnnualSunAccessInput {
  scene: PreparedShadingScene
  year?: number
  dateStartIso?: string
  dateEndIso?: string
  timeZone: string
  halfYearMirror: boolean
  sampleWindowDays: number
  stepMinutes: number
  lowSunElevationThresholdDeg?: number
  maxShadowDistanceClampM?: number
}
```

### Output

```ts
interface AnnualSunAccessResult {
  roofs: Array<{
    roofId: string
    sunHours: number
    daylightHours: number
    sunAccessRatio: number
    litCellCountWeighted: number
    totalCellCountWeighted: number
  }>
  heatmapCells: Array<{
    roofId: string
    cellPolygon: number[][][]
    litRatio: number
  }>
  meta: {
    sampledDayCount: number
    simulatedHalfYear: boolean
    stepMinutes: number
    sampleWindowDays: number
  }
}
```

### Algorithm

For each sampled day:

1. compute daylight window only
2. iterate timestamps with `stepMinutes`
3. compute solar position
4. compute snapshot from prepared scene
5. accumulate:

   * per roof `litFraction * deltaHours`
   * per cell `litMinutes`
   * per cell `daylightMinutes`

At end:

* `litRatio = litMinutes / daylightMinutes`
* `sunHours = Σ(litAreaFractionAtT * Δt)`

### Critical decision

Use **area-weighted sun-hours**, not “any sun touched roof = 1”.

That is the only metric worth showing.

---

## Phase 3 — sampling strategy

Ship this first:

* simulate from **winter solstice to summer solstice**
* sample every **5 days**
* sample every **30 minutes**
* count only **daylight**
* multiply by **2**

Do not start with:

* 3 seasonal anchor days
* monthly anchors
* arbitrary spring/winter calendar shortcuts

### Recommended defaults

* `sampleWindowDays = 5`
* `stepMinutes = 30`
* `halfYearMirror = true`

### Later “accurate mode”

* `sampleWindowDays = 2`
* `stepMinutes = 15`
* `halfYearMirror = false`

---

## Phase 4 — UI panel and button

### New component

* `src/app/features/sun-tools/AnnualSunAccessPanel.tsx`

### Add to

* `src/app/features/sun-tools/SunOverlayColumn.tsx`

### Panel responsibilities

* display controls
* trigger simulation manually
* show state:

  * idle
  * running
  * done
  * failed
* show metrics
* show “display heatmap” toggle

### Important

This must be **manual trigger**, not auto-run on every geometry edit.
Otherwise the app will feel broken.

---

## Phase 5 — new hook for annual simulation

### New file

* `src/app/hooks/useAnnualRoofSimulation.ts`

### Why separate hook

`useRoofShading.ts` is for:

* single datetime
* interactive preview
* coarse/final recompute during drag

Annual simulation is different:

* long-running
* explicit trigger
* chunked/batched processing
* separate result lifecycle

### Hook state

```ts
type AnnualSimulationState = 'IDLE' | 'RUNNING' | 'READY' | 'ERROR'
```

Return:

* `runSimulation()`
* `clearSimulation()`
* `state`
* `progress`
* `result`
* `heatmapFeatures`

### Cache key

Include:

* selected roofs
* obstacles
* year
* step minutes
* day window
* half-year mirror
* grid resolution
* low sun threshold

---

## Phase 6 — map heatmap visualization

### Reuse

* `src/rendering/roof-layer/roofHeatmapOverlay.ts`

This is already the right rendering path.

### Change

Do not treat heatmap as only binary shading preview.
Let it accept **continuous intensity** from annual simulation.

Current feature shape is close enough:

```ts
properties: {
  roofId: string
  shade: 0 | 1
  intensity: number
}
```

For annual simulation:

* set `intensity = litRatio`
* either ignore `shade`
* or broaden type so `shade` is optional / mode-specific

### Needed controller changes

In `useSunCastController.ts` and `sunCastController.types.ts` add:

* `annualSimulationHeatmapFeatures`
* `annualSimulationState`
* `activeHeatmapMode: 'live-shading' | 'annual-sun-access' | 'none'`

### Why

If you reuse the same heatmap array for both modes, you will create messy UI state and bugs.

---

## Phase 7 — store / state shape

Current `shadingSettings` only has:

* enabled
* gridResolutionM

That is too narrow.

### Add separate simulation settings

Do **not** shove annual options into live shading settings unless you want future confusion.

Add something like:

```ts
annualSimulationSettings: {
  sampleWindowDays: number
  stepMinutes: number
  halfYearMirror: boolean
  year: number
}
```

Files:

* `src/state/project-store/projectState.types.ts`
* `src/state/project-store/projectState.reducer.ts`
* schema/storage/share sanitize files if you persist it

If you want a shorter first version, keep this panel-local and do not persist yet.

---

## Phase 8 — progress and responsiveness

Even with good performance, annual simulation can still block the UI if done in one loop.

### First safe implementation

Batch by sampled day:

* process one sampled day
* yield to event loop
* continue

For example:

* `await Promise.resolve()` is weak
* `setTimeout(0)` batching is enough for v1
* worker thread is not needed yet

This gives:

* visible progress
* no frozen UI
* easier cancellation later

---

## Phase 9 — tests

### Geometry tests

Add:

* `src/geometry/shading/annualSunAccess.test.ts`

Cover:

* no obstacles => ratio near 1 for unobstructed roof daylight samples
* single obstacle reduces lit ratio for affected cells
* half-year mirror produces result close to full-year version
* below-horizon timestamps do not count
* low-sun threshold behaves explicitly

### Hook tests

Add:

* `src/app/hooks/useAnnualRoofSimulation.test.tsx`

Cover:

* manual run
* ready state
* clear/reset
* cache reuse

### Rendering tests

Extend heatmap tests to confirm continuous intensity is accepted, not only binary 0/1.

---

# Recommended file-level change list

## New

* `src/geometry/shading/prepareShadingScene.ts`
* `src/geometry/shading/computeShadeSnapshot.ts`
* `src/geometry/shading/annualSunAccess.ts`
* `src/app/hooks/useAnnualRoofSimulation.ts`
* `src/app/features/sun-tools/AnnualSunAccessPanel.tsx`

## Update

* `src/geometry/shading/computeRoofShadeGrid.ts`
* `src/geometry/shading/index.ts`
* `src/app/features/sun-tools/SunOverlayColumn.tsx`
* `src/app/hooks/useSunCastController.ts`
* `src/app/hooks/sunCastController.types.ts`
* `src/rendering/roof-layer/roofHeatmapOverlay.ts`
* optionally project store files if settings are persisted

---

# Execution order

## Step 1

Refactor shading engine into prepared scene + snapshot compute.

## Step 2

Build pure annual accumulator returning:

* roof metrics
* per-cell lit ratio

## Step 3

Create manual simulation hook.

## Step 4

Add panel + button.

## Step 5

Wire annual heatmap into map with explicit mode switch.

## Step 6

Add tests.

---

# What I would not do in v1

* no GPU shadow maps
* no hourly full-year brute force
* no automatic rerun on every edit
* no blending live shading and annual heatmap in one implicit state
* no 3 representative days interpolation

---

# Suggested v1 defaults

* half-year mirror: `true`
* day step: `5`
* time step: `30 min`
* grid resolution: reuse current shading grid
* low sun threshold: keep current default, but show it as part of simulation assumptions

---

# Expected output for user

For selected roofs:

* `Annual sun access: 1482 h`
* `Annual daylight considered: 1846 h`
* `Sun access ratio: 80.3%`

For map:

* annual heatmap intensity per roof cell:

  * dark = low sun access
  * bright = high sun access

---

If you want, I can turn this into a strict dev story pack: **Phase 1 / Phase 2 / Phase 3 tickets with acceptance criteria and file list**.
