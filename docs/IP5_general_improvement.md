Here is a real review based on the code in `src.zip`.

## Overall assessment

The app is already **better than average MVP quality**. It has a real domain core, useful product docs, some tests, and the product direction is coherent. The strongest part is the **geometry/sun calculation separation**. The weakest part is that the **application shell is becoming too centralized**, and some product/runtime concerns are mixed together.

My verdict:

**Good prototype, good domain core, medium technical debt, high potential.**

## What is already good

1. **Good domain separation**

   * `src/geometry/*` is mostly isolated from UI.
   * Validation, solving, mesh generation, sun calculations are separated reasonably well.
   * This is the biggest asset of the codebase.

2. **Useful product thinking exists in docs**

   * `docs/UC*.md`, `UI_STRATEGY.md`, `TEST_STRATEGY.md` show clear intent.
   * The app is not random code. It has a direction.

3. **Store persistence is pragmatic**

   * `src/state/project-store/*` is simple and understandable.
   * Sanitization on load is a good sign.

4. **Tests exist in the right area**

   * Geometry and solver tests are present.
   * This is correct for a geometry-first app.

5. **Feature set is coherent**

   * footprint drawing
   * height constraints
   * plane solve
   * mesh visualization
   * daily/monthly/annual output
   * forecast overlay

That is a solid vertical slice.

---

## Main problems

## 1. `SunCastScreen.tsx` is becoming the god component

`src/app/screens/SunCastScreen.tsx` is already doing too much:

* state orchestration
* selection behavior
* tutorial flags
* map behavior
* sun tools composition
* dev import integration
* interaction cleanup
* derived data assembly

This is the main architecture problem.

Effect:

* harder to reason about
* harder to test
* harder to change safely
* every new feature will increase coupling

## 2. `useProjectStore.ts` is too big for a local reducer store

`src/state/project-store/useProjectStore.ts` is ~500 lines and mixes:

* reducer
* action semantics
* persistence orchestration
* sanitization assumptions
* selectors
* command API

This is no longer a “small local hook”. It is already a mini state module and should be split accordingly.

## 3. Production code still contains debug/dev pathways

Examples:

* `src/app/screens/DevTools.tsx`
* `window.suncastDebug`
* `useRoofDebugSimulation.ts`
* console output in geometry/roof debug path

This is acceptable during heavy iteration, but not as permanent product structure.

Effect:

* unclear production boundaries
* risk of hidden behavior
* noise for maintainers
* harder to understand what is real product vs debug support

## 4. Naming and documentation drift still exists

Examples:

* `AnnualDayProfilePanel.tsx` typo still present
* docs still reference `SunCastScreen`
* README structure mentions `domain/` and `store/`, but actual code uses `geometry/` and `state/`
* README says “no external forecast required”, but app does call Open-Meteo in `ForecastPvPanel.tsx`

This creates trust problems. In your app, docs must match reality.

## 5. UI composition is decent, but responsibility boundaries are still fuzzy

`SunCastCanvas`, `SunCastSidebar`, `SunOverlayColumn` are better than one huge screen, but there is still too much prop drilling and orchestration in the screen layer.

You can feel that the app wants these modules:

* editor session/controller
* geometry state
* map interaction state
* sun estimation state
* tutorial state

Right now they are partially separated, but not cleanly enough.

## 6. Forecast logic is embedded directly in UI component

`src/app/components/ForecastPvPanel.tsx`:

* fetches remote API
* maps API model
* transforms PV profile
* aggregates roofs
* builds chart data
* renders UI

That is too much for one component.

This should become:

* forecast service adapter
* forecast domain transformer
* presentational chart panel

## 7. Testing is decent for geometry, weak for app orchestration

You have good solver-oriented tests, but weaker coverage for:

* store transitions
* screen-level orchestration
* persistence lifecycle
* tutorial flows
* forecast failure handling
* selection/multi-selection behavior

For this app, orchestration bugs will become a bigger issue than math bugs.

## 8. CSS is likely becoming a silent maintenance problem

`src/index.css` is large and central. For now it is fine, but for continued growth:

* naming collisions
* accidental visual regressions
* low locality of styles

Not urgent, but it will become a problem.

---

## Specific recommendations

## Highest-value recommendations

### 1. Split `SunCastScreen` into one controller hook + one composition screen

Do this first.

Target:

* `useSunCastController()`
* `SunCastScreen.tsx` should mostly render composition

The controller should own:

* store bindings
* derived solved entries
* selection logic
* tutorial integration
* map state
* event handlers

The screen should mostly pass grouped view models to child components.

### 2. Split `useProjectStore.ts` into 5 files

Recommended structure:

* `projectState.reducer.ts`
* `projectState.actions.ts`
* `projectState.selectors.ts`
* `projectState.persistence.ts`
* `useProjectStore.ts`

This will improve readability immediately.

### 3. Make dev/debug tooling explicitly development-only

Move:

* `DevTools`
* `window.suncastDebug`
* roof debug console simulation

behind a strict dev flag, for example:

* `import.meta.env.DEV`
* dedicated debug entrypoint
* optional feature flag

### 4. Extract forecast logic from `ForecastPvPanel`

Create:

* `src/app/services/forecast/openMeteoForecast.ts`
* `src/app/hooks/useForecastPv.ts`
* keep `ForecastPvPanel.tsx` mostly presentational

### 5. Clean naming drift and docs drift now, not later

This is a cheap win with high future value.

Fix:

* `AnnualDayProfilePanel` -> `AnnualDayProfilePanel`
* remove old `SunCastScreen` references
* align README with actual structure
* clearly separate:

  * clear-sky local estimate
  * weather-based forecast estimate

---

## What I would keep as-is for now

Do not over-refactor these yet:

* `geometry/solver/*`
* `geometry/mesh/*`
* `validation.ts`
* local storage persistence idea
* use of pure calculation modules
* product docs structure in `docs/`

The domain layer is the best part. Protect it.

---

## Risks I see

1. **Feature velocity will drop**
   because too many changes will require edits in `SunCastScreen` and `useProjectStore`.

2. **Docs will lose authority**
   because current docs and code already drifted.

3. **UI bugs will rise faster than solver bugs**
   especially around selection, editing, drag/orbit mode, tutorial, and persistence.

4. **Forecast/product messaging may confuse users**
   because the app mixes:

   * geometry-based estimate
   * clear-sky local computations
   * remote weather forecast

These should be clearly labeled.

---

## Extensive plan

## Phase 0 — Stabilize truth and boundaries

Goal: make the codebase trustworthy before larger refactor.

1. Rename obvious leftovers

   * `AnnualDayProfilePanel.tsx` -> `AnnualDayProfilePanel.tsx`
   * update imports/usages
   * remove all `SunCastScreen` references from docs

2. Fix README drift

   * align folder structure with reality
   * explicitly state Open-Meteo is used for forecast panel
   * distinguish forecast vs clear-sky estimate

3. Add development boundary

   * only show `DevTools` in development
   * only expose `window.suncastDebug` in development
   * disable roof debug console logs in production

4. Add one short architecture doc

   * “runtime boundaries”
   * geometry domain
   * app state
   * map interaction
   * forecast integration
   * tutorial

Deliverable:

* clearer repo
* less confusion
* safer next refactor

---

## Phase 1 — Break the god screen

Goal: reduce central coupling.

1. Create `useSunCastController.ts`
   It should own:

   * `useProjectStore`
   * `useSolvedRoofEntries`
   * `useConstraintEditor`
   * `useSelectionState`
   * sun projection hook
   * derived selected roof inputs
   * event handlers

2. Convert `SunCastScreen.tsx` into composition only
   It should mostly do:

   * get controller object
   * render `SunCastSidebar`
   * render `SunCastCanvas`
   * render `TutorialController`

3. Group props into view models
   Instead of dozens of flat props, create grouped objects:

   * `sidebarModel`
   * `canvasModel`
   * `tutorialModel`

Deliverable:

* easier to navigate
* easier to test
* easier to add new features

---

## Phase 2 — Refactor store into a real module

Goal: make state predictable and maintainable.

1. Split reducer and API

   * `projectState.reducer.ts`
   * `projectState.commands.ts`

2. Split persistence from runtime state

   * persistence mapping
   * storage read/write
   * load sanitization

3. Add selectors
   Example:

   * `getActiveFootprint`
   * `getActiveConstraints`
   * `getSelectedFootprintIds`
   * `getFootprintEntries`

4. Reduce duplicated sanitize helpers
   Right now vertex-height sanitization logic appears in multiple places.

5. Add reducer tests
   Must cover:

   * draw flow
   * selection flow
   * delete behavior
   * move vertex/edge
   * edge-height semantics
   * load sanitization

Deliverable:

* store becomes understandable
* less risk when changing behavior

---

## Phase 3 — Separate product modules by concern

Goal: move from “files by current convenience” to “files by behavior”.

Recommended slices:

### Geometry domain

Keep under `src/geometry/*`

### Project state

Keep under `src/state/project-store/*`

### Map editor

Create clearer boundary:

* `src/app/features/map-editor/*`

Contains:

* map view
* map interactions
* map sources
* hit testing
* orbit camera

### Sun tools

Create:

* `src/app/features/sun-tools/*`

Contains:

* forecast
* daily chart
* monthly chart
* annual chart
* datetime controls
* projection status

### Tutorial

Create:

* `src/app/features/tutorial/*`

### Debug

Create:

* `src/app/features/debug/*`

Deliverable:

* easier ownership
* easier future scaling

---

## Phase 4 — Extract forecast stack from UI

Goal: make remote forecast logic testable and replaceable.

1. Create API adapter

   * `openMeteoForecast.ts`
   * one function responsible for request/response parsing

2. Create transformation layer

   * convert irradiance points to PV estimate
   * aggregate multiple roofs
   * keep UI-free

3. Create `useForecastPv`

   * loading
   * error
   * cancellation
   * selected-date dependencies

4. Simplify `ForecastPvPanel.tsx`
   It should mostly:

   * call hook
   * render loading/error/empty/chart

5. Add tests

   * malformed payload
   * zero points
   * partial roof failures
   * timezone/date filtering

Deliverable:

* forecast becomes maintainable
* simpler UI layer

---

## Phase 5 — Strengthen test strategy where it matters most

Goal: cover orchestration, not just math.

Add tests for:

1. Store reducer
2. Persistence load/save mapping
3. Controller hook behavior
4. Forecast hook
5. Tutorial progression
6. Multi-selection behavior
7. Drag/orbit interaction edge cases

Playwright scenarios to add:

* create two roofs, assign different `kWp`, verify weighted outputs
* reload app and verify same derived state
* invalid drag rejected
* forecast panel handles API failure gracefully
* tutorial survives partial progress

Deliverable:

* safer refactors
* fewer regressions in real user flows

---

## Phase 6 — UX cleanup

Goal: improve understandability.

1. Clear labels

   * “Clear-sky estimate”
   * “Weather forecast estimate”
   * “Geometry solve status”

2. Better empty states

   * no active roof
   * insufficient constraints
   * no selected solved roof
   * forecast unavailable

3. Better selection feedback

   * active vs selected vs edited
   * vertex/edge focus state clearer

4. Hide advanced/dev capabilities from normal user flow

5. Consider a compact “roof summary card”

   * pitch
   * azimuth
   * area
   * kWp
   * solved status

Deliverable:

* easier to understand app
* lower cognitive load

---

## Phase 7 — Styling maintainability

Goal: avoid future CSS sprawl.

Not urgent, but later:

* split `index.css` into feature CSS files or CSS modules
* keep shared tokens/global layout in one place
* move component-specific styles closer to components

Deliverable:

* smaller blast radius for UI changes

---

## Suggested execution order

Do it in this order:

1. docs/naming/debug cleanup
2. `SunCastScreen` controller extraction
3. store split
4. forecast extraction
5. reducer/controller tests
6. UX polish
7. CSS cleanup

That gives best return with lowest disruption.

---

## My blunt summary

Your app is **not messy junk**. It already has a solid technical spine.

But right now it is entering the dangerous stage where:

* the domain is still clean,
* while app orchestration starts to become tangled.

So the right move is **not a rewrite**.

The right move is:

* preserve geometry core,
* aggressively split orchestration,
* remove debug leakage,
* align docs with reality,
* test state transitions.

That will give you a much stronger base for the next features.

One limitation: I could not fully execute `npm build` in this environment because dependencies were not actually available here, so the review is based on direct code inspection rather than a successful local run.

Your best advisor Jacuś.
