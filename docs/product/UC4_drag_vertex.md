## Plan — UC: Drag vertices/edges + height arrows in Orbit

### 0) Rules (from your statement)

* **Non-Orbit view**: dragging edits **2D geometry only** (lon/lat of points).
* **Orbit view**: user can adjust **height** using **up/down arrows**; no free 3D dragging.
* **Edge edit** is allowed (edge = helper that writes both endpoint vertex heights).
* Overconstraint: allow **max 3 vertices with heights**; edits that would make it >3 must be blocked (or auto-drop others—pick one; default below is block).

---

## 1) State + modes

Add editor state:

* `activeFootprintId`
* `selection: { type: 'vertex'|'edge', id } | null`
* `orbitEnabled: boolean`
* `dragMode: 'move2d' | 'none'`
* `heightEditTarget: { vertexIds: string[] } | null` (in orbit)

---

## 2) Non-Orbit behavior (2D drag)

### Vertex drag

* Preconditions: `orbitEnabled=false`, `selection.type='vertex'`
* On drag:

  * update the selected vertex lon/lat
  * update adjacent edges implicitly (derived)
  * recompute:

    * local tangent origin (centroid) if you use it
    * plane/mesh (if exactly 3 height vertices exist)
* Constraints:

  * keep polygon valid (no self-intersections). If invalid → revert on drop + show error.

### Edge drag (simple MVP)

Pick one approach (recommend A):

* A) **Translate edge**: dragging an edge moves **both endpoints together** by same delta (keeps edge length/orientation).
* B) **Offset edge normal**: more CAD-like, more work.

MVP = A.

---

## 3) Orbit behavior (height arrows)

When `orbitEnabled=true` and selection exists:

* Show **3D gizmo overlay** at:

  * vertex: at vertex screen position
  * edge: at edge midpoint screen position
* Gizmo contains:

  * `▲` increase height
  * `▼` decrease height
* Step size:

  * default `0.1 m`
  * with modifier: `Shift=1.0 m` (desktop) / long-press toggle on mobile

### Actions

* Vertex selection: arrows edit that vertex:

  * `vertexHeights[vertexId] += step`
* Edge selection: arrows edit both endpoints:

  * `vertexHeights[vA] += step`
  * `vertexHeights[vB] += step`
* Always **last change wins** (overwrite).

### Overconstraint enforcement

Before applying height change:

* if setting would cause `count(vertexHeights) > 3`:

  * block and show toast: “Max 3 height points”
  * do not apply

(If you later want “auto drop oldest”, add it explicitly; for now block.)

---

## 4) Height input focus integration

* Clicking vertex/edge in orbit still opens the **height input**, focused.
* Arrows update the input value live (keeps one source of truth).

---

## 5) Rendering updates

After any edit (2D drag or height change):

* If `count(vertexHeights)==3` and non-collinear → solve plane → rebuild roof mesh.
* If `<3` → show only footprint (and maybe Z=0 preview).
* If plane exists → update semi-transparent roof.

---

## 6) UX details

* Cursor/affordances:

  * Non-orbit: draggable handles on vertices; edge hover highlight.
  * Orbit: vertices not draggable; only arrows shown.
* Clear selection on map click.
* Undo/redo (optional but valuable): keep small action stack per footprint.

---

## 7) Acceptance criteria

* Non-orbit:

  * drag vertex → footprint changes shape; data persisted; plane updates if solvable.
  * drag edge → both endpoints move together.
* Orbit:

  * select vertex → arrows visible; clicking ▲ changes vertex height and updates roof.
  * select edge → arrows visible; clicking ▲ changes both endpoint heights.
  * cannot exceed 3 constrained vertices.

