# UC0.1 Improvement: Single-Plane Roof Solver (MVP)

This document upgrades the current approach into an implementation-ready Stage 1 spec.

## Locked Solver Rules

1. Edge height = endpoints only.
Setting an edge height constrains only the two edge vertices to `z_m`.
No additional points are sampled on the edge.

2. Roof is planar (single face in MVP).
If constraints cannot define one valid plane, solver returns an error state.
No non-planar fallback in Stage 1.

3. Scope remains single-face and continuous.
No split lines, no vertical steps, no multi-face handling in UC0.1.

## Improvement Goals

1. Make solving deterministic and geometry-first.
2. Prevent ambiguous or unstable input states.
3. Keep UI logic separate from geometry logic.
4. Ensure persisted projects always regenerate identical results.

## Deterministic Geometry Pipeline

1. Validate footprint topology:
- minimum 3 distinct vertices
- non-self-intersecting polygon

2. Convert all footprint vertices from lon/lat to local meters.

3. Normalize constraints into a point set:
- vertex constraint => one constrained point `(x, y, z)`
- edge constraint => two constrained points, one for each endpoint
- if a vertex has multiple constraints, keep exactly one effective `z` (see conflict rule below)

4. Validate plane solvability:
- need at least 3 constrained points
- at least 3 must be non-collinear in XY

5. Solve plane in meters:
- base form: `z = p*x + q*y + r`
- exactly 3 points => direct solve
- 4+ points => least-squares solve

6. Produce solved roof:
- evaluate `z` for every footprint vertex
- compute derived metrics (pitch, min/max height)
- pass only solved vertices + plane params to rendering

## Conflict and Error Rules

Reject with explicit error code/message when:

1. `FOOTPRINT_INVALID`
- polygon is self-intersecting or has < 3 valid vertices

2. `CONSTRAINTS_INSUFFICIENT`
- fewer than 3 constrained points after edge expansion

3. `CONSTRAINTS_COLLINEAR`
- constrained points exist but cannot define a plane

4. `CONSTRAINTS_CONFLICTING`
- same vertex receives two different height values above tolerance

Warn (do not reject) when:

1. `CONSTRAINTS_OVERDETERMINED`
- solved with least-squares due to 4+ effective points

2. `CONSTRAINTS_RESIDUAL_HIGH`
- input points deviate from solved plane above tolerance

Recommended numeric tolerances:

- `heightConflictEpsilonM = 0.01`
- `collinearityAreaEpsilonM2 = 1e-6`
- `planeResidualWarnEpsilonM = 0.03`

## Data Contract (Source of Truth)

Persist:

1. footprint lon/lat ring
2. user constraints (vertex + edge)
3. solver options/tolerances version

Do not persist:

1. triangulated mesh
2. derived vertex Z list as canonical state

Derived artifacts must be regenerated from persisted footprint + constraints.

## UI Contract

UI responsibilities:

1. let user select vertex/edge and enter height
2. display errors/warnings from solver
3. display solved roof and metrics

UI must not:

1. perform plane math
2. infer hidden constraints
3. mutate solved geometry outside geometry module

## Acceptance Criteria (UC0.1)

1. Given 3 valid non-collinear constrained points, solver returns a single deterministic plane.
2. Given an edge height, both edge endpoints resolve to the same constrained height.
3. Given conflicting heights for one vertex, solver returns `CONSTRAINTS_CONFLICTING`.
4. Given insufficient constraints, solver returns `CONSTRAINTS_INSUFFICIENT`.
5. Reloading the same project yields identical plane coefficients and vertex heights within tolerance.

## Recommended Implementation Split

1. `src/geometry/solver/normalizeConstraints.ts`
- convert vertex/edge constraints into effective constrained points

2. `src/geometry/solver/fitPlane.ts`
- direct fit (3 points) + least-squares fit (N points)

3. `src/geometry/solver/solveRoofPlane.ts`
- validation + error/warn orchestration + solved vertex generation

4. `src/state/project-store/*`
- persist only footprint + constraints + solver config version
