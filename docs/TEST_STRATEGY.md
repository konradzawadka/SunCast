# SunCast Test Strategy (Playwright-First)

## Goals

1. Validate user-visible behavior end-to-end in a real browser.
2. Keep geometry logic deterministic and correct.
3. Measure code coverage from Playwright runs as the primary metric.

## Testing Pyramid For This Project

1. Playwright E2E (primary)
   - Covers the full stack: UI, map interactions, state, solver integration, rendering overlay.
   - Coverage reports are generated from these tests.
2. Pure geometry unit tests (secondary)
   - Covers edge cases that are hard to exercise through UI only.
   - No coverage gate is derived from unit tests.

## Playwright Scope (Must Cover)

1. App bootstrap
   - Editor loads.
   - Map canvas appears.
2. Footprint flow
   - Draw polygon.
   - Reject invalid polygon states.
   - Finish drawing only when valid.
3. Constraint editing
   - Set/clear vertex heights.
   - Set/clear edge heights.
   - Active constraints panel updates correctly.
4. Solver feedback
   - Valid constraints produce pitch output.
   - Insufficient constraints show validation error.
   - Over-constrained setup shows warning path.
5. Rendering
   - Roof mesh overlay appears after solving.
   - Mesh visibility toggle visibly changes output in orbit mode.
6. Persistence
   - Save project.
   - Reload project and verify identical derived geometry outcomes.
7. Determinism
   - Same footprint + constraints produce same pitch/azimuth/mesh metadata on reload.

## Unit Test Scope (Keep)

1. `fitPlane`, `solveRoofPlane`, `metrics`, `generateRoofMesh`.
2. Validation and normalization paths for malformed inputs.
3. Numeric edge cases:
   - nearly collinear points
   - tiny/large coordinate values
   - mixed edge + vertex constraints
   - layer rebasing precision guard (`layerRebasing.test.ts`) to ensure 1 m-scale geometry does not collapse after float32 quantization

## Coverage Policy

Coverage is generated only from Playwright runs:

1. Run instrumented app in Vite `coverage` mode.
2. Playwright writes browser Istanbul blobs to `.nyc_output/`.
3. `nyc report` produces:
   - `coverage/index.html`
   - `coverage/lcov.info`
   - text summary in CI logs

Recommended gates (start point):

1. Global: Lines >= 75%, Branches >= 65%, Functions >= 75%.
2. Critical geometry modules: Lines >= 90%.

Raise thresholds as E2E suite expands.

## Commands

```bash
npm run test:e2e
npm run test:e2e:coverage
npm run coverage:e2e:report
npm run coverage:e2e
```

## CI Order

1. `npm run lint`
2. `npm run test` (geometry/unit correctness)
3. `npm run coverage:e2e` (Playwright + coverage report)

## Notes

1. Geometry remains source-of-truth: E2E assertions should verify geometry outputs, not mesh internals only.
2. Prefer stable `data-testid` selectors and deterministic map interactions.
3. For visual checks, keep ROI-based screenshot assertions to avoid flaky full-frame diffs.
