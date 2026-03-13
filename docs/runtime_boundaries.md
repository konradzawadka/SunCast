# Runtime Boundaries

This document defines current runtime boundaries and allowed responsibilities by module group.

## Geometry Domain (`src/geometry/*`)

Canonical inputs:
- footprint polygons
- roof constraints (vertex/edge heights)
- obstacle inputs (kind/shape/height)
- shading/simulation parameters

Responsibilities:
- coordinate projection (`lon/lat -> local meters`)
- footprint/constraint validation
- plane solving and roof metrics
- roof/obstacle mesh input generation
- shading scene preparation and shade/annual simulation math
- sun/irradiance calculations

Rules:
- pure functions only
- deterministic output for equal input
- no React/DOM/MapLibre/browser-storage dependencies
- no persistence or side effects

## App State (`src/state/project-store/*`)

Responsibilities:
- reducer transitions and command-style updates
- active/selected footprint and obstacle management
- persistence load/save
- payload sanitization/migration
- share payload mapping/import/export

Rules:
- state is authoritative for canonical inputs
- persisted data includes footprints/constraints/obstacles/sun+shading settings
- persisted data must not store derived meshes, solved planes, or shading output grids
- unknown future schema versions are rejected (fail-closed)

## App Orchestration (`src/app/hooks/*`)

Responsibilities:
- compose sidebar/canvas/tutorial/sun-tools view models
- coordinate selection/editing flows
- connect store state with geometry computations
- schedule progressive shading and annual simulation runs

Rules:
- orchestration may call geometry/store/rendering adapters
- orchestration must not implement solver/shading math directly
- long-running work must preserve UI responsiveness (throttling, yielding, caching policies)

## Map Interaction (`src/app/features/map-editor/*`)

Responsibilities:
- MapLibre lifecycle and source synchronization
- drawing/editing input capture for roof + obstacle flows
- hit-testing, drag interactions, orbit controls
- map overlay state wiring

Rules:
- interaction routing is target-based (`roof` / `obstacle`), not mode-gated solver duplication
- map layer emits intents/events only
- map interaction must not implement geometry solver logic

## Rendering (`src/rendering/*`)

Responsibilities:
- consume solved/derived geometry and render it
- transform mesh/shading outputs into GPU-friendly buffers
- handle worker-assisted overlay preparation where applicable

Rules:
- rendering must not redefine business/solver rules
- renderer instances should be shared per WebGL context when layering custom 3D layers
- worker paths require safe synchronous fallback behavior

## Sun Tools And Forecast (`src/app/features/sun-tools/*`)

Responsibilities:
- user-facing sun projection controls
- annual sun-access simulation UI orchestration
- weather forecast fetch and PV-estimate presentation

Rules:
- forecast output is advisory and non-authoritative for geometry
- simulation outputs are derived (non-canonical) artifacts
- external/API failures degrade to non-fatal status with local editing preserved

## Tutorial (`src/app/features/tutorial/*`)

Responsibilities:
- onboarding overlays and progression
- milestone tracking from app state/events

Rules:
- tutorial reads app state
- tutorial does not own geometry logic or persistence

## Debug / Development-Only

Development-only tools:
- `DevTools` panel
- `window.suncastDebug` API
- roof debug simulation

Rule:
- all debug paths must be gated by `import.meta.env.DEV`
