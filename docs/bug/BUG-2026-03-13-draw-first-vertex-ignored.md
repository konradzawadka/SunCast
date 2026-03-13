# BUG-2026-03-13-DRAW-FIRST-VERTEX-IGNORED

- Status: resolved
- Area: map editing (`src/app/features/map-editor/MapView/mapInteractionHandlers.ts`)
- Reported impact: first draw click did not create a draft vertex; `Finish Polygon` stayed disabled.

### What Was Investigated

1. E2E draw flow (`UC0`) where vertex count remained `0` after map clicks.
2. Map interaction click handler behavior in drawing mode.
3. Condition that decides between:
   - `onMapClick` (append draft point)
   - `onCloseDrawing` (close polygon)

### Root Cause

In `handleClick`, the close-polygon guard used optional chaining:

- `drawInteraction?.closePolygonPoint !== null`

For the first click (`drawDraft.length === 0`), `computeDrawingInteraction(...)` returns `null`.
That made the expression evaluate as `undefined !== null` -> `true`, so the handler incorrectly called `onCloseDrawing` instead of appending the point.

### Resolution Implemented

1. Tightened the close check to require a non-null interaction object before closing:
   - `drawInteraction && drawInteraction.closePolygonPoint !== null`
2. Added regression unit test:
   - `src/app/features/map-editor/MapView/useMapInteractions.test.tsx`
   - Case: first draft click must call `onMapClick` and must not call `onCloseDrawing`.

### Validation Evidence

1. Unit:
   - `npm run test -- src/app/features/map-editor/MapView/useMapInteractions.test.tsx`
2. E2E:
   - `npm run test:e2e -- e2e/uc-strategy.spec.ts --grep "UC0: bootstrap and footprint validation flow"`

Both pass after the fix.
