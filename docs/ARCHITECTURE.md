# SunCast Architecture

## Source Of Truth

The system is geometry-first.

```text
footprint polygon + height constraints + obstacle inputs + shading settings
-> solved planes + shade metrics
-> generated meshes + overlays
```

Canonical persisted inputs:
- footprints
- height constraints
- obstacle definitions (shape/kind/height)
- sun projection + shading settings

Derived-only artifacts (never canonical persisted source data):
- solved roof planes
- generated roof/obstacle meshes
- shading grids / annual heatmap cells
- rendering buffers and map interaction state

## Runtime Boundaries

- `src/geometry/*`: pure deterministic geometry, solver, projection, sun math.
- `src/geometry/obstacles/*`: obstacle shape model + conversions for shading/mesh generation.
- `src/geometry/shading/*`: deterministic shade snapshot/grid/annual sun-access computations.
- `src/app/editor-session/*`: ephemeral editing/session boundary (selection/drafts/interaction UI state).
- `src/app/analysis/*`: derived computation boundary (solved roofs, live shading, annual simulation, heatmap mode, diagnostics).
- `src/app/presentation/*`: screen-facing composition models (`sidebar`, `canvas`, `tutorial`) consuming document/session/analysis contracts.
- `src/state/project-store/*`: reducer/commands/storage/share hydration; owns canonical project-document state and composes document + session reducers.
- `src/app/hooks/*`: thin compatibility/composition hooks (legacy entry points and feature hooks).
- `src/app/features/map-editor/*`: map interactions, drawing, hit-testing, camera/orbit tools.
- `src/app/features/map-editor/MapView/hooks/*`: map/render bridge hooks (layer sync, navigation sync, sun-perspective camera sync, map init lifecycle).
- `src/app/features/map-editor/MapView/roof-layer/*`: MapLibre custom layers for roof/obstacle meshes and roof heatmap overlays.
- `src/app/features/sun-tools/*`: projection, charts, weather forecast integration.
- `src/app/features/place-search/*`: Photon provider + search panel.

## Main Data Flows

1. Map/UI interactions emit edit intents and update the composed store (document + editor session).
2. `project-store` owns persisted canonical inputs; `editor-session` owns transient runtime interaction state.
3. `analysis` derives solved roofs, selected roof inputs, live shading, annual simulation output, and typed diagnostics from document + session guards.
4. `presentation` models shape UI-facing contracts for sidebar/canvas/tutorial from document/session/analysis boundaries.
5. `MapView/hooks` synchronize typed presentation outputs into MapLibre/Three layers (geometry, visibility, camera, navigation).
6. Rendering layers consume derived mesh/heatmap geometry only; they do not redefine domain behavior.
7. Storage/share persist and hydrate canonical document data; active/selection ids are intentionally non-canonical in persisted payloads.

## Presentation Composition

Current top-level composition is intentionally split:

```text
SunCastScreen
  -> useSunCastPresentationState()
      -> useProjectDocument()
      -> useEditorSession()
      -> useAnalysis()
  -> useSidebarModel()
  -> useCanvasModel()
  -> useTutorialModel()
```

`useSunCastController` remains as a thin compatibility wrapper over this composition.

## Performance Model

- Live shading uses progressive compute: coarse during active geometry interaction, final resolution after interaction settles.
- Shading requests are memoized by deterministic geometry/time fingerprints.
- Annual simulation supports batched yielding and optional half-year mirroring to reduce compute cost.
- Heatmap overlay triangulation/projection is worker-first; worker failures stop heatmap processing and surface typed errors.
- Rendering layers share one Three.js renderer per WebGL context (ref-counted).
- Custom 3D map layers use per-layer anchor rebasing to keep vertex coordinates near zero and avoid float32 precision artifacts in Mercator world space.

## External Dependencies

- ArcGIS World Imagery tile source via MapLibre style.
- Photon geocoding API for place search.
- Open-Meteo irradiance forecast for weather-based chart.

## Reliability Model

- Geometry modules are pure functions and unit-tested.
- Runtime faults are reported through `AppErrorBoundary` and global error toasts.
- Operational failures use typed app errors (`code`, `severity`, `recoverable`, `context`) and `Result<T, E>` at storage/share/mesh/worker boundaries.
- Central `reportAppError` records failures; feature behavior is fail-closed for invalid state and processing errors.
- Map initialization failures are surfaced as typed app errors.
- Heatmap worker failures stop heatmap processing and surface explicit in-app error reporting.
- Project load path validates persisted payloads and rejects invalid state.
- Storage payloads are schema-versioned; unknown future schema versions are rejected to avoid silent corruption.
- External provider errors (search/forecast/share) are surfaced as typed errors without stale-data fallback.
