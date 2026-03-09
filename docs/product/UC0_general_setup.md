## Vite + React + Npm - SunCast application setup

Your input implies a **generic “lift-to-3D” surface model**:

* User draws a **2D polygon** (footprint).
* Then selects **a vertex or an edge** and assigns a **target height (Z in meters)**.
* The system builds a **3D roof surface** by fitting a plane (or multiple planes) through constrained points/edges.
* Any roof can be represented as **one or more planar faces** (each face is effectively a mono-pitch plane).

Key design choice: represent roofs as **planar faces with constraints**, not as “roof types”.

## Plan

### 1) Tech stack

* **React + Vite + TypeScript**
* **MapLibre GL JS** for map (tilt/rotate, WebGL) + satellite raster background
* **Terra Draw** for drawing/editing polygons/lines/points
* **Geometry engine** (custom) + optional **turf.js** for 2D operations
* **3D roof rendering**:

  * MapLibre: good for walls via `fill-extrusion`
  * Roof planes: render as WebGL mesh overlay using **deck.gl** (recommended) or **Three.js**
* Storage: project JSON in **localStorage** (MVP), later backend

### 2) Data model (source of truth)

Store only deterministic inputs; generate meshes from them.

**Entities**

* `FootprintPolygon` (GeoJSON Polygon)
* `RoofSurface`:

  * `faces: Face[]`
* `Face`:

  * `polygon2d`: ring coordinates (subset or full footprint)
  * `constraints`:

    * `vertexHeights`: `{ vertexId: z_m }[]` and/or
    * `edgeHeights`: `{ edgeId: z_m }[]` (edge implies both endpoints share height unless overridden)
  * derived:

    * `plane`: `{ a,b,c,d }` in local meters coordinate system
    * `vertices3d`: computed

**Coordinate handling**

* Internally convert lon/lat → **local meters** (a local tangent plane anchored at the footprint centroid). Output back to lon/lat only for storage/visual overlays.

### 3) Core UX flow (MVP)

1. User draws a **footprint polygon** (2D).
2. App shows “Edit in 3D” mode:

   * click a **vertex** → input “Height (m)” → Enter
   * or click an **edge** → input “Height (m)” → Enter
3. App computes roof:

   * If constraints define one plane → single face mono-pitch roof
   * If constraints define multiple planes → split into multiple faces (user-defined splits or automatic)
4. App renders:

   * **Walls**: extrusion from base to roof edge heights
   * **Roof**: planar mesh(es) with correct Z
5. App outputs measurements:

   * plane pitch (deg)
   * ridge direction (azimuth, derived from highest line/gradient)
   * roof area, edge lengths, min/max height

### 4) Roof plane solving (implementation plan)

**Phase 1: single-plane roof**

* Require at least:

  * 3 non-collinear vertex heights, OR
  * 1 edge height + 1 additional vertex height not on that edge
* Fit plane `z = p*x + q*y + r` (least-squares if overconstrained).
* Assign Z to all footprint vertices via plane.
* Roof ends exactly at footprint boundary (no overhang).

**Phase 2: multi-plane roof (2+ faces)**
Two workable UX patterns:

* A) User draws **split line(s)** inside footprint to define faces.
* B) User selects an **edge as ridge** and the app splits polygon into two faces (common gable case).
  Then solve a plane per face, with shared boundary constraints along split lines (continuity optional: G0 only).

### 5) Rendering architecture

* `MapLibre` renders satellite base + 2D overlays (footprint, split lines, selection).
* `deck.gl` overlay renders roof meshes:

  * `SimpleMeshLayer` / `PolygonLayer` with per-vertex positions (lon,lat,z) if you keep conversion consistent.
* Walls:

  * easiest: MapLibre `fill-extrusion` using per-feature constant height is not enough if roof edge heights vary.
  * recommended: render walls also as mesh in deck.gl (so walls can follow varying roof heights along perimeter).

### 6) Measurements and outputs

Compute and display (panel + on-map labels):

* `min_height_m`, `max_height_m`
* derived `pitch_deg` for each face
* derived `azimuth_deg` from ridge direction (you prefer azimuth from ridge)
* roof face area (true 3D area)
* perimeter edge lengths (2D and slope length if needed)
  Export:
* JSON project (footprint + constraints)
* optional: glTF/OBJ mesh export later

### 7) Milestones

1. Satellite map + footprint drawing + save/load
2. Vertex/edge selection + height input + single-plane solve + roof mesh render
3. Multi-plane support via user split lines + per-face solve
4. Wall mesh + full measurement suite
5. Export formats + validation tools (non-planar constraints warnings)

## Next questions (to lock the solver rules)

1. When user sets an **edge height**, does it mean: both endpoints fixed to that height, and intermediate boundary points follow the plane?
2. Do you want to allow **non-planar** roofs (i.e., constraints that cannot be satisfied by one plane) and then force a multi-face split, or should the app reject and ask for a split?
3. Multi-face creation: do you prefer **user-drawn split line**, or “select ridge edge/line → auto split”?
4. Should roof be allowed to have **vertical steps** (discontinuous height) along a split, or must it be continuous?
