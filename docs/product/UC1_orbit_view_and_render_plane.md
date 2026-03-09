## UC1 — Orbit view + planar roof preview

### Goal

User can switch to **Orbit** (MapLibre pitch + rotate) and see the **planar roof surface** rendered in 3D above a flat map (base Z=0, only your geometry has Z).

### Scope rules (locked)

* Camera: **MapLibre pitch + rotate only** (no free-orbit).
* Orbit UX: **toggle button** enables/disables pitch interaction.
* Geometry: **single planar face** (per current solver). Map is flat at Z=0.
* Visual: roof plane **semi-transparent**.
* Rendering approach: **keep current simple stack** (MapLibre + current overlay choice).

---

## Implementation plan

### 1) Add “Orbit” mode state

* Add UI toggle: `orbitEnabled: boolean`
* When `orbitEnabled=false`: force `pitch=0`, keep normal pan/zoom.
* When `orbitEnabled=true`:

  * Allow pitch (and rotation if you already support it).
  * Set safe bounds: `maxPitch ~ 80–85°` to avoid flip.
  * Optionally animate transition (ease) to a default 3D angle (e.g., pitch 60°).

### 2) Camera interaction mapping (simple)

* Desktop:

  * Drag = pan (unchanged)
  * Pitch control: use MapLibre’s built-in gestures (or require modifier key if needed).
* Mobile:

  * Keep MapLibre defaults; just enabling pitch is enough.

(If MapLibre gesture conflicts appear, fallback rule: Orbit mode uses MapLibre defaults; non-orbit uses pitch locked to 0.)

### 3) Z model for rendering (flat world + your plane)

* Define: `groundZ = 0`
* Roof vertices: `z = solvedPlane(x,y)` in **meters**
* Ensure consistent coordinate path:

  * lon/lat → local meters for solving
  * local meters + solved z → back to lon/lat + z for rendering

### 4) Roof plane rendering (minimal)

* Render roof as **clipped polygon mesh** (only over footprint) with per-vertex Z.
* Material:

  * **semi-transparent** fill (alpha)
  * Optional thin outline in 2D overlay (helps depth perception)

### 5) UX polish

* Orbit button states:

  * OFF: “Orbit”
  * ON: “Exit orbit”
* On entering orbit:

  * Auto-fit camera to footprint bounds.
  * Apply default pitch (e.g., 60°) so user instantly sees 3D.
* Keep edits unchanged: vertex/edge height editing still works; orbit is view-only toggle, not a separate editor mode.

### 6) Acceptance criteria

* With a solved plane present:

  * Toggling Orbit makes the roof appear “lifted” in 3D.
  * Exiting Orbit returns to flat view (pitch 0) without losing geometry.
* With no plane yet:

  * Orbit works, but roof is not rendered (or rendered at Z=0) with a clear “Add heights to solve plane” hint.

### 7) Small follow-ups (optional, still simple)

* Add a slope arrow overlay derived from plane gradient.
* Add a small panel showing pitch/azimuth while orbit is ON.

