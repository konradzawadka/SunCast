# Agents Guide (AI + human contributors)

This repository builds a **React application for placing dimension-accurate 3D objects and roof planes on a satellite map**.

The system allows users to:
- draw a **2D footprint**
- assign **heights to vertices or edges**
- generate **planar 3D roof surfaces**
- measure pitch, azimuth, and roof geometry

> **Golden rule:** the **source of truth is geometry + constraints**, never generated meshes.

---

# Read this first

`AGENTS.md` is an entry document, not the full contract.

All contributors must also read the relevant docs before making changes:

## Core repository contract

- `README.md` — repository entry point, local setup, main commands
- `docs/README.md` — docs index and canonical vs historical docs split
- `docs/ARCHITECTURE.md` — system shape, module boundaries, major flows
- `docs/runtime_boundaries.md` — allowed dependency directions and runtime separation
- `docs/DECISIONS.md` — architectural decisions that must not be accidentally reversed
- `docs/FEATURES.md` — current product capabilities and intended surface area

## Delivery and vendor-control docs

- `docs/VENDOR_HANDOVER.md` — handover expectations and transfer context
- `docs/PR.md` — PR strategy, branch naming, review scope, merge discipline
- `docs/RUNBOOK.md` — operational handling, failure handling, recovery expectations
- `docs/TEST_STRATEGY.md` — expected proof for correctness, regression, and risk-based validation
- `docs/VENDOR_EXECUTION_GUARDRAILS.md` — normative delivery rules; this should be treated as binding when present

## Iteration / planning docs

- `docs/product/UC*` and `docs/product/IP*` — useful context only; not the canonical implementation contract

## Priority when docs differ

Use this order of authority:

1. `docs/VENDOR_EXECUTION_GUARDRAILS.md`
2. `docs/ARCHITECTURE.md` and `docs/runtime_boundaries.md`
3. `docs/DECISIONS.md`
4. `docs/TEST_STRATEGY.md` and `docs/PR.md`
5. `README.md` and `docs/FEATURES.md`
6. iteration docs (`UC*`, `IP*`)

If a change conflicts with higher-priority docs, the change is wrong unless those docs are updated in the same PR.

---

# Quick workflow (what to do first)

1. **Understand geometry model**
   - Footprint polygon
   - Vertex/edge height constraints
   - Plane solver → roof mesh

2. **Read the architectural contract**
   - `docs/ARCHITECTURE.md`
   - `docs/runtime_boundaries.md`
   - `docs/DECISIONS.md`

3. **Read the delivery contract**
   - `docs/PR.md`
   - `docs/TEST_STRATEGY.md`
   - `docs/VENDOR_EXECUTION_GUARDRAILS.md`

4. **Implement solver logic first when touching geometry**
   - Convert coordinates → meters
   - Fit plane from constraints
   - Generate 3D vertices

5. **Integrate with map/UI only after domain logic is stable**
   - Display satellite tiles
   - Draw footprints
   - Select vertex / edge

6. **Persist only canonical project state**
   - Save footprint + constraints + explicit project inputs
   - Regenerate geometry deterministically

---

# Repository map (illustrative)

```text
root/
  docs/
  src/
    app/
      components/
      hooks/
      screens/
    geometry/
      solver/
      mesh/
      projection/
    rendering/
      roof-layer/
    state/
      project-store/
    types/
  public/
  config/
```

See `docs/ARCHITECTURE.md` for the current authoritative structure.

---

# Architecture principles

## Geometry-first system

Everything derives from:

```text
footprint polygon
+ height constraints
-------------------
roof planes
+ meshes
```

Meshes are **derived artifacts** and must never become the source of truth.

This must remain aligned with:
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/VENDOR_EXECUTION_GUARDRAILS.md`

---

## Coordinate system

All geometry calculations must run in **meters**.

Workflow:

```text
lon/lat
→ local planar coordinates (meters)
→ geometry solving
→ mesh generation
→ rendered back on map
```

Never run geometric solvers directly in lon/lat.

See also:
- `docs/ARCHITECTURE.md`
- `docs/runtime_boundaries.md`
- `docs/VENDOR_EXECUTION_GUARDRAILS.md`

---

## Roof modeling model

Any roof is treated as **one or more planar faces**.

Planes are solved from **user constraints**.

Constraints may include:

```text
vertex height
edge height
```

Minimum requirement for a plane:

- **3 non-collinear constrained points**

Validation details and product-surface expectations should match:
- `docs/FEATURES.md`
- `docs/TEST_STRATEGY.md`

---

# Coding rules

## Geometry engine

- Must be **pure functions**
- No UI dependencies
- Deterministic outputs

Example modules:

```text
fitPlane()
solveRoofPlane()
generateRoofMesh()
```

If you change geometry behavior, update:
- tests in the same PR
- `docs/ARCHITECTURE.md` when boundaries change
- `docs/DECISIONS.md` when a design rule changes

---

## UI responsibilities

UI only:

- collects user constraints
- displays geometry
- surfaces workflow state
- delegates business logic

UI must **never implement geometry logic**.

For boundary expectations, see:
- `docs/runtime_boundaries.md`
- `docs/VENDOR_EXECUTION_GUARDRAILS.md`

---

## Rendering

Rendering must consume **solver outputs** only.

Preferred architecture:

```text
MapLibre
  + satellite tiles
  + 2D drawing layer
  + 3D mesh overlay
```

Rendering must not redefine domain behavior.

---

# Validation rules

Reject geometry if:

- footprint self-intersects
- fewer than **3 vertices**
- constraints insufficient to define plane

Warn if:

- constraints over-constrain the system
- solver must use least-squares plane fitting

Validation proof should be reflected in:
- unit tests
- high-risk interaction tests when UI behavior changes
- `docs/TEST_STRATEGY.md`

---

# Scope guidance

Current scope and out-of-scope areas must be checked against:
- `docs/FEATURES.md`
- `docs/VENDOR_HANDOVER.md`

Do not infer scope from historical iteration notes alone.

---

# Definition of done

A change is not done only because the code compiles.

At minimum, contributors must ensure:

- geometry solver remains deterministic
- solver logic stays separate from UI
- meshes are always regenerated from constraints
- coordinate conversions remain explicit
- changed behavior is covered by appropriate validation
- affected docs are updated in the same PR
- PR shape follows `docs/PR.md`

For risky changes, done also requires proof aligned with:
- `docs/TEST_STRATEGY.md`
- `docs/RUNBOOK.md`
- `docs/VENDOR_EXECUTION_GUARDRAILS.md`

---

# Contributor expectations

Contributors must not treat this repository like a generic front-end sandbox.

Before merging, ask:

- Did I preserve canonical state rules?
- Did I keep geometry logic out of UI?
- Did I increase orchestration coupling?
- Did I change browser/runtime assumptions?
- Did I update the docs that now became stale?
- Did I provide proof proportional to risk?

If the answer is unclear, stop and read the docs above before continuing.