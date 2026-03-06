# UI Strategy

## Scope
Stage 1 UI supports geometry-first roof modeling on satellite imagery and keeps solver logic separate from presentation.

## Core Principles
- UI collects user input and displays outputs only.
- Geometry and sun calculations remain in pure domain modules.
- Meshes and charts are derived views, never source data.
- Persist only footprint/constraints and sun settings needed for deterministic regeneration.

## Current Layout
- Left panel: drawing, footprint selection, roof constraints, solver status.
- Map area: interactive map and roof overlay rendering.
- Right floating overlay: sun tools (`SunOverlayColumn`) with collapsible behavior.


## Component Responsibilities
- `EditorScreen`: orchestration, wiring state to UI components.
- `SunOverlayColumn`: sun input container and derived date/datetime propagation.
- `SunProjectionStatus`: projection toggle + status output.
- `SunDailyChartPanel`: daily POA visualization.
- `FootprintPanel` / `StatusPanel`: modularized editor side panel concerns.

## UI Consistency
- Reusable shadcn-style primitives in `src/components/ui`.
- Shared styling in `src/index.css` with predictable panel and control classes.
- Keep controls compact and map-first; avoid blocking map interactions.

## Testing Notes
- Unit/integration tests validate geometry and sun calculations.
- E2E flows should interact with the single sun datetime picker and verify both:
  - projection updates with time changes,
  - daily chart updates with date changes.

## Next UI Iterations
1. Add optional ISO datetime quick presets (morning/noon/evening) while preserving the same store contract.
2. Add inline validation hints for malformed/empty sun datetime.
3. Improve responsive behavior of the sun overlay on small screens.
