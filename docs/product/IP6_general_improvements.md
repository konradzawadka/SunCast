Below is a handover-grade review of `src.zip`.

**Overall verdict**

This is **not a toy repo**. The app already has real structure, domain separation, test intent, and product thinking.
But it is **not yet vendor-perfect**. The main gaps are:

1. **delivery/CI reliability**
2. **handover readability**
3. **performance scaling**
4. **browser/runtime hardening**
5. **docs consistency**

Current state: **solid advanced prototype / early product**, not yet “force on vendor everything perfect”.

## What is already strong

**Architecture**

* Good separation of concerns:

  * `src/geometry/*` for solver/domain
  * `src/state/project-store/*` for state/persistence
  * `src/rendering/*` for 3D roof rendering
  * `src/app/features/*` for UI features
* The best architectural rule is already present: **geometry + constraints are source of truth**, meshes are derived.
* Share/persistence flow is reasonably isolated.
* External service access is partially abstracted, e.g. place search provider.

**Engineering discipline**

* There are many tests: geometry, store, hooks, E2E, forecast, share codec.
* There are docs for test strategy, runtime boundaries, UI strategy, and multiple feature/UC docs.
* Reducer-driven store is deterministic and easier to reason about than ad hoc `useState` spread across UI.
* Good use of pure functions in geometry domain.

**Product**

* The app already feels like a coherent product, not just a map demo:

  * drawing
  * roof constraints
  * 3D/orbit
  * daily/annual charts
  * forecast
  * onboarding tutorial
  * shareable state
  * address search

That is a strong base.

---

## Critical issues to fix before vendor handover

### 1. Placeholder

### 2. Handover readability is limited by “god files”

Largest files are too big:

* `src/app/hooks/useSunCastController.ts` — **562 lines**
* `src/app/features/map-editor/MapView/useMapInteractions.ts` — **393 lines**
* `src/state/project-store/projectState.reducer.ts` — **370 lines**
* `src/app/features/map-editor/MapView/MapView.tsx` — **301 lines**

This is the main maintainability risk.

What it means:

* logic is structured, but still too centralized
* onboarding a vendor will take longer
* regressions become easier during refactor

Highest-priority split:

* `useSunCastController.ts`

  * project orchestration
  * selection/editing logic
  * share flow
  * tutorial flow
  * sun/forecast view-model composition
* `useMapInteractions.ts`

  * drawing hover logic
  * selection/hit testing
  * drag logic
  * orbit steering
* reducer

  * selection actions
  * drawing actions
  * geometry mutation actions
  * persistence/hydration actions

### 3. Docs are good, but not trustworthy enough yet

Several docs are stale relative to actual code.

Examples:

* `runtime_boundaries.md` points to old paths like `src/app/components/MapView/*`
* `AGENTS.md` references `EditorScreen.tsx` and structure that no longer matches current `SunCast*` naming
* README structure is incomplete / partially outdated

Impact:

* vendor reads docs, then sees different code
* trust drops fast
* handover cost rises

Required:

* make docs match current repo exactly
* define one authoritative architecture doc
* archive old iteration docs or mark them as historical

### 4. No real release-quality validation pipeline

Only GitHub Pages deploy exists. Missing:

* PR validation workflow
* coverage publishing
* artifact retention
* preview environments
* dependency update automation
* branch protection assumptions
* build badge / status visibility

For a frontend-only app, DevOps is simple, but it still needs to be disciplined.

### 5. No production observability

I do not see:

* runtime error tracking
* structured logging
* performance telemetry
* feature usage telemetry
* service failure monitoring

For a vendor handover this matters, especially because the app depends on:

* map tiles
* Photon geocoding
* Open-Meteo forecast
* browser APIs like `CompressionStream`

Without observability, the vendor inherits blind spots.

---

## Architecture review

### Rating: **7.5/10 now**, **9/10 after cleanup**

**Good**

* Domain-first design is the correct choice.
* Geometry modules are mostly pure and testable.
* State reducer is a reasonable boundary.
* Rendering is derived from solver output, which is correct.

**Weak**

* UI orchestration layer is too fat.
* Hook/view-model pattern is good, but current controller became a catch-all.
* Store is local-hook based; good for now, but may strain if app grows further.
* Some feature boundaries are conceptual rather than enforced.

### Recommended target architecture

Keep the same shape, but harden boundaries:

* `geometry/`

  * pure, deterministic, zero browser usage
* `application/` or `app/services/`

  * orchestration/use-cases
  * share import/export
  * forecast composition
* `state/`

  * reducer/selectors/commands only
* `infrastructure/`

  * external APIs: Photon, Open-Meteo, storage, URL hash
* `ui/`

  * components/screens only

Right now infrastructure concerns are mixed into UI/hooks more than ideal.

---

## Stability review

### Good

* Strong test footprint.
* Share payload validation exists.
* Persistence sanitization exists.
* Geometry validation exists before applying moves.
* Errors are surfaced in several flows.

### Risks

* `CompressionStream` / `DecompressionStream` in `src/shared/utils/shareCodec.ts` can fail on unsupported browsers. Current behavior throws user-facing error, but there is no fallback codec.
* `useProjectStore.ts` hydrates from hash/localStorage, but persistence versioning is weak. `solverConfigVersion` is stored, but not meaningfully enforced on read.
* External APIs have no retry/backoff/cache strategy.
* No global error boundary around app root.
* No “safe degraded mode” if map/provider/forecast fails.

### Required

* add React error boundary
* add feature-level fallback UI for:

  * map unavailable
  * search unavailable
  * forecast unavailable
  * share unsupported
* make storage/share schema versioning explicit and enforced
* add browser capability guard for share compression with fallback:

  * plain base64 JSON
  * or lightweight compression library

---

## Performance review

### Current performance is probably okay for small/medium projects

But scaling risks are visible.

### Main issue

`useSolvedRoofEntries.ts` recomputes solve + mesh + metrics for **all footprints** inside one `useMemo`.
That is okay for a few roofs, but once user projects grow, every relevant state update can become expensive.

Symptoms you will likely hit later:

* sluggish sidebar changes
* drag latency
* orbit/render delays
* chart recomputation spikes

### Recommendations

* cache solved results per footprint using stable fingerprint of:

  * polygon vertices
  * constraints
  * pitch adjustment
* separate “active footprint immediate recompute” from “background aggregate recompute”
* memoize selectors more aggressively
* avoid rebuilding view-model objects too often in `useSunCastController`
* consider workerization later for:

  * annual estimation
  * daily estimation
  * batch solve/mesh generation

### Other performance notes

* `MapView.tsx` and `useMapInteractions.ts` are interaction-heavy and deserve profiling.
* Forecast calls are per selected roof. For many selected roofs this will fan out into many network requests.
* There is no obvious request dedup/cache around forecast and search.

---

## DevOps review

### Rating: **4/10 now**

Because the app is static frontend, DevOps should be easy. That makes the current gaps more noticeable.

### Missing / weak

* no PR checks
* no CI test workflow
* no coverage gate in CI
* no dependency bot
* no release/versioning process
* no environment matrix
* no reproducible local setup guarantee
* no artifact packaging for handover

### Minimum vendor-grade setup

* workflow `ci.yml`

  * `npm ci`
  * `npm run lint`
  * `npm run test`
  * `npm run build`
  * optional Playwright smoke
* workflow `deploy.yml` only after CI passes
* coverage upload artifact
* Dependabot / Renovate
* release tags + changelog
* `NODE_VERSION` pinned consistently

---

## Documentation review

### Rating: **6.5/10 now**

There is a lot of documentation, which is good.
But volume is not the same as handover quality.

### Good

* many UC docs
* architecture intent exists
* test strategy exists
* runtime boundaries exist

### Weak

* stale paths/names
* too many iteration docs dilute the real source of truth
* missing concise “how to own this repo” document

### You need 5 handover docs only

1. **ARCHITECTURE.md**
   current boundaries, major flows, external dependencies

2. **RUNBOOK.md**
   install, build, test, deploy, common failures

3. **DECISIONS.md**
   key ADR-style decisions and tradeoffs

4. **FEATURES.md**
   what is implemented vs planned vs experimental

5. **VENDOR_HANDOVER.md**
   known risks, priority backlog, code hotspots, acceptance criteria

Everything else can stay, but must be clearly marked as:

* active
* draft
* archived

---

## UX review

### Good

* product flow is understandable
* tutorial onboarding is a strong addition
* place search reduces friction
* share project is good product thinking
* map-first layout fits the use case

### Gaps

* app still looks engineering-first, not trust-first
* some terminology may be clear to you, but not to a new operator/vendor/user
* error recovery could be more explicit
* no obvious progressive disclosure for advanced concepts
* forecast/date behavior may confuse users because code uses **UTC** for forecast date handling in `useForecastPv.ts`

### Concrete UX improvements

* distinguish clearly:

  * geometry setup
  * capacity setup
  * sun simulation
  * weather forecast
* add “data source / assumptions” info panel
* add empty states and failure states that explain next action
* reduce cognitive load in sidebar by grouping sections:

  * Draw
  * Roof setup
  * Simulation
  * Forecast
  * Share
* consider “basic mode / advanced mode”

---

## New feature review

Feature direction is strong, but before adding more features, fix handover quality first.

### Features that fit the product well

* project library / multiple saved scenarios
* export report PDF
* manual roof naming
* energy consumption overlay / self-consumption scenario
* panel efficiency / losses presets
* shading layer or obstruction inputs
* import from map-selected building footprint
* compare multiple roof variants

### Features that should wait

* heavy backend
* multi-user collaboration
* complex account system
* vendor integrations
* advanced CAD/BIM export

Right now the product gains more from **stability + trust + explainability** than from more surface area.

---

## Security / robustness review

This is a client app, so classic backend security is limited, but still:

### Good

* share payload validation exists
* numeric validation exists in several places

### Missing

* explicit CSP guidance
* dependency update discipline
* stronger validation of imported/shared payload size
* runtime guards around third-party API failure modes
* no anti-corruption boundary for external responses beyond light parsing

### Add

* max share payload decompressed size
* safe parse guards everywhere external data enters app
* dependency review in CI
* simple security notes in README/handover docs

---

## Best concrete findings from code

### Strong positives

* `useSolvedRoofEntries.ts` is conceptually clean.
* `projectState.share.ts` validation is a good sign.
* `projectState.sanitize.ts` shows real defensive thinking.
* `useConstraintEditor.ts` guards invalid geometry edits.
* tests cover important numeric and app flows.

### Specific concerns

* `useSunCastController.ts` is carrying too much coordination logic.
* `useMapInteractions.ts` is a likely long-term bug hotspot.
* `useForecastPv.ts` uses fixed `UTC`, which is product-risky for local date expectations.
* `usePlaceSearch.ts` supports only `de/en/fr`; localization is limited and odd for a x-centered product.
* Docs still mention old paths/names, which is bad for handover.

---

## Priority order

### P0 — must do before vendor handover

* fix CI pipeline
* add validation workflow
* split `useSunCastController`
* split `useMapInteractions`
* align docs with current code
* add error boundary + degraded states
* produce real handover docs

### P1 — should do immediately after

* cache solved footprints
* add forecast/search caching and resilience
* enforce schema version migration strategy
* add observability
* add coverage visibility in CI

### P2 — after handover hardening

* performance optimization for larger projects
* report export
* scenario comparison
* stronger UX polish

---


