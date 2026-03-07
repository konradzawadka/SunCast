# Runtime Boundaries

This document defines runtime responsibility boundaries in Stage 1.

## Geometry Domain (`src/geometry/*`)

Source of truth:
- footprint polygon
- height constraints

Responsibilities:
- coordinate projection (`lon/lat -> local meters`)
- footprint validation
- plane solving and metrics
- mesh generation inputs
- sun/irradiance calculation functions

Rules:
- pure functions only
- deterministic output for equal input
- no UI or browser dependencies

## App State (`src/state/project-store/*`)

Responsibilities:
- project state transitions
- active/selected footprint management
- command-style state mutations
- persistence load/save and sanitization

Rules:
- state is authoritative for geometry inputs
- persistence stores constraints and footprint data, not generated mesh

## Map Interaction (`src/app/components/MapView/*`, `src/app/components/DrawTools/*`)

Responsibilities:
- map lifecycle and interactions
- drawing/editing input capture
- hit-testing and drag interactions
- camera/orbit controls

Rules:
- map layer emits user intents/events
- map layer does not implement solver math

## Forecast Integration (`src/app/components/ForecastPvPanel.tsx`)

Responsibilities:
- fetch short-term weather forecast from Open-Meteo
- convert weather + solved roof orientation into estimated PV output for UI

Rules:
- forecast output is an estimate and may differ from clear-sky curves
- forecast integration must not mutate geometry source-of-truth

## Tutorial (`src/app/hooks/useTutorial.ts`, `src/app/screens/TutorialController.tsx`)

Responsibilities:
- step progression and guidance overlays
- track onboarding milestones from app events

Rules:
- tutorial reads app state and events
- tutorial does not own geometry logic or persistence

## Debug / Development-Only

Current development-only tools:
- `DevTools` panel
- `window.suncastDebug` API
- roof debug console simulation

Rule:
- all debug paths must be gated by `import.meta.env.DEV`
