# BUG-2026-03-13-SUN-BEHIND-PLANE-COUNTED-AS-SUN-ACCESS

- Status: resolved
- Severity: high
- Type: simulation correctness
- Area: shading and annual sun-access metrics
- Reported impact: direct sun hours/ratios are overstated because some non-front-side timesteps are counted as sun access.

### What Was Observed

Direct roof sun access appears to be counted when all of the following are true:

1. Sun is above horizon.
2. Sun is above low-sun threshold.
3. Point/cell is not obstacle-shaded.

This misses a required condition: the roof plane must still face the sun.

### Expected Behavior

A timestep is direct sun access only when all conditions are true:

1. Sun above horizon.
2. Sun above configured low-sun threshold.
3. Roof is front-side relative to sun direction.
4. Point/cell is not obstacle-shaded.

Front-side rule:

- `dot(roofNormal, sunDirection) > epsilon`

If the dot product is `<= epsilon`, that timestep must not be counted as direct sun.

### Suspected Root Cause

The current shading/sun-access path likely checks daylight and occlusion, but does not consistently enforce plane-facing (`dot(normal, sunDir)`) before counting illumination.

### Reproduction Scenario

1. Create one roof plane with known tilt/azimuth.
2. Use no obstacles.
3. Pick a sun position that is above horizon but behind the roof plane normal.
4. Run live shading and/or annual sun-access.

Observed result: timestep may still count as sun access.
Expected result: direct sun access must be zero for that plane/timestep.

### Required Fix

1. Add shared front-side illumination guard:
   - compute `roofNormal`
   - compute `sunDirection`
   - compute `cosIncidence = dot(roofNormal, sunDirection)`
2. Enforce:
   - if `cosIncidence <= epsilon`, roof is not sun-facing and cannot be direct-sun lit
3. Apply this consistently in:
   - live shading visualization
   - annual sun-access accumulation

Suggested tolerance:

- `epsilon = 0.01` (or equivalent small positive threshold)

### Resolution Implemented

1. Added a front-side direct-sun guard in `computeShadeSnapshot`:
   - compute roof normal from plane coefficients
   - compute `cosIncidence = dot(roofNormal, sunDirection)`
   - treat roof as non-lit when `cosIncidence <= 0.01`
2. Applied this in the shared snapshot path used by both:
   - live shading (`computeRoofShadeGrid` -> `computeShadeSnapshot`)
   - annual simulation (`computeAnnualSunAccess` -> `computeShadeSnapshot`)
3. Added `isSunFacing` flag to snapshot roof outputs and updated annual aggregation so
   denominator hours are accumulated only for sun-facing timesteps.
4. Updated annual panel wording from generic daylight to sun-facing denominator semantics.
5. Added regression tests:
   - `src/geometry/shading/computeShadeSnapshot.test.ts`
   - verifies roof cells are not marked lit when sun is behind the plane.
   - `src/geometry/shading/annualSunAccess.test.ts`
   - verifies non-front-side winter daylight does not enter annual denominator.

### Metric Semantics Update

To avoid denominator ambiguity, track separate counters:

- `skyDaylightHours`
- `frontSideHours`
- `unshadedFrontSideHours`

Then derive:

- `sunAccessRatio = unshadedFrontSideHours / frontSideHours`

Direct roof sun-access should never use generic daylight hours as denominator.

### Acceptance Criteria

1. Direct sun is counted only when `dot(roofNormal, sunDirection) > epsilon`.
2. Roofs facing away from sun are never marked as direct-sun lit.
3. Annual sun-access excludes non-front-side daylight.
4. Live shading distinguishes:
   - sun-facing and lit
   - sun-facing but shaded
   - not sun-facing

### One-Line Judgment

Current logic appears to model "unobstructed daylight above horizon" in some paths, not strict "direct sun on roof plane," which overcounts sun access.
