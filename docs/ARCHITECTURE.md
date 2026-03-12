# SunCast Architecture

## Source Of Truth

The system is geometry-first.

```text
footprint polygon + height constraints -> solved plane -> generated mesh
```

Generated meshes are derived render artifacts and are never persisted as source data.

## Runtime Boundaries

- `src/geometry/*`: pure deterministic geometry, solver, projection, sun math.
- `src/state/project-store/*`: reducer-based project state, persistence, share payload hydration.
- `src/app/hooks/*`: application orchestration (selection, interactions, compose UI models).
- `src/app/features/map-editor/*`: map interactions, drawing, hit-testing, camera/orbit tools.
- `src/rendering/roof-layer/*`: MapLibre custom layers for roof and obstacle meshes.
- `src/app/features/sun-tools/*`: projection, charts, weather forecast integration.
- `src/app/features/place-search/*`: Photon provider + search panel.

## Main Data Flows

1. Draw/edit footprint in map tools.
2. Write footprint and constraints to project store.
3. Solve roof plane in `useSolvedRoofEntries`.
4. Compute metrics and mesh from solved plane.
5. Render meshes via `RoofMeshLayer` instances and display metrics/charts in sidebar/overlays.

## External Dependencies

- ArcGIS World Imagery tile source via MapLibre style.
- Photon geocoding API for place search.
- Open-Meteo irradiance forecast for weather-based chart.

## Reliability Model

- Geometry modules are pure functions and unit-tested.
- Runtime guarded by `AppErrorBoundary` for degraded mode.
- Map initialization failures degrade to sidebar-only mode with explicit UI notice.
- External provider errors (search/forecast/share) are surfaced as non-fatal status messages.
